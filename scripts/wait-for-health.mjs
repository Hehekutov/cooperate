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

const url = findArg('--url')

if (!url) {
  throw new Error('Missing --url')
}

const startedAt = Date.now()

while (Date.now() - startedAt < 30000) {
  try {
    const response = await fetch(url)
    if (response.ok) {
      process.exit(0)
    }
  } catch {
    // wait for listener
  }

  await new Promise((resolve) => {
    setTimeout(resolve, 500)
  })
}

throw new Error(`Timed out waiting for ${url}`)
