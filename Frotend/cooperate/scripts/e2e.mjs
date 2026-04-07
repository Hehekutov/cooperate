import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const args = process.argv.slice(2)

const findArg = (name) => {
  const direct = args.find((value) => value.startsWith(`${name}=`))
  if (direct) {
    return direct.slice(name.length + 1)
  }

  const index = args.indexOf(name)
  if (index >= 0 && args[index + 1]) {
    return args[index + 1]
  }

  return null
}

const baseUrl = (findArg('--base-url') ?? 'http://127.0.0.1:4173').replace(/\/$/u, '')
const reportPath = findArg('--report')
const outputDir = path.resolve(process.cwd(), '..', '..', 'output', 'playwright')
const runId = Date.now().toString()

const company = {
  name: `E2E Company ${runId}`,
  inn: `77${runId.slice(-8)}`,
  description: 'Browser automation company',
  directorName: `Director ${runId}`,
  directorLogin: `director_${runId}`,
  directorPosition: 'Director',
  phone: `+79${runId.slice(-9).padStart(9, '0')}`,
  password: 'Director123!',
}

const users = {
  admin: {
    fullName: `Admin ${runId}`,
    login: `admin_${runId}`,
    phone: `+79${String(Number(runId.slice(-9)) + 11).padStart(9, '0')}`,
    password: 'Admin123!',
    position: 'Office Administrator',
    roleLabel: 'Администратор',
  },
  employeeOne: {
    fullName: `Employee One ${runId}`,
    login: `employee1_${runId}`,
    phone: `+79${String(Number(runId.slice(-9)) + 22).padStart(9, '0')}`,
    password: 'Employee123!',
    position: 'Engineer',
    roleLabel: 'Сотрудник',
  },
  employeeTwo: {
    fullName: `Employee Two ${runId}`,
    login: `employee2_${runId}`,
    phone: `+79${String(Number(runId.slice(-9)) + 33).padStart(9, '0')}`,
    password: 'Employee123!',
    position: 'Analyst',
    roleLabel: 'Сотрудник',
  },
}

const ideaTitle = `Автоматизация цифровой заявки ${runId}`
const ideaDescription = 'Автоматизация и цифровой контроль ускорят работу, улучшат качество и эффективность.'

const report = {
  baseUrl,
  steps: [],
  artifacts: {},
}

