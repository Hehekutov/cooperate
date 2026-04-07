#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const baseUrl = (process.env.BASE_URL ?? 'http://127.0.0.1:5071').replace(/\/$/, '')
const runId = process.env.TEST_RUN_ID ?? Date.now().toString()
const reportFile = process.env.REPORT_FILE

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const average = (values) => Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
const max = (values) => Number(Math.max(...values).toFixed(2))
const percentile = (values, fraction) => {
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))
  return Number(sorted[index].toFixed(2))
}

async function request(path, { method = 'GET', token, body, expectedStatus = 200 } = {}) {
  const headers = {}

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const startedAt = performance.now()
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  const elapsedMs = Number((performance.now() - startedAt).toFixed(2))
  const payload = text ? JSON.parse(text) : null

  if (response.status !== expectedStatus) {
    throw new Error(
      `${method} ${path} expected ${expectedStatus}, got ${response.status}: ${text || '<empty>'}`,
    )
  }

  return { elapsedMs, data: payload?.data ?? payload }
}

async function main() {
  const register = await request('/api/auth/register-company', {
    method: 'POST',
    expectedStatus: 201,
    body: {
      companyName: `Perf Company ${runId}`,
      companyInn: '7707654321',
      companyDescription: 'Perf probe',
      directorName: `Perf Director ${runId}`,
      directorLogin: `perf_director_${runId}`,
      directorPosition: 'Director',
      phone: `+7${String(7000000000 + Number(runId.slice(-9))).slice(-10)}`,
      password: 'Director123!',
    },
  })
  const directorToken = register.data.token

  const admin = await request('/api/employees', {
    method: 'POST',
    token: directorToken,
    expectedStatus: 201,
    body: {
      fullName: `Perf Admin ${runId}`,
      login: `perf_admin_${runId}`,
      phone: `+7${String(7100000000 + Number(runId.slice(-9))).slice(-10)}`,
      password: 'Admin123!',
      role: 'admin',
      position: 'Admin',
    },
  })

  const employees = []
  for (let index = 0; index < 5; index += 1) {
    const employee = await request('/api/employees', {
      method: 'POST',
      token: directorToken,
      expectedStatus: 201,
      body: {
        fullName: `Perf Employee ${index} ${runId}`,
        login: `perf_employee_${index}_${runId}`,
        phone: `+7${String(7200000000 + Number(runId.slice(-8)) + index).slice(-10)}`,
        password: 'Employee123!',
        role: 'employee',
        position: 'Engineer',
      },
    })
    employees.push(employee.data)
  }

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    expectedStatus: 200,
    body: { login: admin.data.login, password: 'Admin123!' },
  })

  const employeeSessions = []
  for (const employee of employees) {
    const session = await request('/api/auth/login', {
      method: 'POST',
      expectedStatus: 200,
      body: { login: employee.login, password: 'Employee123!' },
    })
    employeeSessions.push(session.data)
  }

  const idea = await request('/api/ideas', {
    method: 'POST',
    token: employeeSessions[0].token,
    expectedStatus: 201,
    body: {
      title: `Perf idea ${runId}`,
      description: 'Measure vote latency',
      votingType: 'standard',
    },
  })

  await request(`/api/ideas/${idea.data.id}/moderate`, {
    method: 'POST',
    token: adminLogin.data.token,
    expectedStatus: 200,
    body: { approved: true, comment: 'Perf run' },
  })

  const loginSamples = []
  for (let index = 0; index < 5; index += 1) {
    const sample = await request('/api/auth/login', {
      method: 'POST',
      expectedStatus: 200,
      body: { login: employees[0].login, password: 'Employee123!' },
    })
    loginSamples.push(sample.elapsedMs)
  }

  const listSamples = []
  for (let index = 0; index < 5; index += 1) {
    const sample = await request('/api/ideas?scope=active&sort=recent&limit=12', {
      token: adminLogin.data.token,
    })
    listSamples.push(sample.elapsedMs)
  }

  const voteSamples = []
  for (let index = 1; index < employeeSessions.length; index += 1) {
    const sample = await request(`/api/ideas/${idea.data.id}/vote`, {
      method: 'POST',
      token: employeeSessions[index].token,
      expectedStatus: 200,
      body: { value: index % 2 === 0 ? 'against' : 'for' },
    })
    voteSamples.push(sample.elapsedMs)
  }

  const concurrentStartedAt = performance.now()
  const concurrentResults = await Promise.all(
    employees.slice(0, 3).map((employee) =>
      request('/api/auth/login', {
        method: 'POST',
        expectedStatus: 200,
        body: { login: employee.login, password: 'Employee123!' },
      }),
    ),
  )
  const concurrentLoginTotalMs = Number((performance.now() - concurrentStartedAt).toFixed(2))
  assert(concurrentResults.length === 3, 'Concurrent logins did not complete')

  const thresholds = {
    loginAvgMs: 300,
    listIdeasP95Ms: 750,
    voteP95Ms: 750,
    concurrentLoginsTotalMs: 1000,
  }

  const summary = {
    baseUrl,
    login: {
      avgMs: average(loginSamples),
      p95Ms: percentile(loginSamples, 0.95),
      maxMs: max(loginSamples),
      samples: loginSamples,
    },
    listIdeas: {
      avgMs: average(listSamples),
      p95Ms: percentile(listSamples, 0.95),
      maxMs: max(listSamples),
      samples: listSamples,
    },
    vote: {
      avgMs: average(voteSamples),
      p95Ms: percentile(voteSamples, 0.95),
      maxMs: max(voteSamples),
      samples: voteSamples,
    },
    concurrency: { concurrentLogins: 3, totalMs: concurrentLoginTotalMs },
    thresholds,
  }

  summary.optimizeNow =
    summary.login.avgMs > thresholds.loginAvgMs ||
    summary.listIdeas.p95Ms > thresholds.listIdeasP95Ms ||
    summary.vote.p95Ms > thresholds.voteP95Ms ||
    summary.concurrency.totalMs > thresholds.concurrentLoginsTotalMs

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
