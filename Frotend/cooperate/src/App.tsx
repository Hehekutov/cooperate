import { startTransition, useCallback, useEffect, useMemo, useState, type FormEventHandler } from 'react'
import {
  ApiClientError,
  clearStoredSession,
  createEmployee,
  createIdea,
  decideIdea,
  getAuthMe,
  getEmployees,
  getErrorMessage,
  getIdea,
  getIdeas,
  loadStoredSession,
  login,
  logout,
  moderateIdea,
  persistSession,
  registerCompany,
  voteIdea,
  type AuthSession,
  type Company,
  type CompanyStats,
  type CreateEmployeePayload,
  type CreateIdeaPayload,
  type Idea,
  type IdeaStatus,
  type User,
  type UserRole,
  type VoteValue,
} from './api'
import './App.css'
import { ArchiveList } from './components/ArchiveList'
import { Badge } from './components/Badge'
import { EmployeeGrid } from './components/EmployeeGrid'
import { EmptyState, ErrorState, LoadingState } from './components/FeedbackStates'
import { FormPanel } from './components/FormPanel'
import { HeroPanel } from './components/HeroPanel'
import { IdeaCard } from './components/IdeaCard'
import { IdeaDetailPanel } from './components/IdeaDetailPanel'
import { IdeaListSection } from './components/IdeaListSection'
import { NavBar, type NavItem } from './components/NavBar'

type View = 'appeals' | 'archive' | 'employees'
type IdeaCardStatus = 'active' | 'pending' | 'archived' | 'waiting'
type Notice = {
  tone: 'success' | 'error'
  text: string
}

type ModalState =
  | { kind: 'login' }
  | { kind: 'register-company' }
  | { kind: 'create-idea' }
  | { kind: 'add-employee' }
  | { kind: 'vote'; ideaId: string }
  | { kind: 'moderate'; ideaId: string; approved: boolean }
  | { kind: 'decision'; ideaId: string; approved: boolean }
  | null

type PreviewIdea = {
  id: string
  title: string
  description: string
  detail: string
  supportPercent: number
  statusLabel: string
  cardStatus: IdeaCardStatus
}

const DEFAULT_VIEW: View = 'appeals'

const GUEST_COMPANY_NAME = 'Новая компания'

const PREVIEW_APPEALS: PreviewIdea[] = []

const getViewFromHash = (): View => {
  const hash = window.location.hash.replace('#', '').trim()

  if (hash === 'archive' || hash === 'employees' || hash === 'appeals') {
    return hash
  }

  return DEFAULT_VIEW
}

const STATUS_META: Record<
  IdeaStatus,
  {
    label: string
    cardStatus: IdeaCardStatus
    archiveStatus: 'done' | 'rejected'
  }
> = {
  pending_moderation: {
    label: 'На модерации',
    cardStatus: 'pending',
    archiveStatus: 'rejected',
  },
  voting: {
    label: 'Активно',
    cardStatus: 'active',
    archiveStatus: 'done',
  },
  director_review: {
    label: 'Ждет решения',
    cardStatus: 'waiting',
    archiveStatus: 'done',
  },
  rejected_by_admin: {
    label: 'Отклонено администратором',
    cardStatus: 'archived',
    archiveStatus: 'rejected',
  },
  rejected_by_vote: {
    label: 'Отклонено голосованием',
    cardStatus: 'archived',
    archiveStatus: 'rejected',
  },
  approved_by_director: {
    label: 'Выполнено',
    cardStatus: 'archived',
    archiveStatus: 'done',
  },
  rejected_by_director: {
    label: 'Отклонено директором',
    cardStatus: 'archived',
    archiveStatus: 'rejected',
  },
}

const ROLE_LABEL: Record<UserRole, string> = {
  director: 'Директор',
  admin: 'Администратор',
  employee: 'Сотрудник',
}

const defaultRegisterForm = {
  companyName: '',
  companyDescription: '',
  directorName: '',
  directorPosition: '',
  phone: '',
  password: '',
}

const defaultLoginForm = {
  phone: '',
  password: '',
}

const defaultIdeaForm: CreateIdeaPayload = {
  title: '',
  description: '',
}

const defaultEmployeeForm: CreateEmployeePayload = {
  fullName: '',
  phone: '',
  password: '',
  role: 'employee',
  position: '',
}

const makeNotice = (tone: Notice['tone'], text: string): Notice => ({ tone, text })

const getStatusMeta = (status: IdeaStatus) => STATUS_META[status]

const formatRoleChip = (role: UserRole) => ROLE_LABEL[role]

const toPercent = (value?: number) => Math.round(value ?? 0)

const getIdeaPreview = (idea: Idea) => idea.descriptionPreview || idea.description

const getIdeaSupportText = (idea: Idea) =>
  `${idea.votes.support} за · ${idea.votes.against} против · осталось ${idea.votes.remainingVotes}`

const getViewerVoteValue = (idea: Idea | null) => idea?.viewerVote?.value ?? null

const canModerate = (viewer: User | null, idea: Idea | null) =>
  Boolean(viewer && idea && idea.status === 'pending_moderation' && viewer.role !== 'employee')

const canVote = (viewer: User | null, idea: Idea | null) =>
  Boolean(viewer && idea && idea.status === 'voting' && !getViewerVoteValue(idea))

const canDecide = (viewer: User | null, idea: Idea | null) =>
  Boolean(viewer && idea && idea.status === 'director_review' && viewer.role === 'director')