const recordStep = async (name, fn) => {
  const startedAt = Date.now()

  try {
    await fn()
    report.steps.push({
      name,
      status: 'passed',
      durationMs: Date.now() - startedAt,
    })
  } catch (error) {
    report.steps.push({
      name,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } })

const closeModal = async () => {
  await page.keyboard.press('Escape').catch(() => {})
}

try {
  await recordStep('guest tabs and empty states', async () => {
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Архив обращений' }).click()
    await page.getByText('Архив пока пуст').waitFor()
    await page.getByRole('button', { name: 'Сотрудники' }).click()
    await page.getByText('Список сотрудников пуст').waitFor()
    await page.getByRole('button', { name: 'Обращения' }).click()
    await page.getByText('Приложение готово к первому запуску').waitFor()
  })

  await recordStep('register company through UI', async () => {
    await page.getByRole('button', { name: 'Создать компанию' }).first().click()
    await page.getByRole('dialog').waitFor()
    await page.getByLabel('Название компании').fill(company.name)
    await page.getByLabel('ИНН компании').fill(company.inn)
    await page.getByLabel('Логин директора').fill(company.directorLogin)
    await page.getByLabel('Описание компании').fill(company.description)
    await page.getByLabel('ФИО директора').fill(company.directorName)
    await page.getByLabel('Должность').fill(company.directorPosition)
    await page.getByLabel('Телефон').fill(company.phone)
    await page.getByLabel('Пароль').fill(company.password)
    await page.getByRole('button', { name: 'Создать компанию' }).last().click()
    await page.getByText('Компания зарегистрирована, можно добавлять сотрудников').waitFor()
    await page.getByText(`${company.directorName} · Директор`).waitFor()
  })

  await recordStep('director adds employees', async () => {
    for (const user of Object.values(users)) {
      await page.getByRole('button', { name: 'Добавить сотрудника' }).click()
      await page.getByLabel('ФИО').fill(user.fullName)
      await page.getByLabel('Логин').fill(user.login)
      await page.getByLabel('Телефон').fill(user.phone)
      await page.getByLabel('Должность').fill(user.position)
      await page.getByLabel('Роль').selectOption(user.roleLabel === 'Администратор' ? 'admin' : 'employee')
      await page.getByLabel('Пароль').fill(user.password)
      await page.getByRole('button', { name: 'Добавить сотрудника' }).last().click()
      await page.getByText('Сотрудник добавлен в компанию').waitFor()
    }

    await page.getByRole('button', { name: 'Сотрудники' }).click()
    await page.getByText(users.admin.fullName).waitFor()
    await page.getByText(users.employeeOne.fullName).waitFor()
    await page.getByText(users.employeeTwo.fullName).waitFor()
  })

  await recordStep('logout and invalid login error', async () => {
    await page.getByRole('button', { name: 'Выйти' }).click()
    await page.getByRole('button', { name: 'Войти' }).click()
    await page.getByLabel('Логин').fill(company.directorLogin)
    await page.getByLabel('Пароль').fill('wrong-password')
    await page.getByRole('button', { name: 'Войти' }).last().click()
    await page.getByText('Invalid login or password').waitFor()
    await closeModal()
  })

  await recordStep('employee creates idea', async () => {
    await page.getByRole('button', { name: 'Войти' }).click()
    await page.getByLabel('Логин').fill(users.employeeOne.login)
    await page.getByLabel('Пароль').fill(users.employeeOne.password)
    await page.getByRole('button', { name: 'Войти' }).last().click()
    await page.getByText(`${users.employeeOne.fullName} · Сотрудник`).waitFor()

    await page.getByRole('button', { name: 'Новое обращение' }).click()
    await page.getByLabel('Заголовок').fill(ideaTitle)
    await page.getByLabel('Описание идеи').fill(ideaDescription)
    await page.getByLabel('Тип голосования').selectOption('standard')
    await page.getByRole('button', { name: 'Отправить на модерацию' }).click()
    await page.getByText('Обращение отправлено на модерацию').waitFor()
    await page.getByText(ideaTitle).waitFor()
  })

  await recordStep('admin moderates idea', async () => {
    await page.getByRole('button', { name: 'Выйти' }).click()
    await page.getByRole('button', { name: 'Войти' }).click()
    await page.getByLabel('Логин').fill(users.admin.login)
    await page.getByLabel('Пароль').fill(users.admin.password)
    await page.getByRole('button', { name: 'Войти' }).last().click()
    await page.getByText(`${users.admin.fullName} · Администратор`).waitFor()
    await page.getByText(ideaTitle).waitFor()
    await page.getByRole('button', { name: 'Опубликовать' }).click()
    await page.getByLabel('Комментарий').fill('Идея готова к общему голосованию.')
    await page.getByRole('button', { name: 'Опубликовать' }).last().click()
    await page.getByText('Идея опубликована для голосования').waitFor()
    await page.getByText('AI-рекомендации').waitFor()
  })

  await recordStep('employees vote through UI', async () => {
    await page.getByRole('button', { name: 'Выйти' }).click()
    await page.getByRole('button', { name: 'Войти' }).click()
    await page.getByLabel('Логин').fill(users.employeeOne.login)
    await page.getByLabel('Пароль').fill(users.employeeOne.password)
    await page.getByRole('button', { name: 'Войти' }).last().click()
    await page.getByRole('button', { name: 'Голосовать' }).click()
    await page.getByRole('button', { name: 'Голосую за' }).click()
    await page.getByText('Голос "за" принят').waitFor()

    await page.getByRole('button', { name: 'Выйти' }).click()
    await page.getByRole('button', { name: 'Войти' }).click()
    await page.getByLabel('Логин').fill(users.employeeTwo.login)
    await page.getByLabel('Пароль').fill(users.employeeTwo.password)
    await page.getByRole('button', { name: 'Войти' }).last().click()
    await page.getByRole('button', { name: 'Голосовать' }).click()
    await page.getByRole('button', { name: 'Голосую за' }).click()
    await page.getByText('Голос "за" принят').waitFor()
  })

  await recordStep('director final decision and archive verification', async () => {
    await page.getByRole('button', { name: 'Выйти' }).click()
    await page.getByRole('button', { name: 'Войти' }).click()
    await page.getByLabel('Логин').fill(company.directorLogin)
    await page.getByLabel('Пароль').fill(company.password)
    await page.getByRole('button', { name: 'Войти' }).last().click()
    await page.getByText(`${company.directorName} · Директор`).waitFor()
    await page.getByText('Ожидают решения директора').waitFor()
    await page.getByRole('button', { name: 'Опубликовать' }).click()
    await page.getByLabel('Комментарий директора').fill('Поддержано и утверждено.')
    await page.getByRole('button', { name: 'Утвердить' }).click()
    await page.getByText('Директор утвердил исполнение идеи').waitFor()

    await page.getByRole('button', { name: 'Архив обращений' }).click()
    await page.getByText(ideaTitle).waitFor()
    await page.getByRole('button', { name: 'Сотрудники' }).click()
    await page.getByText(users.admin.fullName).waitFor()
  })

  fs.mkdirSync(outputDir, { recursive: true })
  const screenshotPath = path.join(outputDir, `frontend-e2e-${runId}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: true })
  report.artifacts.screenshot = screenshotPath
} finally {
  await browser.close()
}

if (reportPath) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

console.log(JSON.stringify(report, null, 2))
