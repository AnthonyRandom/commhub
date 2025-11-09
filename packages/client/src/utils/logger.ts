export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  context: string
  message: string
  data?: any
}

class Logger {
  private isDev = import.meta.env.DEV
  private logs: LogEntry[] = []
  private maxLogs = 1000

  private log(level: LogLevel, context: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data,
    }

    // Store in memory (for debugging)
    this.logs.push(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // Console output
    const prefix = `[${context}]`
    const logData = data !== undefined ? [prefix, message, data] : [prefix, message]

    switch (level) {
      case 'debug':
        if (this.isDev) console.debug(...logData)
        break
      case 'info':
        console.info(...logData)
        break
      case 'warn':
        console.warn(...logData)
        break
      case 'error':
        console.error(...logData)
        // In production, send to error tracking service (Sentry, etc.)
        break
    }
  }

  debug(context: string, message: string, data?: any) {
    this.log('debug', context, message, data)
  }

  info(context: string, message: string, data?: any) {
    this.log('info', context, message, data)
  }

  warn(context: string, message: string, data?: any) {
    this.log('warn', context, message, data)
  }

  error(context: string, message: string, error?: Error | any) {
    this.log('error', context, message, error)
  }

  /**
   * Get all logs or filter by level
   */
  getLogs(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logs.filter((log) => log.level === level)
    }
    return [...this.logs]
  }

  /**
   * Clear all logs from memory
   */
  clearLogs() {
    this.logs = []
  }

  /**
   * Download logs as JSON file for debugging
   */
  downloadLogs() {
    const blob = new Blob([JSON.stringify(this.logs, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `commhub-logs-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Get log statistics
   */
  getStats() {
    const stats = {
      total: this.logs.length,
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
    }

    this.logs.forEach((log) => {
      stats[log.level]++
    })

    return stats
  }
}

export const logger = new Logger()
export default logger
