const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const SESSION_STORAGE_KEY = 'cooperate.session.v1'

export type UserRole = 'director' | 'admin' | 'employee'
export type IdeaStatus =
  | 'pending_moderation'
  | 'voting'
  | 'director_review'
  | 'rejected_by_admin'
  | 'rejected_by_vote'
  | 'approved_by_director'
  | 'rejected_by_director'

export type IdeaScope = 'active' | 'archive'
export type VoteValue = 'for' | 'against'
export type ViewerVote = {
  value: VoteValue
  createdAt: string
}

export type Company = {
  id: string
  name: string
  description: string | null
  createdAt: string
  settings: {
    ideaMonthlyLimit: number
    voteApprovalPercent: number
  }
}

export type User = {
  id: string
  companyId: string
  fullName: string
  phone: string
  role: UserRole
  position: string
  avatarUrl: string | null
  isActive: boolean
  createdAt: string
}

export type Idea = {
  id: string
  companyId: string
  title: string
  description: string
  descriptionPreview: string
  status: IdeaStatus
  scope: IdeaScope
  archived: boolean
  author: User
  moderation: {
    reviewedBy: User | null
    comment: string | null
    reviewedAt: string | null
  }
  votes: {
    support: number
    against: number
    total: number
    eligibleVoters: number
    remainingVotes: number
    approvalPercent: number
    thresholdPercent: number
    passed: boolean
  }
  viewerVote: ViewerVote | null
  directorDecision: {
    decidedBy: User | null
    comment: string | null
    decidedAt: string | null
    approved: boolean | null
  }
  archivedAt?: string | null
  createdAt?: string
  updatedAt?: string
  votingOpenedAt?: string | null
  votingClosedAt?: string | null
  directorReviewRequestedAt?: string | null
}

export type CompanyStats = {
  employees: number
  ideas: {
    total: number
    active: number
    archive: number
    pendingModeration: number
    waitingForDirector: number
  }
}

export type AuthSession = {
  token: string
  expiresAt: string
  company: Company
  user: User
}

export type ViewerContext = {
  user: User
  company: Company
  stats: CompanyStats
}

export type CompanyOverview = {
  company: Company
  currentUser?: User
  user?: User
  stats: CompanyStats
}

export type IdeaListParams = {
  scope?: 'active' | 'archive' | 'mine' | 'director_review'
  status?: IdeaStatus
  sort?: 'recent' | 'support'
  limit?: number
}

export type RegisterCompanyPayload = {
  companyName: string
  companyDescription: string
  directorName: string
  directorPosition: string
  phone: string
  password: string
}

export type LoginPayload = {
  phone: string
  password: string
}

export type CreateEmployeePayload = {
  fullName: string
  phone: string
  password: string
  role: Exclude<UserRole, 'director'> | 'director'
  position: string
}

export type CreateIdeaPayload = {
  title: string
  description: string
}

export type ModerateIdeaPayload = {
  approved: boolean
  comment: string
}

export type VoteIdeaPayload = {
  value: VoteValue
}

export type DirectorDecisionPayload = {
  approved: boolean
  comment: string
}

type ApiErrorEnvelope = {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
}

class ApiClientError extends Error {
  status: number
  code: string
  details: unknown

  constructor(message: string, status: number, code = 'REQUEST_FAILED', details: unknown = null) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
    this.details = details
  }
}

const buildUrl = (path: string, params?: Record<string, string | number | undefined>) => {
  const url = API_BASE_URL ? new URL(path, API_BASE_URL) : new URL(path, window.location.origin)

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value))
      }
    })
  }

  if (API_BASE_URL) {
    return url.toString()
  }

  return `${url.pathname}${url.search}`
}

const parseResponseBody = async <T>(response: Response): Promise<T | null> => {
  const text = await response.text()

  if (!text) {
    return null
  }

  return JSON.parse(text) as T
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers)

  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(buildUrl(path), {
    ...init,
    headers,
  })

  if (response.status === 204) {
    return undefined as T
  }

  const payload = await parseResponseBody<{ data?: T } & ApiErrorEnvelope>(response)

  if (!response.ok) {
    const error = payload?.error
    throw new ApiClientError(
      error?.message ?? 'Request failed',
      response.status,
      error?.code ?? 'REQUEST_FAILED',
      error?.details ?? null,
    )
  }

  return (payload?.data ?? payload) as T
}

export const getErrorMessage = (error: unknown, fallback = 'Не удалось выполнить запрос') => {
  if (error instanceof ApiClientError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}

export const isSessionExpired = (session: Pick<AuthSession, 'expiresAt'>) =>
  Number.isNaN(Date.parse(session.expiresAt)) || new Date(session.expiresAt).getTime() <= Date.now()

export const loadStoredSession = (): AuthSession | null => {
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    const session = JSON.parse(raw) as AuthSession

    if (isSessionExpired(session)) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }

    return session
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

export const persistSession = (session: AuthSession) => {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

export const clearStoredSession = () => {
  window.localStorage.removeItem(SESSION_STORAGE_KEY)
}

export const registerCompany = (payload: RegisterCompanyPayload) =>
  request<AuthSession>('/api/auth/register-company', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const login = (payload: LoginPayload) =>
  request<AuthSession>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const logout = (token: string) =>
  request<void>('/api/auth/logout', {
    method: 'POST',
  }, token)

export const getAuthMe = (token: string) => request<ViewerContext>('/api/auth/me', {}, token)

export const getCompanyOverview = (token: string) =>
  request<CompanyOverview>('/api/company', {}, token)

export const getEmployees = (token: string) =>
  request<{ items: User[] }>('/api/employees', {}, token)

export const createEmployee = (token: string, payload: CreateEmployeePayload) =>
  request<User>('/api/employees', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token)

export const getIdeas = (token: string, params: IdeaListParams = {}) =>
  request<{ items: Idea[] }>(
    (() => {
      const query = new URLSearchParams()

      if (params.scope) {
        query.set('scope', params.scope)
      }

      if (params.status) {
        query.set('status', params.status)
      }

      if (params.sort) {
        query.set('sort', params.sort)
      }

      if (params.limit) {
        query.set('limit', String(params.limit))
      }

      const search = query.toString()
      return search ? `/api/ideas?${search}` : '/api/ideas'
    })(),
    {},
    token,
  )

export const getIdea = (token: string, ideaId: string) => request<Idea>(`/api/ideas/${ideaId}`, {}, token)

export const createIdea = (token: string, payload: CreateIdeaPayload) =>
  request<Idea>('/api/ideas', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token)

export const moderateIdea = (token: string, ideaId: string, payload: ModerateIdeaPayload) =>
  request<Idea>(`/api/ideas/${ideaId}/moderate`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token)

export const voteIdea = (token: string, ideaId: string, payload: VoteIdeaPayload) =>
  request<Idea>(`/api/ideas/${ideaId}/vote`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token)

export const decideIdea = (token: string, ideaId: string, payload: DirectorDecisionPayload) =>
  request<Idea>(`/api/ideas/${ideaId}/decision`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token)

export { ApiClientError }
