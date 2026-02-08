const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: { retries?: number; baseDelayMs?: number } = {}
) => {
  const retries = options.retries ?? 2
  const baseDelayMs = options.baseDelayMs ?? 200

  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= retries) throw error
      const delay = baseDelayMs * Math.pow(2, attempt)
      await sleep(delay)
      attempt += 1
    }
  }
}
