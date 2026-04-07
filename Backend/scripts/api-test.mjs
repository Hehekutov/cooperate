#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const baseUrl = (process.env.BASE_URL ?? 'http://127.0.0.1:5071').replace(/\/$/, '')
const runId = process.env.TEST_RUN_ID ?? Date.now().toString()
const reportFile = process.env.REPORT_FILE

const companyName = `QA Company ${runId}`
const directorPhone = `+7${String(1000000000 + Number(runId.slice(-9))).slice(-10)}`
const directorLogin = `director_${runId}`

const users = {
  admin: {
    fullName: `Admin ${runId}`,
    login: `admin_${runId}`,
    phone: `+7${String(2000000000 + Number(runId.slice(-9))).slice(-10)}`,
    password: 'Admin123!',
    role: 'admin',
    position: 'Platform Admin',
  },
  employee1: {
    fullName: `Employee One ${runId}`,
    login: `employee1_${runId}`,
    phone: `+7${String(3000000000 + Number(runId.slice(-9))).slice(-10)}`,
    password: 'Employee123!',
    role: 'employee',
    position: 'Engineer',
  },
  employee2: {
    fullName: `Employee Two ${runId}`,
    login: `employee2_${runId}`,
    phone: `+7${String(4000000000 + Number(runId.slice(-9))).slice(-10)}`,
    password: 'Employee123!',
    role: 'employee',
    position: 'Designer',
  },
  employee3: {
    fullName: `Employee Three ${runId}`,
    login: `employee3_${runId}`,
    phone: `+7${String(5000000000 + Number(runId.slice(-9))).slice(-10)}`,
    password: 'Employee123!',
    role: 'employee',
    position: 'Analyst',
  },
  lateEmployee: {
    fullName: `Late Employee ${runId}`,
    login: `late_${runId}`,
    phone: `+7${String(6000000000 + Number(runId.slice(-9))).slice(-10)}`,
    password: 'Employee123!',
    role: 'employee',
    position: 'Intern',
  },
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function request(path, { method = 'GET', token, body, expectedStatus = 200 } = {}) {
  const headers = {}

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (response.status !== expectedStatus) {
    throw new Error(
      `${method} ${path} expected ${expectedStatus}, got ${response.status}: ${text || '<empty>'}`,
    )
  }

  return payload?.data ?? payload
}

async function expectFailure(path, { method = 'GET', token, body, expectedStatus, expectedCode } = {}) {
  const headers = {}

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  assert(
    response.status === expectedStatus,
    `${method} ${path} expected failure ${expectedStatus}, got ${response.status}: ${text || '<empty>'}`,
  )

  if (expectedCode) {
    assert(
      payload?.error?.code === expectedCode,
      `${method} ${path} expected error code ${expectedCode}, got ${payload?.error?.code ?? '<missing>'}`,
    )
  }

  return payload
}

async function loginByLogin(login, password) {
  return request('/api/auth/login', {
    method: 'POST',
    expectedStatus: 200,
    body: { login, password },
  })
}

async function loginByPhone(phone, password) {
  return request('/api/auth/login', {
    method: 'POST',
    expectedStatus: 200,
    body: { phone, password },
  })
}

async function createEmployee(token, user) {
  return request('/api/employees', {
    method: 'POST',
    token,
    expectedStatus: 201,
    body: user,
  })
}

async function createIdea(token, title, votingType, description) {
  return request('/api/ideas', {
    method: 'POST',
    token,
    expectedStatus: 201,
    body: { title, description, votingType },
  })
}

async function main() {
  const report = []

  const health = await request('/health')
  assert(health.status === 'ok', 'Health check did not return status=ok')
  report.push('health ok')

  await expectFailure('/api/ideas?unknown=1', { expectedStatus: 401, expectedCode: 'UNAUTHORIZED' })
  await expectFailure('/api/auth/login', {
    method: 'POST',
    expectedStatus: 400,
    expectedCode: 'VALIDATION_ERROR',
    body: { login: 'abc', password: 'secret123', extra: true },
  })

  const directorSession = await request('/api/auth/register-company', {
    method: 'POST',
    expectedStatus: 201,
    body: {
      companyName,
      companyInn: '7701234567',
      companyDescription: 'Full API test run',
      directorName: `Director ${runId}`,
      directorLogin,
      directorPosition: 'General Director',
      phone: directorPhone,
      password: 'Director123!',
    },
  })

  assert(directorSession.user.role === 'director', 'Director registration returned wrong role')
  report.push('register company ok')

  const directorByLogin = await loginByLogin(directorLogin, 'Director123!')
  const directorByPhone = await loginByPhone(directorPhone, 'Director123!')
  assert(directorByLogin.user.id === directorSession.user.id, 'Login by login returned another user')
  assert(directorByPhone.user.id === directorSession.user.id, 'Login by phone returned another user')
  report.push('login by login/phone ok')

  const me = await request('/api/auth/me', { token: directorSession.token })
  assert(me.user.id === directorSession.user.id, 'auth/me returned wrong user')
  assert(me.company.name === companyName, 'auth/me returned wrong company')
  report.push('auth/me ok')

  await expectFailure('/api/auth/login', {
    method: 'POST',
    expectedStatus: 401,
    expectedCode: 'UNAUTHORIZED',
    body: { login: directorLogin, password: 'wrong-password' },
  })

  const admin = await createEmployee(directorSession.token, users.admin)
  const employee1 = await createEmployee(directorSession.token, users.employee1)
  const employee2 = await createEmployee(directorSession.token, users.employee2)
  const employee3 = await createEmployee(directorSession.token, users.employee3)
  report.push('employees added ok')

  const adminSession = await loginByLogin(users.admin.login, users.admin.password)
  const employee1Session = await loginByLogin(users.employee1.login, users.employee1.password)
  const employee2Session = await loginByLogin(users.employee2.login, users.employee2.password)
  const employee3Session = await loginByLogin(users.employee3.login, users.employee3.password)

  await expectFailure('/api/employees', {
    method: 'POST',
    token: employee1Session.token,
    expectedStatus: 403,
    expectedCode: 'FORBIDDEN',
    body: {
      fullName: 'Should Fail',
      login: `fail_${runId}`,
      phone: '+79990000001',
      password: 'Password123!',
      role: 'employee',
      position: 'Test',
    },
  })

  await expectFailure('/api/ideas', {
    method: 'POST',
    token: directorSession.token,
    expectedStatus: 403,
    expectedCode: 'FORBIDDEN',
    body: {
      title: 'Director cannot create',
      description: 'This should fail',
      votingType: 'standard',
    },
  })

  const approvedIdea = await createIdea(
    employee1Session.token,
    `Coffee machine ${runId}`,
    'standard',
    'Install a coffee machine in the office kitchen.',
  )

  await expectFailure(`/api/ideas/${approvedIdea.id}/moderate`, {
    method: 'POST',
    token: employee1Session.token,
    expectedStatus: 403,
    expectedCode: 'FORBIDDEN',
    body: { approved: true, comment: 'Should fail' },
  })

  const approvedVotingIdea = await request(`/api/ideas/${approvedIdea.id}/moderate`, {
    method: 'POST',
    token: adminSession.token,
    expectedStatus: 200,
    body: { approved: true, comment: 'Ready for company voting' },
  })
  assert(approvedVotingIdea.status === 'voting', 'Approved idea did not move to voting')

  const lateEmployee = await createEmployee(directorSession.token, users.lateEmployee)
  const lateEmployeeSession = await loginByLogin(users.lateEmployee.login, users.lateEmployee.password)
  await expectFailure(`/api/ideas/${approvedIdea.id}/vote`, {
    method: 'POST',
    token: lateEmployeeSession.token,
    expectedStatus: 403,
    expectedCode: 'FORBIDDEN',
    body: { value: 'for' },
  })

  await expectFailure(`/api/ideas/${approvedIdea.id}/vote`, {
    method: 'POST',
    token: directorSession.token,
    expectedStatus: 403,
    expectedCode: 'FORBIDDEN',
    body: { value: 'for' },
  })

  await request(`/api/ideas/${approvedIdea.id}/vote`, {
    method: 'POST',
    token: employee1Session.token,
    expectedStatus: 200,
    body: { value: 'for' },
  })
  await request(`/api/ideas/${approvedIdea.id}/vote`, {
    method: 'POST',
    token: adminSession.token,
    expectedStatus: 200,
    body: { value: 'for' },
  })
  const readyForDirector = await request(`/api/ideas/${approvedIdea.id}/vote`, {
    method: 'POST',
    token: employee2Session.token,
    expectedStatus: 200,
    body: { value: 'for' },
  })
  assert(
    readyForDirector.status === 'director_review',
    'Idea should move to director_review after >50% support',
  )

  await expectFailure(`/api/ideas/${approvedIdea.id}/vote`, {
    method: 'POST',
    token: employee1Session.token,
    expectedStatus: 409,
    expectedCode: 'CONFLICT',
    body: { value: 'for' },
  })

  await expectFailure(`/api/ideas/${approvedIdea.id}/decision`, {
    method: 'POST',
    token: adminSession.token,
    expectedStatus: 403,
    expectedCode: 'FORBIDDEN',
    body: { approved: true, comment: 'Should fail' },
  })

  const approvedDecision = await request(`/api/ideas/${approvedIdea.id}/decision`, {
    method: 'POST',
    token: directorSession.token,
    expectedStatus: 200,
    body: { approved: true, comment: 'Approved for next quarter' },
  })
  assert(approvedDecision.status === 'approved_by_director', 'Director approval did not archive idea')
  report.push('approved lifecycle ok')

  const rejectedByAdminIdea = await createIdea(
    employee2Session.token,
    `Rejected by admin ${runId}`,
    'secret',
    'Use a secret vote flow for moderation rejection coverage.',
  )
  const rejectedByAdmin = await request(`/api/ideas/${rejectedByAdminIdea.id}/moderate`, {
    method: 'POST',
    token: adminSession.token,
    expectedStatus: 200,
    body: { approved: false, comment: 'Need more structured description' },
  })
  assert(rejectedByAdmin.status === 'rejected_by_admin', 'Idea should be rejected by admin')
  report.push('moderation rejection ok')

  const voteRejectedIdea = await createIdea(
    employee3Session.token,
    `Rejected by vote ${runId}`,
    'standard',
    'This idea should fail by vote once everyone votes.',
  )
  await request(`/api/ideas/${voteRejectedIdea.id}/moderate`, {
    method: 'POST',
    token: adminSession.token,
    expectedStatus: 200,
    body: { approved: true, comment: 'Let the team decide' },
  })
  await request(`/api/ideas/${voteRejectedIdea.id}/vote`, {
    method: 'POST',
    token: employee3Session.token,
    expectedStatus: 200,
    body: { value: 'for' },
  })
  await request(`/api/ideas/${voteRejectedIdea.id}/vote`, {
    method: 'POST',
    token: adminSession.token,
    expectedStatus: 200,
    body: { value: 'against' },
  })
  await request(`/api/ideas/${voteRejectedIdea.id}/vote`, {
    method: 'POST',
    token: employee1Session.token,
    expectedStatus: 200,
    body: { value: 'against' },
  })
  const rejectedByVote = await request(`/api/ideas/${voteRejectedIdea.id}/vote`, {
    method: 'POST',
    token: employee2Session.token,
    expectedStatus: 200,
    body: { value: 'against' },
  })
  assert(rejectedByVote.status === 'rejected_by_vote', 'Idea should be rejected after all votes cast')
  report.push('vote rejection ok')

  const rejectedByDirectorIdea = await createIdea(
    employee2Session.token,
    `Rejected by director ${runId}`,
    'standard',
    'This idea should reach the director and then be rejected.',
  )
  await request(`/api/ideas/${rejectedByDirectorIdea.id}/moderate`, {
    method: 'POST',
    token: adminSession.token,
    expectedStatus: 200,
    body: { approved: true, comment: 'Voting enabled' },
  })
  await request(`/api/ideas/${rejectedByDirectorIdea.id}/vote`, {
    method: 'POST',
    token: adminSession.token,
    expectedStatus: 200,
    body: { value: 'for' },
  })
  await request(`/api/ideas/${rejectedByDirectorIdea.id}/vote`, {
    method: 'POST',
    token: employee1Session.token,
    expectedStatus: 200,
    body: { value: 'for' },
  })
  const reviewIdea = await request(`/api/ideas/${rejectedByDirectorIdea.id}/vote`, {
    method: 'POST',
    token: employee2Session.token,
    expectedStatus: 200,
    body: { value: 'for' },
  })
  assert(reviewIdea.status === 'director_review', 'Idea should reach director review')
  const rejectedByDirector = await request(`/api/ideas/${rejectedByDirectorIdea.id}/decision`, {
    method: 'POST',
    token: directorSession.token,
    expectedStatus: 200,
    body: { approved: false, comment: 'Budget is frozen this quarter' },
  })
  assert(rejectedByDirector.status === 'rejected_by_director', 'Director rejection did not archive idea')
  report.push('director rejection ok')

  const waitingForDirectorIdea = await createIdea(
    employee3Session.token,
    `AI automation optimization ${runId}`,
    'standard',
    'Автоматизация, цифровой контроль, экономия, оптимизация и улучшение качества процессов.',
  )
  await request(`/api/ideas/${waitingForDirectorIdea.id}/moderate`, {
    method: 'POST',
    token: adminSession.token,
    expectedStatus: 200,
    body: { approved: true, comment: 'Waiting for director review' },
  })
  await request(`/api/ideas/${waitingForDirectorIdea.id}/vote`, {
    method: 'POST',
    token: adminSession.token,
    expectedStatus: 200,
    body: { value: 'for' },
  })
  await request(`/api/ideas/${waitingForDirectorIdea.id}/vote`, {
    method: 'POST',
    token: employee1Session.token,
    expectedStatus: 200,
    body: { value: 'for' },
  })
  report.push('director review queue ok')

  await createIdea(
    employee1Session.token,
    `Limit idea two ${runId}`,
    'standard',
    'Second employee idea used for monthly limit coverage.',
  )
  await createIdea(
    employee1Session.token,
    `Limit idea three ${runId}`,
    'standard',
    'Third employee idea used for monthly limit coverage.',
  )
  await expectFailure('/api/ideas', {
    method: 'POST',
    token: employee1Session.token,
    expectedStatus: 409,
    expectedCode: 'CONFLICT',
    body: {
      title: `Limit idea four ${runId}`,
      description: 'This should exceed the monthly limit.',
      votingType: 'standard',
    },
  })
  report.push('monthly limit ok')

  const activeIdeas = await request('/api/ideas?scope=active&sort=recent&limit=5', {
    token: adminSession.token,
  })
  assert(activeIdeas.items.length >= 0, 'Active ideas endpoint returned invalid payload')

  const archiveIdeas = await request('/api/ideas?scope=archive&sort=recent&limit=10', {
    token: adminSession.token,
  })
  assert(
    archiveIdeas.items.some((idea) => idea.status === 'approved_by_director'),
    'Archive should contain approved_by_director idea',
  )
  assert(
    archiveIdeas.items.some((idea) => idea.status === 'rejected_by_admin'),
    'Archive should contain rejected_by_admin idea',
  )

  const pendingIdeas = await request('/api/ideas?status=pending_moderation&sort=recent&limit=10', {
    token: adminSession.token,
  })
  assert(Array.isArray(pendingIdeas.items), 'Pending moderation filter returned invalid payload')
  assert(
    pendingIdeas.items.some((idea) => idea.title === `Limit idea two ${runId}`),
    'Pending moderation filter should include unmoderated ideas',
  )

  const mineIdeas = await request('/api/ideas?scope=mine&sort=recent&limit=10', {
    token: employee1Session.token,
  })
  assert(mineIdeas.items.length >= 3, 'Mine scope should include employee-created ideas')

  const directorReviewIdeas = await request('/api/ideas?scope=director_review&sort=recent&limit=10', {
    token: directorSession.token,
  })
  assert(
    directorReviewIdeas.items.some((idea) => idea.id === waitingForDirectorIdea.id),
    'director_review scope should include the waiting idea',
  )

  const aiIdeas = await request('/api/ideas?scope=ai&sort=support&limit=8', {
    token: adminSession.token,
  })
  assert(
    aiIdeas.items.some((idea) => idea.id === waitingForDirectorIdea.id),
    'AI scope should include the AI-focused idea',
  )
  report.push('filters ok')

  await expectFailure('/api/ideas?scope=active&extra=1', {
    token: adminSession.token,
    expectedStatus: 400,
    expectedCode: 'VALIDATION_ERROR',
  })

  await request('/api/auth/logout', {
    method: 'POST',
    token: employee1Session.token,
    expectedStatus: 204,
  })
  await expectFailure('/api/auth/me', {
    token: employee1Session.token,
    expectedStatus: 401,
    expectedCode: 'UNAUTHORIZED',
  })
  report.push('logout invalidation ok')

  const employeesList = await request('/api/employees', { token: directorSession.token })
  assert(
    employeesList.items.some((item) => item.id === lateEmployee.id),
    'Late employee was not returned in employees list',
  )
  report.push('employees list ok')

  const concurrentIdea = await createIdea(
    adminSession.token,
    `Concurrent vote ${runId}`,
    'standard',
    'Concurrency coverage for advisory lock handling.',
  )
  await request(`/api/ideas/${concurrentIdea.id}/moderate`, {
    method: 'POST',
    token: adminSession.token,
    expectedStatus: 200,
    body: { approved: true, comment: 'Concurrency flow' },
  })

  const concurrentVoteResults = await Promise.all([
    request(`/api/ideas/${concurrentIdea.id}/vote`, {
      method: 'POST',
      token: adminSession.token,
      expectedStatus: 200,
      body: { value: 'for' },
    }),
    request(`/api/ideas/${concurrentIdea.id}/vote`, {
      method: 'POST',
      token: employee2Session.token,
      expectedStatus: 200,
      body: { value: 'for' },
    }),
  ])
  assert(concurrentVoteResults.every((result) => result.votes.support >= 1), 'Concurrent votes must succeed')

  const concurrentLogins = await Promise.all([
    loginByLogin(users.employee1.login, users.employee1.password),
    loginByLogin(users.employee1.login, users.employee1.password),
    loginByLogin(users.employee1.login, users.employee1.password),
  ])
  assert(concurrentLogins.every((session) => session.user.id === employee1.id), 'Concurrent logins returned wrong user')
  report.push('concurrency ok')

  const summary = { ok: true, baseUrl, report }

  if (reportFile) {
    fs.mkdirSync(path.dirname(reportFile), { recursive: true })
    fs.writeFileSync(reportFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exit(1)
})