const getDetailHint = (idea: Idea | null, viewer: User | null) => {
  if (!idea) {
    return ''
  }

  if (idea.status === 'pending_moderation') {
    return 'После одобрения идея выйдет на общее голосование сотрудников.'
  }

  if (idea.status === 'director_review') {
    return 'Порог поддержки достигнут. Осталось финальное решение директора.'
  }

  const viewerVote = getViewerVoteValue(idea)

  if (viewerVote) {
    return `Ваш голос уже учтен: ${viewerVote === 'for' ? 'за' : 'против'}.`
  }

  if (viewer?.role === 'employee' && idea.status === 'voting') {
    return 'Голосование открыто. Можно выбрать вариант "за" или "против".'
  }

  return getIdeaSupportText(idea)
}

const getPreferredIdea = (collections: Idea[][], selectedIdeaId: string | null) => {
  const flat = collections.flat()

  if (selectedIdeaId) {
    const matched = flat.find((idea) => idea.id === selectedIdeaId)
    if (matched) {
      return matched
    }
  }

  return flat[0] ?? null
}

function App() {
  const [view, setView] = useState<View>(() => getViewFromHash())
  const [session, setSession] = useState<AuthSession | null>(() => loadStoredSession())
  const [viewer, setViewer] = useState<User | null>(session?.user ?? null)
  const [company, setCompany] = useState<Company | null>(session?.company ?? null)
  const [stats, setStats] = useState<CompanyStats | null>(null)

  const [activeIdeas, setActiveIdeas] = useState<Idea[]>([])
  const [archiveIdeas, setArchiveIdeas] = useState<Idea[]>([])
  const [mineIdeas, setMineIdeas] = useState<Idea[]>([])
  const [pendingIdeas, setPendingIdeas] = useState<Idea[]>([])
  const [directorIdeas, setDirectorIdeas] = useState<Idea[]>([])
  const [employees, setEmployees] = useState<User[]>([])

  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null)
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null)
  const [guestSelectedIdeaId, setGuestSelectedIdeaId] = useState(PREVIEW_APPEALS[0]?.id ?? null)

  const [pageLoading, setPageLoading] = useState(Boolean(session))
  const [detailLoading, setDetailLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [employeesError, setEmployeesError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [modal, setModal] = useState<ModalState>(null)

  const [loginForm, setLoginForm] = useState(defaultLoginForm)
  const [registerForm, setRegisterForm] = useState(defaultRegisterForm)
  const [ideaForm, setIdeaForm] = useState(defaultIdeaForm)
  const [employeeForm, setEmployeeForm] = useState(defaultEmployeeForm)
  const [actionComment, setActionComment] = useState('')

  useEffect(() => {
    const onHashChange = () => {
      startTransition(() => {
        setView(getViewFromHash())
      })
    }

    window.addEventListener('hashchange', onHashChange)
    return () => {
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [])

  const updateSession = useCallback((nextSession: AuthSession | null) => {
    setSession(nextSession)

    if (!nextSession) {
      clearStoredSession()
      setViewer(null)
      setCompany(null)
      setStats(null)
      setActiveIdeas([])
      setArchiveIdeas([])
      setMineIdeas([])
      setPendingIdeas([])
      setDirectorIdeas([])
      setEmployees([])
      setSelectedIdea(null)
      setSelectedIdeaId(null)
      return
    }

    persistSession(nextSession)
    setViewer(nextSession.user)
    setCompany(nextSession.company)
  }, [])

  const resolveIdeaById = (ideaId: string) => {
    if (selectedIdea?.id === ideaId) {
      return selectedIdea
    }

    const collections = [activeIdeas, archiveIdeas, mineIdeas, pendingIdeas, directorIdeas]
    return collections.flat().find((idea) => idea.id === ideaId) ?? null
  }

  const handleUnauthorized = useCallback((error: unknown) => {
    if (error instanceof ApiClientError && error.status === 401) {
      updateSession(null)
      setNotice(makeNotice('error', 'Сессия истекла. Войдите снова.'))
      setPageError(null)
      setEmployeesError(null)
      setDetailError(null)
      setModal(null)
      return true
    }

    return false
  }, [updateSession])

  const navigateTo = (nextView: View) => {
    if (window.location.hash !== `#${nextView}`) {
      window.location.hash = nextView
    }

    startTransition(() => {
      setView(nextView)
    })
  }

  const refreshEmployees = useCallback(async (currentSession: AuthSession) => {
    try {
      const response = await getEmployees(currentSession.token)
      setEmployees(response.items)
      setEmployeesError(null)
    } catch (error) {
      if (handleUnauthorized(error)) {
        return
      }

      setEmployees([])
      setEmployeesError(getErrorMessage(error, 'Не удалось загрузить сотрудников'))
    }
  }, [handleUnauthorized])

  const refreshDashboard = useCallback(async (currentSession: AuthSession, preserveIdeaId?: string | null) => {
    setPageLoading(true)
    setPageError(null)

    try {
      const role = currentSession.user.role
      const [context, activeResponse, archiveResponse, mineResponse, pendingResponse, directorResponse] =
        await Promise.all([
          getAuthMe(currentSession.token),
          getIdeas(currentSession.token, { scope: 'active', sort: 'recent', limit: 12 }),
          getIdeas(currentSession.token, { scope: 'archive', sort: 'recent', limit: 12 }),
          role === 'employee' || role === 'admin'
            ? getIdeas(currentSession.token, { scope: 'mine', sort: 'recent', limit: 8 })
            : Promise.resolve({ items: [] }),
          role === 'director' || role === 'admin'
            ? getIdeas(currentSession.token, { status: 'pending_moderation', sort: 'recent', limit: 8 })
            : Promise.resolve({ items: [] }),
          role === 'director'
            ? getIdeas(currentSession.token, { scope: 'director_review', sort: 'recent', limit: 8 })
            : Promise.resolve({ items: [] }),
        ])

      const nextSession: AuthSession = {
        ...currentSession,
        user: context.user,
        company: context.company,
      }

      updateSession(nextSession)
      setStats(context.stats)
      setActiveIdeas(activeResponse.items)
      setArchiveIdeas(archiveResponse.items)
      setMineIdeas(mineResponse.items)
      setPendingIdeas(pendingResponse.items)
      setDirectorIdeas(directorResponse.items)

      if (window.location.hash === '#employees' || employees.length > 0 || context.user.role === 'director') {
        await refreshEmployees(nextSession)
      }

      const preferredIdea = getPreferredIdea(
        [directorResponse.items, pendingResponse.items, activeResponse.items, mineResponse.items],
        preserveIdeaId ?? null,
      )

      setSelectedIdeaId(preferredIdea?.id ?? null)
      setSelectedIdea(preferredIdea)
    } catch (error) {
      if (handleUnauthorized(error)) {
        return
      }

      setPageError(getErrorMessage(error, 'Не удалось загрузить данные компании'))
    } finally {
      setPageLoading(false)
    }
  }, [employees.length, handleUnauthorized, refreshEmployees, updateSession])

  useEffect(() => {
    if (!session) {
      setPageLoading(false)
      return
    }

    void refreshDashboard(session, session.user.id === viewer?.id ? selectedIdeaId : null)
  }, [refreshDashboard, selectedIdeaId, session, viewer?.id])

  useEffect(() => {
    if (!session || view !== 'employees' || employees.length > 0 || employeesError) {
      return
    }

    void refreshEmployees(session)
  }, [employees.length, employeesError, refreshEmployees, session, view])

  const openIdeaDetails = async (ideaId: string, fallback?: Idea) => {
    if (!session) {
      setGuestSelectedIdeaId(ideaId)
      return
    }

    setSelectedIdeaId(ideaId)
    if (fallback) {
      setSelectedIdea(fallback)
    }

    setDetailLoading(true)
    setDetailError(null)

    try {
      const idea = await getIdea(session.token, ideaId)
      setSelectedIdea(idea)
    } catch (error) {
      if (handleUnauthorized(error)) {
        return
      }

      setDetailError(getErrorMessage(error, 'Не удалось открыть карточку обращения'))
      if (fallback) {
        setSelectedIdea(fallback)
      }
    } finally {
      setDetailLoading(false)
    }
  }

  const resetModalState = () => {
    setModal(null)
    setModalError(null)
    setActionComment('')
  }

  const openModal = (nextModal: Exclude<ModalState, null>) => {
    setModalError(null)

    if (nextModal.kind === 'moderate' || nextModal.kind === 'decision') {
      setActionComment('')
    }

    setModal(nextModal)
  }

  const submitLogin: FormEventHandler<HTMLFormElement> = () => {
    void (async () => {
      setSubmitting(true)
      setModalError(null)

      try {
        const nextSession = await login(loginForm)
        updateSession(nextSession)
        setLoginForm(defaultLoginForm)
        resetModalState()
        navigateTo('appeals')
        setNotice(makeNotice('success', `Вход выполнен: ${nextSession.user.fullName}`))
      } catch (error) {
        setModalError(getErrorMessage(error, 'Не удалось войти'))
      } finally {
        setSubmitting(false)
      }
    })()
  }

  const submitRegistration: FormEventHandler<HTMLFormElement> = () => {
    void (async () => {
      setSubmitting(true)
      setModalError(null)

      try {
        const nextSession = await registerCompany(registerForm)
        updateSession(nextSession)
        setRegisterForm(defaultRegisterForm)
        resetModalState()
        navigateTo('employees')
        setNotice(makeNotice('success', 'Компания зарегистрирована, можно добавлять сотрудников'))
      } catch (error) {
        setModalError(getErrorMessage(error, 'Не удалось зарегистрировать компанию'))
      } finally {
        setSubmitting(false)
      }
    })()
  }

  const submitIdea: FormEventHandler<HTMLFormElement> = () => {
    if (!session) {
      return
    }

    void (async () => {
      setSubmitting(true)
      setModalError(null)

      try {
        const idea = await createIdea(session.token, ideaForm)
        setIdeaForm(defaultIdeaForm)
        resetModalState()
        setNotice(makeNotice('success', 'Обращение отправлено на модерацию'))
        setSelectedIdeaId(idea.id)
        setSelectedIdea(idea)
        navigateTo('appeals')
        await refreshDashboard(session, idea.id)
      } catch (error) {
        if (handleUnauthorized(error)) {
          return
        }

        setModalError(getErrorMessage(error, 'Не удалось создать обращение'))
      } finally {
        setSubmitting(false)
      }
    })()
  }

  const submitEmployee: FormEventHandler<HTMLFormElement> = () => {
    if (!session) {
      return
    }

    void (async () => {
      setSubmitting(true)
      setModalError(null)

      try {
        await createEmployee(session.token, employeeForm)
        setEmployeeForm(defaultEmployeeForm)
        resetModalState()
        setNotice(makeNotice('success', 'Сотрудник добавлен в компанию'))
        navigateTo('employees')
        await refreshDashboard(session, selectedIdeaId)
      } catch (error) {
        if (handleUnauthorized(error)) {
          return
        }

        setModalError(getErrorMessage(error, 'Не удалось добавить сотрудника'))
      } finally {
        setSubmitting(false)
      }
    })()
  }

  const submitVote = async (value: VoteValue) => {
    if (!session || modal?.kind !== 'vote') {
      return
    }

    setSubmitting(true)
    setModalError(null)

    try {
      const idea = await voteIdea(session.token, modal.ideaId, { value })
      resetModalState()
      setNotice(makeNotice('success', value === 'for' ? 'Голос "за" принят' : 'Голос "против" принят'))
      setSelectedIdea(idea)
      setSelectedIdeaId(idea.id)
      await refreshDashboard(session, idea.id)
    } catch (error) {
      if (handleUnauthorized(error)) {
        return
      }

      setModalError(getErrorMessage(error, 'Не удалось отправить голос'))
    } finally {
      setSubmitting(false)
    }
  }

  const submitModeration: FormEventHandler<HTMLFormElement> = () => {
    if (!session || modal?.kind !== 'moderate') {
      return
    }

    void (async () => {
      setSubmitting(true)
      setModalError(null)

      try {
        const idea = await moderateIdea(session.token, modal.ideaId, {
          approved: modal.approved,
          comment: actionComment,
        })
        resetModalState()
        setNotice(
          makeNotice(
            'success',
            modal.approved ? 'Идея опубликована для голосования' : 'Идея отклонена на этапе модерации',
          ),
        )
        setSelectedIdea(idea)
        setSelectedIdeaId(idea.id)
        await refreshDashboard(session, idea.id)
      } catch (error) {
        if (handleUnauthorized(error)) {
          return
        }

        setModalError(getErrorMessage(error, 'Не удалось завершить модерацию'))
      } finally {
        setSubmitting(false)
      }
    })()
  }

  const submitDecision: FormEventHandler<HTMLFormElement> = () => {
    if (!session || modal?.kind !== 'decision') {
      return
    }

    void (async () => {
      setSubmitting(true)
      setModalError(null)

      try {
        const idea = await decideIdea(session.token, modal.ideaId, {
          approved: modal.approved,
          comment: actionComment,
        })
        resetModalState()
        setNotice(
          makeNotice(
            'success',
            modal.approved ? 'Директор утвердил исполнение идеи' : 'Директор отклонил исполнение идеи',
          ),
        )
        setSelectedIdea(idea)
        setSelectedIdeaId(idea.id)
        await refreshDashboard(session, idea.id)
      } catch (error) {
        if (handleUnauthorized(error)) {
          return
        }

        setModalError(getErrorMessage(error, 'Не удалось сохранить решение директора'))
      } finally {
        setSubmitting(false)
      }
    })()
  }

  const handleLogout = async () => {
    if (session) {
      try {
        await logout(session.token)
      } catch {
        // The local session still needs to be removed even if the request failed.
      }
    }

    updateSession(null)
    navigateTo('appeals')
    setNotice(makeNotice('success', 'Вы вышли из системы'))
  }

  const previewSelectedIdea =
    PREVIEW_APPEALS.find((idea) => idea.id === guestSelectedIdeaId) ?? PREVIEW_APPEALS[0] ?? null

  const activePrimaryAction = useMemo(() => {
    if (!viewer) {
      return {
        label: 'Регистрация',
        action: () => openModal({ kind: 'register-company' as const }),
      }
    }

    if (viewer.role === 'director') {
      return {
        label: 'Добавить сотрудника',
        action: () => openModal({ kind: 'add-employee' as const }),
      }
    }

    return {
      label: 'Новое обращение',
      action: () => openModal({ kind: 'create-idea' as const }),
    }
  }, [viewer])

  const navTabs: NavItem[] = useMemo(
    () => [
      {
        label: 'Обращения',
        active: view === 'appeals',
        onClick: () => navigateTo('appeals'),
      },
      {
        label: 'Архив обращений',
        active: view === 'archive',
        onClick: () => navigateTo('archive'),
      },
      {
        label: 'Сотрудники',
        active: view === 'employees',
        onClick: () => navigateTo('employees'),
      },
    ],
    [view],
  )

  const companyTitle = company?.name ?? GUEST_COMPANY_NAME
  const currentSettings = company?.settings
  const heroStats = session
    ? [
        { label: 'Сотрудники', value: stats?.employees ?? employees.length ?? 0 },
        { label: 'Активные обращения', value: stats?.ideas.active ?? activeIdeas.length },
        { label: 'В архиве', value: stats?.ideas.archive ?? archiveIdeas.length },
        { label: 'Порог поддержки', value: `>${currentSettings?.voteApprovalPercent ?? 50}%` },
      ]
    : [
        { label: 'Идеи в месяц', value: 3 },
        { label: 'Порог поддержки', value: '>50%' },
        { label: 'Этапов цикла', value: 5 },
        { label: 'Роли', value: 4 },
      ]

  const heroDescriptor = session
    ? company?.description || 'Внутреннее пространство для идей, модерации и голосования сотрудников.'
    : 'Внутреннее приложение компании для сбора идей, модерации и честного голосования без бюрократии.'

  const heroRoles = session ? [formatRoleChip(viewer?.role ?? 'employee')] : ['Гость', 'Сотрудник', 'Администратор', 'Директор']

  const detailIdea = session ? selectedIdea : null
  const detailMeta = detailIdea
    ? [
        `Автор: ${detailIdea.author.fullName}`,
        `Статус: ${getStatusMeta(detailIdea.status).label}`,
        `Порог: >${detailIdea.votes.thresholdPercent}%`,
        getViewerVoteValue(detailIdea)
          ? `Ваш голос: ${getViewerVoteValue(detailIdea) === 'for' ? 'за' : 'против'}`
          : null,
      ].filter(Boolean)
    : []

  const renderGuestAppeals = () => (
    <>
      {previewSelectedIdea ? (
        <IdeaDetailPanel
          title={previewSelectedIdea.title}
          description={previewSelectedIdea.detail}
          supportPercent={previewSelectedIdea.supportPercent}
          statusLabel={previewSelectedIdea.statusLabel}
          primaryActionLabel="Войти для участия"
          secondaryActionLabel="Создать компанию"
          onVote={() => openModal({ kind: 'login' })}
          onDetails={() => openModal({ kind: 'register-company' })}
          moderationHint="После входа сотрудник может предложить свою идею, а администратор проверит текст обращения."
        />
      ) : (
        <section className="app-section">
          <EmptyState
            message="Приложение готово к первому запуску"
            detail="После регистрации компании здесь появятся обращения, сотрудники и история решений."
          />
        </section>
      )}

      <section className="app-flow-grid">
        <article className="info-panel">
          <h3>Жизненный цикл обращения</h3>
          <p>
            Сотрудник создает предложение, администратор модерирует текст, сотрудники голосуют, а
            директор принимает финальное решение.
          </p>
          <div className="info-chip-row">
            <Badge label="1. Создание" />
            <Badge label="2. Модерация" />
            <Badge label="3. Голосование" />
            <Badge label="4. Решение директора" />
          </div>
        </article>
        <article className="info-panel">
          <h3>MVP-потоки</h3>
          <p>
            В интерфейсе уже предусмотрены гостевой вход, регистрация компании, добавление
            сотрудников, публикация или отказ по идее и просмотр результатов голосования.
          </p>
          <div className="info-chip-row">
            <Badge label="Вход" />
            <Badge label="Регистрация" />
            <Badge label="Добавление сотрудников" />
            <Badge label="Фильтрация" />
          </div>
        </article>
      </section>

      <IdeaListSection
        title="Обращения"
        emptyMessage="После первого обращения здесь появится список идей сотрудников."
      >
        {PREVIEW_APPEALS.map((idea) => (
          <IdeaCard
            key={idea.id}
            title={idea.title}
            description={idea.description}
            supportPercent={idea.supportPercent}
            status={idea.cardStatus}
            statusLabel={idea.statusLabel}
            ctaLabel="Открыть"
            onVote={() => void openIdeaDetails(idea.id)}
          />
        ))}
      </IdeaListSection>
    </>
  )

  const renderAuthenticatedAppeals = () => {
    if (pageLoading && !selectedIdea && activeIdeas.length === 0 && pendingIdeas.length === 0) {
      return (
        <section className="app-section">
          <LoadingState message="Загружаем обращения" detail="Синхронизируем активные идеи и очереди." />
        </section>
      )
    }

    if (pageError) {
      return (
        <section className="app-section">
          <ErrorState message="Не удалось открыть обращения" detail={pageError} />
        </section>
      )
    }

    return (
      <>
        {detailIdea ? (
          <>
            {detailLoading && (
              <section className="app-section">
                <LoadingState
                  message="Обновляем карточку обращения"
                  detail="Подтягиваем последние голоса и комментарии."
                />
              </section>
            )}

            <IdeaDetailPanel
              title={detailIdea.title}
              description={detailIdea.description}
              supportPercent={toPercent(detailIdea.votes.approvalPercent)}
              statusLabel={getStatusMeta(detailIdea.status).label}
              moderationHint={getDetailHint(detailIdea, viewer)}
              viewerRole={viewer?.role}
              primaryActionLabel={canVote(viewer, detailIdea) ? 'Голосовать' : undefined}
              secondaryActionLabel="Обновить карточку"
              onVote={
                canVote(viewer, detailIdea)
                  ? () => openModal({ kind: 'vote', ideaId: detailIdea.id })
                  : undefined
              }
              onDetails={() => void openIdeaDetails(detailIdea.id, detailIdea)}
              onModerateApprove={
                canModerate(viewer, detailIdea)
                  ? () => openModal({ kind: 'moderate', ideaId: detailIdea.id, approved: true })
                  : canDecide(viewer, detailIdea)
                    ? () => openModal({ kind: 'decision', ideaId: detailIdea.id, approved: true })
                    : undefined
              }
              onModerateReject={
                canModerate(viewer, detailIdea)
                  ? () => openModal({ kind: 'moderate', ideaId: detailIdea.id, approved: false })
                  : canDecide(viewer, detailIdea)
                    ? () => openModal({ kind: 'decision', ideaId: detailIdea.id, approved: false })
                    : undefined
              }
            />

            <section className="detail-meta-grid">
              {detailMeta.map((item) => (
                <article className="info-panel compact" key={item}>
                  <span>{item}</span>
                </article>
              ))}
              {detailIdea.moderation.comment && (
                <article className="info-panel compact">
                  <span>Комментарий модератора</span>
                  <strong>{detailIdea.moderation.comment}</strong>
                </article>
              )}
              {detailIdea.directorDecision.comment && (
                <article className="info-panel compact">
                  <span>Комментарий директора</span>
                  <strong>{detailIdea.directorDecision.comment}</strong>
                </article>
              )}
            </section>

            {detailError && (
              <section className="app-section">
                <ErrorState message="Карточка обновлена не полностью" detail={detailError} />
              </section>
            )}
          </>
        ) : (
          <section className="app-section">
            <EmptyState
              message="Пока нет обращений для показа"
              detail="Создайте первое обращение или откройте архивные результаты."
            />
          </section>
        )}

        {pendingIdeas.length > 0 && (
          <IdeaListSection title="На рассмотрении">
            {pendingIdeas.map((idea) => {
              const status = getStatusMeta(idea.status)
              return (
                <IdeaCard
                  key={idea.id}
                  title={idea.title}
                  description={getIdeaPreview(idea)}
                  supportPercent={toPercent(idea.votes.approvalPercent)}
                  status={status.cardStatus}
                  statusLabel={status.label}
                  ctaLabel="Рассмотреть"
                  onVote={() => void openIdeaDetails(idea.id, idea)}
                />
              )
            })}
          </IdeaListSection>
        )}

        {directorIdeas.length > 0 && (
          <IdeaListSection title="Ожидают решения директора">
            {directorIdeas.map((idea) => {
              const status = getStatusMeta(idea.status)
              return (
                <IdeaCard
                  key={idea.id}
                  title={idea.title}
                  description={getIdeaPreview(idea)}
                  supportPercent={toPercent(idea.votes.approvalPercent)}
                  status={status.cardStatus}
                  statusLabel={status.label}
                  ctaLabel="Принять решение"
                  onVote={() => void openIdeaDetails(idea.id, idea)}
                />
              )
            })}
          </IdeaListSection>
        )}

        {mineIdeas.length > 0 && viewer?.role !== 'director' && (
          <IdeaListSection title="Мои обращения">
            {mineIdeas.slice(0, 4).map((idea) => {
              const status = getStatusMeta(idea.status)
              return (
                <IdeaCard
                  key={idea.id}
                  title={idea.title}
                  description={getIdeaPreview(idea)}
                  supportPercent={toPercent(idea.votes.approvalPercent)}
                  status={status.cardStatus}
                  statusLabel={status.label}
                  ctaLabel="Открыть"
                  onVote={() => void openIdeaDetails(idea.id, idea)}
                />
              )
            })}
          </IdeaListSection>
        )}

        <IdeaListSection title="Активные обращения" emptyMessage="Сейчас нет открытого голосования.">
          {activeIdeas.map((idea) => {
            const status = getStatusMeta(idea.status)
            return (
              <IdeaCard
                key={idea.id}
                title={idea.title}
                description={getIdeaPreview(idea)}
                supportPercent={toPercent(idea.votes.approvalPercent)}
                status={status.cardStatus}
                statusLabel={status.label}
                ctaLabel={canVote(viewer, idea) ? 'Голосовать' : 'Открыть'}
                onVote={() => void openIdeaDetails(idea.id, idea)}
              />
            )
          })}
        </IdeaListSection>
      </>
    )
  }

  const renderArchive = () => {
    if (!session) {
      return (
        <section className="app-section">
          <EmptyState
            message="Архив пока пуст"
            detail="Он заполнится после первых завершённых или отклонённых обращений."
          />
        </section>
      )
    }

    if (pageLoading && archiveIdeas.length === 0) {
      return (
        <section className="app-section">
          <LoadingState message="Загружаем архив" detail="Подтягиваем завершенные и отклоненные обращения." />
        </section>
      )
    }

    if (pageError) {
      return (
        <section className="app-section">
          <ErrorState message="Не удалось открыть архив" detail={pageError} />
        </section>
      )
    }

    if (archiveIdeas.length === 0) {
      return (
        <section className="app-section">
          <EmptyState message="Архив пока пуст" detail="Появится после первых завершенных решений." />
        </section>
      )
    }

    return (
      <ArchiveList
        items={archiveIdeas.map((idea) => ({
          id: idea.id,
          title: idea.title,
          description: idea.description,
          status: getStatusMeta(idea.status).archiveStatus,
        }))}
      />
    )
  }

  const renderEmployees = () => {
    if (!session) {
      return (
        <section className="app-section">
          <EmptyState
            message="Список сотрудников пуст"
            detail="После регистрации компании директор сможет добавить первых сотрудников вручную."
          />
        </section>
      )
    }

    if (view === 'employees' && pageLoading && employees.length === 0) {
      return (
        <section className="app-section">
          <LoadingState message="Загружаем сотрудников" detail="Собираем команду компании." />
        </section>
      )
    }

    if (employeesError) {
      return (
        <section className="app-section">
          <ErrorState message="Не удалось открыть список сотрудников" detail={employeesError} />
        </section>
      )
    }

    if (employees.length === 0) {
      return (
        <section className="app-section">
          <EmptyState
            message="Сотрудники пока не добавлены"
            detail="После регистрации компании директор может добавить сотрудников вручную."
          />
        </section>
      )
    }

    return (
      <EmployeeGrid
        employees={employees.map((employee) => ({
          id: employee.id,
          name: employee.fullName,
          position: employee.position,
          role: employee.role,
          avatarUrl: employee.avatarUrl ?? undefined,
        }))}
      />
    )
  }

  const modalIdea =
    modal?.kind === 'vote' || modal?.kind === 'moderate' || modal?.kind === 'decision'
      ? resolveIdeaById(modal.ideaId)
      : null

  return (
    <div className="app-shell">
      <NavBar
        companyName={companyTitle}
        tabs={navTabs}
        guestMode={!session}
        ctaLabel={!session ? 'Подключить компанию' : undefined}
        onCTAClick={!session ? () => openModal({ kind: 'register-company' }) : undefined}
        ctaDescription={!session ? 'Гостевой режим показывает только концепт интерфейса' : undefined}
        onLogin={session ? () => void handleLogout() : () => openModal({ kind: 'login' })}
        onRegister={activePrimaryAction.action}
        loginLabel={session ? 'Выйти' : 'Войти'}
        registerLabel={activePrimaryAction.label}
        currentUserLabel={session && viewer ? `${viewer.fullName} · ${formatRoleChip(viewer.role)}` : undefined}
      />

      <main className="app-main">
        <HeroPanel
          companyName={companyTitle}
          descriptor={heroDescriptor}
          stats={heroStats}
          roles={heroRoles}
          ctaLabel={activePrimaryAction.label}
          onCTAClick={activePrimaryAction.action}
          ctaHelper={
            session
              ? `Лимит идей в месяц: ${currentSettings?.ideaMonthlyLimit ?? 3}. Порог передачи директору: >${currentSettings?.voteApprovalPercent ?? 50}%.`
              : 'Директор регистрирует компанию, сотрудники предлагают идеи, администратор публикует обращения для общего голосования.'
          }
        />

        {notice && (
          <section className="app-section">
            <div className={`notice-banner ${notice.tone}`}>{notice.text}</div>
          </section>
        )}

        {view === 'appeals' && (session ? renderAuthenticatedAppeals() : renderGuestAppeals())}
        {view === 'archive' && renderArchive()}
        {view === 'employees' && renderEmployees()}
      </main>

      <footer className="app-footer">
        <div>
          <strong>Обратная связь</strong>
          <span>Контакты</span>
          <span>Поддержка</span>
        </div>
        <div>
          <strong>О приложении</strong>
          <span>История создания</span>
          <span>Участники</span>
          <span>Поддержать проект</span>
        </div>
      </footer>

      {modal && (
        <div className="modal-backdrop" role="presentation" onClick={resetModalState}>
          <div className="modal-surface" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            {modal.kind === 'login' && (
              <FormPanel
                title="Вход пользователя"
                description="Укажите телефон и пароль сотрудника или руководителя."
                primaryCta={submitting ? 'Входим...' : 'Войти'}
                onSubmit={submitLogin}
                secondaryCta="Регистрация компании"
                onSecondary={() => setModal({ kind: 'register-company' })}
                submitDisabled={submitting}
                secondaryDisabled={submitting}
                fullWidth
              >
                <label className="form-field">
                  <span>Телефон</span>
                  <input
                    value={loginForm.phone}
                    onChange={(event) =>
                      setLoginForm((current) => ({ ...current, phone: event.target.value }))
                    }
                    placeholder="+7 (900) 000-00-11"
                  />
                </label>
                <label className="form-field">
                  <span>Пароль</span>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder="Введите пароль"
                  />
                </label>
                {modalError && <p className="modal-error">{modalError}</p>}
              </FormPanel>
            )}

            {modal.kind === 'register-company' && (
              <FormPanel
                title="Регистрация компании"
                description="Создайте компанию и первую учетную запись директора. Поле ИНН не отправляется, потому что текущий бэкенд его не поддерживает."
                primaryCta={submitting ? 'Регистрируем...' : 'Создать компанию'}
                onSubmit={submitRegistration}
                secondaryCta="Уже есть аккаунт"
                onSecondary={() => setModal({ kind: 'login' })}
                submitDisabled={submitting}
                secondaryDisabled={submitting}
                fullWidth
              >
                <label className="form-field">
                  <span>Название компании</span>
                  <input
                    value={registerForm.companyName}
                    onChange={(event) =>
                      setRegisterForm((current) => ({ ...current, companyName: event.target.value }))
                    }
                    placeholder="ООО Ромашка"
                  />
                </label>
                <label className="form-field">
                  <span>Описание компании</span>
                  <textarea
                    value={registerForm.companyDescription}
                    onChange={(event) =>
                      setRegisterForm((current) => ({
                        ...current,
                        companyDescription: event.target.value,
                      }))
                    }
                    placeholder="Коротко опишите компанию и назначение платформы"
                  />
                </label>
                <div className="modal-grid">
                  <label className="form-field">
                    <span>ФИО директора</span>
                    <input
                      value={registerForm.directorName}
                      onChange={(event) =>
                        setRegisterForm((current) => ({ ...current, directorName: event.target.value }))
                      }
                      placeholder="Иван Иванов"
                    />
                  </label>
                  <label className="form-field">
                    <span>Должность</span>
                    <input
                      value={registerForm.directorPosition}
                      onChange={(event) =>
                        setRegisterForm((current) => ({
                          ...current,
                          directorPosition: event.target.value,
                        }))
                      }
                      placeholder="Генеральный директор"
                    />
                  </label>
                </div>
                <div className="modal-grid">
                  <label className="form-field">
                    <span>Телефон</span>
                    <input
                      value={registerForm.phone}
                      onChange={(event) =>
                        setRegisterForm((current) => ({ ...current, phone: event.target.value }))
                      }
                      placeholder="+7 (900) 000-00-11"
                    />
                  </label>
                  <label className="form-field">
                    <span>Пароль</span>
                    <input
                      type="password"
                      value={registerForm.password}
                      onChange={(event) =>
                        setRegisterForm((current) => ({ ...current, password: event.target.value }))
                      }
                      placeholder="Создайте пароль"
                    />
                  </label>
                </div>
                {modalError && <p className="modal-error">{modalError}</p>}
              </FormPanel>
            )}

            {modal.kind === 'create-idea' && (
              <FormPanel
                title="Новое обращение"
                description={`Сейчас у сотрудника доступно до ${currentSettings?.ideaMonthlyLimit ?? 3} идей в месяц.`}
                primaryCta={submitting ? 'Отправляем...' : 'Отправить на модерацию'}
                onSubmit={submitIdea}
                submitDisabled={submitting}
                fullWidth
              >
                <label className="form-field">
                  <span>Заголовок</span>
                  <input
                    value={ideaForm.title}
                    onChange={(event) =>
                      setIdeaForm((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Например: Поставить кофемашину"
                  />
                </label>
                <label className="form-field">
                  <span>Описание идеи</span>
                  <textarea
                    value={ideaForm.description}
                    onChange={(event) =>
                      setIdeaForm((current) => ({ ...current, description: event.target.value }))
                    }
                    placeholder="Кратко опишите проблему, ожидаемую пользу и контекст."
                  />
                </label>
                {modalError && <p className="modal-error">{modalError}</p>}
              </FormPanel>
            )}

            {modal.kind === 'add-employee' && (
              <FormPanel
                title="Добавление сотрудника"
                description="Директор может создать учетную запись администратора или сотрудника."
                primaryCta={submitting ? 'Сохраняем...' : 'Добавить сотрудника'}
                onSubmit={submitEmployee}
                submitDisabled={submitting}
                fullWidth
              >
                <div className="modal-grid">
                  <label className="form-field">
                    <span>ФИО</span>
                    <input
                      value={employeeForm.fullName}
                      onChange={(event) =>
                        setEmployeeForm((current) => ({ ...current, fullName: event.target.value }))
                      }
                      placeholder="Иван Иванов"
                    />
                  </label>
                  <label className="form-field">
                    <span>Телефон</span>
                    <input
                      value={employeeForm.phone}
                      onChange={(event) =>
                        setEmployeeForm((current) => ({ ...current, phone: event.target.value }))
                      }
                      placeholder="+7 (900) 000-00-12"
                    />
                  </label>
                </div>
                <div className="modal-grid">
                  <label className="form-field">
                    <span>Должность</span>
                    <input
                      value={employeeForm.position}
                      onChange={(event) =>
                        setEmployeeForm((current) => ({ ...current, position: event.target.value }))
                      }
                      placeholder="Office Administrator"
                    />
                  </label>
                  <label className="form-field">
                    <span>Роль</span>
                    <select
                      value={employeeForm.role}
                      onChange={(event) =>
                        setEmployeeForm((current) => ({
                          ...current,
                          role: event.target.value as CreateEmployeePayload['role'],
                        }))
                      }
                    >
                      <option value="employee">Сотрудник</option>
                      <option value="admin">Администратор</option>
                    </select>
                  </label>
                </div>
                <label className="form-field">
                  <span>Пароль</span>
                  <input
                    type="password"
                    value={employeeForm.password}
                    onChange={(event) =>
                      setEmployeeForm((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder="Создайте временный пароль"
                  />
                </label>
                {modalError && <p className="modal-error">{modalError}</p>}
              </FormPanel>
            )}

            {modal.kind === 'vote' && modalIdea && (
              <FormPanel
                title="Голосование по обращению"
                description={`Выберите вариант для идеи "${modalIdea.title}".`}
                primaryCta={submitting ? 'Отправляем...' : 'Голосую за'}
                onSubmit={() => {
                  void submitVote('for')
                }}
                secondaryCta="Голосую против"
                onSecondary={() => {
                  void submitVote('against')
                }}
                submitDisabled={submitting}
                secondaryDisabled={submitting}
                fullWidth
              >
                <div className="modal-context">
                  <Badge label={getStatusMeta(modalIdea.status).label} />
                  <Badge label={`Поддержка: ${toPercent(modalIdea.votes.approvalPercent)}%`} />
                  <Badge label={`Порог: >${modalIdea.votes.thresholdPercent}%`} />
                </div>
                <p className="modal-copy">{modalIdea.description}</p>
                {modalError && <p className="modal-error">{modalError}</p>}
              </FormPanel>
            )}

            {modal.kind === 'moderate' && modalIdea && (
              <FormPanel
                title={modal.approved ? 'Публикация идеи' : 'Отказ в публикации'}
                description="Комментарий сохранится в истории модерации и будет виден автору."
                primaryCta={submitting ? 'Сохраняем...' : modal.approved ? 'Опубликовать' : 'Отклонить'}
                onSubmit={submitModeration}
                submitDisabled={submitting}
                fullWidth
              >
                <div className="modal-context">
                  <Badge label={modalIdea.author.fullName} />
                  <Badge label={modalIdea.author.position} />
                </div>
                <p className="modal-copy">{modalIdea.description}</p>
                <label className="form-field">
                  <span>Комментарий</span>
                  <textarea
                    value={actionComment}
                    onChange={(event) => setActionComment(event.target.value)}
                    placeholder={
                      modal.approved
                        ? 'Например: текст понятный, запускаем голосование.'
                        : 'Например: просьба переписать обращение без разговорных формулировок.'
                    }
                  />
                </label>
                {modalError && <p className="modal-error">{modalError}</p>}
              </FormPanel>
            )}

            {modal.kind === 'decision' && modalIdea && (
              <FormPanel
                title={modal.approved ? 'Финальное одобрение' : 'Финальный отказ'}
                description="Решение директора завершает жизненный цикл обращения и переносит его в архив."
                primaryCta={submitting ? 'Сохраняем...' : modal.approved ? 'Утвердить' : 'Отклонить'}
                onSubmit={submitDecision}
                submitDisabled={submitting}
                fullWidth
              >
                <div className="modal-context">
                  <Badge label={`Поддержка: ${toPercent(modalIdea.votes.approvalPercent)}%`} />
                  <Badge label={`Всего голосов: ${modalIdea.votes.total}`} />
                </div>
                <p className="modal-copy">{modalIdea.description}</p>
                <label className="form-field">
                  <span>Комментарий директора</span>
                  <textarea
                    value={actionComment}
                    onChange={(event) => setActionComment(event.target.value)}
                    placeholder={
                      modal.approved
                        ? 'Например: утверждаем на следующий квартал.'
                        : 'Например: откладываем из-за бюджета.'
                    }
                  />
                </label>
                {modalError && <p className="modal-error">{modalError}</p>}
              </FormPanel>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
