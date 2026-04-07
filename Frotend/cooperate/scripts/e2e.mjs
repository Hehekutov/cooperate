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
const banner = page.getByRole('banner')
const main = page.getByRole('main')
const dialog = () => page.getByRole('dialog')

const closeModal = async () => {
  await page.locator('.modal-backdrop').click({ position: { x: 8, y: 8 } }).catch(() => {})
  await dialog().waitFor({ state: 'hidden' }).catch(() => {})
}

const waitForGuestMode = async () => {
  await page.getByText('Гостевой режим').waitFor()
  await banner.getByRole('button', { name: 'Войти' }).waitFor()
}

const submitDialogForm = async () => {
  await dialog().locator('form').evaluate((form) => {
    form.requestSubmit()
  })
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
    await dialog().waitFor()
    await dialog().getByLabel('Название компании').fill(company.name)
    await dialog().getByLabel('ИНН компании').fill(company.inn)
    await dialog().getByLabel('Логин директора').fill(company.directorLogin)
    await dialog().getByLabel('Описание компании').fill(company.description)
    await dialog().getByLabel('ФИО директора').fill(company.directorName)
    await dialog().getByLabel('Должность').fill(company.directorPosition)
    await dialog().getByLabel('Телефон').fill(company.phone)
    await dialog().getByLabel('Пароль').fill(company.password)
    await dialog().getByRole('button', { name: 'Создать компанию' }).click()
    await dialog().waitFor({ state: 'hidden' })
    await page.getByText('Компания зарегистрирована, можно добавлять сотрудников').waitFor()
    await page.getByText(`${company.directorName} · Директор`).waitFor()
  })

  await recordStep('director adds employees', async () => {
    for (const user of Object.values(users)) {
      await main.getByRole('button', { name: 'Добавить сотрудника' }).click()
      await dialog().waitFor()
      await dialog().getByLabel('ФИО').fill(user.fullName)
      await dialog().getByLabel('Логин').fill(user.login)
      await dialog().getByLabel('Телефон').fill(user.phone)
      await dialog().getByLabel('Должность').fill(user.position)
      await dialog().getByRole('combobox').first().selectOption(
        user.roleLabel === 'Администратор' ? 'admin' : 'employee',
      )
      await dialog().getByLabel('Пароль').fill(user.password)
      await dialog().getByRole('button', { name: 'Добавить сотрудника' }).click()
      await page.getByText('Сотрудник добавлен в компанию').waitFor()
      await dialog().waitFor({ state: 'hidden' })
    }

    await page.getByRole('button', { name: 'Сотрудники' }).click()
    await page.getByText(users.admin.fullName).first().waitFor()
    await page.getByText(users.employeeOne.fullName).first().waitFor()
    await page.getByText(users.employeeTwo.fullName).first().waitFor()
  })

  await recordStep('logout and invalid login error', async () => {
    await page.getByRole('button', { name: 'Выйти' }).click()
    await waitForGuestMode()
    let errorVisible = false

    for (let attempt = 0; attempt < 2 && !errorVisible; attempt += 1) {
      await banner.getByRole('button', { name: 'Войти' }).click()
      await dialog().waitFor()
      await dialog().getByLabel('Логин').fill(company.directorLogin)
      await dialog().getByLabel('Пароль').fill('wrong-password')
      await submitDialogForm()

      try {
        await page.getByText('Invalid login or password').waitFor({ timeout: 5_000 })
        errorVisible = true
      } catch {
        await closeModal()
      }
    }

    if (!errorVisible) {
      throw new Error('Invalid login error was not shown')
    }

    await closeModal()
  })

  await recordStep('employee creates idea', async () => {
    await banner.getByRole('button', { name: 'Войти' }).click()
    await dialog().waitFor()
    await dialog().getByLabel('Логин').fill(users.employeeOne.login)
    const passwordField = dialog().getByLabel('Пароль')
    await passwordField.fill(users.employeeOne.password)
    await submitDialogForm()
    await dialog().waitFor({ state: 'hidden' })
    await page.getByText(`${users.employeeOne.fullName} · Сотрудник`).waitFor()

    await main.getByRole('button', { name: 'Новое обращение' }).click()
    await dialog().waitFor()
    await dialog().getByLabel('Заголовок').fill(ideaTitle)
    await dialog().getByLabel('Описание идеи').fill(ideaDescription)
    await dialog().getByLabel('Тип голосования').selectOption('standard')
    await dialog().getByRole('button', { name: 'Отправить на модерацию' }).click()
    await dialog().waitFor({ state: 'hidden' })
    await page.getByText('Обращение отправлено на модерацию').waitFor()
    await page.getByText(ideaTitle).first().waitFor()
  })

  await recordStep('admin moderates idea', async () => {
    await page.getByRole('button', { name: 'Выйти' }).click()
    await waitForGuestMode()
    await banner.getByRole('button', { name: 'Войти' }).click()
    await dialog().waitFor()
    await dialog().getByLabel('Логин').fill(users.admin.login)
    const passwordField = dialog().getByLabel('Пароль')
    await passwordField.fill(users.admin.password)
    await submitDialogForm()
    await dialog().waitFor({ state: 'hidden' })
    await page.getByText(`${users.admin.fullName} · Администратор`).waitFor()
    await page.getByText(ideaTitle).first().waitFor()
    await page.getByRole('button', { name: 'Опубликовать' }).first().click()
    await dialog().waitFor()
    await dialog().getByLabel('Комментарий').fill('Идея готова к общему голосованию.')
    await dialog().getByRole('button', { name: 'Опубликовать' }).click()
    await dialog().waitFor({ state: 'hidden' })
    await page.getByText('Идея опубликована для голосования').waitFor()
    await page.getByText('AI-рекомендации').waitFor()
  })

  await recordStep('employees vote through UI', async () => {
    await page.getByRole('button', { name: 'Выйти' }).click()
    await waitForGuestMode()
    await banner.getByRole('button', { name: 'Войти' }).click()
    await dialog().waitFor()
    await dialog().getByLabel('Логин').fill(users.employeeOne.login)
    const employeeOnePasswordField = dialog().getByLabel('Пароль')
    await employeeOnePasswordField.fill(users.employeeOne.password)
    await submitDialogForm()
    await dialog().waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'Голосовать' }).first().click()
    await dialog().waitFor()
    await dialog().getByRole('button', { name: 'Голосую за' }).click()
    await dialog().waitFor({ state: 'hidden' })
    await page.getByText('Голос "за" принят').waitFor()

    await page.getByRole('button', { name: 'Выйти' }).click()
    await waitForGuestMode()
    await banner.getByRole('button', { name: 'Войти' }).click()
    await dialog().waitFor()
    await dialog().getByLabel('Логин').fill(users.employeeTwo.login)
    const employeeTwoPasswordField = dialog().getByLabel('Пароль')
    await employeeTwoPasswordField.fill(users.employeeTwo.password)
    await submitDialogForm()
    await dialog().waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'Голосовать' }).first().click()
    await dialog().waitFor()
    await dialog().getByRole('button', { name: 'Голосую за' }).click()
    await dialog().waitFor({ state: 'hidden' })
    await page.getByText('Голос "за" принят').waitFor()
  })

  await recordStep('director final decision and archive verification', async () => {
    await page.getByRole('button', { name: 'Выйти' }).click()
    await waitForGuestMode()
    await banner.getByRole('button', { name: 'Войти' }).click()
    await dialog().waitFor()
    await dialog().getByLabel('Логин').fill(company.directorLogin)
    const passwordField = dialog().getByLabel('Пароль')
    await passwordField.fill(company.password)
    await submitDialogForm()
    await dialog().waitFor({ state: 'hidden' })
    await page.getByText(`${company.directorName} · Директор`).waitFor()
    await page.getByText('Ожидают решения директора').waitFor()
    await page.getByRole('button', { name: 'Опубликовать' }).first().click()
    await dialog().waitFor()
    await dialog().getByLabel('Комментарий директора').fill('Поддержано и утверждено.')
    await dialog().getByRole('button', { name: 'Утвердить' }).click()
    await dialog().waitFor({ state: 'hidden' })
    await page.getByText('Директор утвердил исполнение идеи').waitFor()

    await page.getByRole('button', { name: 'Архив обращений' }).click()
    await page.getByText(ideaTitle).first().waitFor()
    await page.getByRole('button', { name: 'Сотрудники' }).click()
    await page.getByText(users.admin.fullName).first().waitFor()
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
