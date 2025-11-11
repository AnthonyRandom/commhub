// Polyfill process.nextTick for browser compatibility with simple-peer
if (typeof process === 'undefined') {
  ;(window as any).process = {
    env: {},
    nextTick: (fn: Function, ...args: any[]) => setTimeout(() => fn(...args), 0),
  }
} else if (!process.nextTick) {
  process.nextTick = (fn: Function, ...args: any[]) => setTimeout(() => fn(...args), 0)
}

import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './app.css'
import { validateConfig } from './config/environment'
import { logger } from './utils/logger'

// Validate environment configuration before starting app
try {
  validateConfig()
  logger.info('Init', 'Configuration validated successfully')
} catch (error) {
  logger.error('Init', 'Configuration validation failed', { error })
  // In development, show error in UI. In production, this would have failed at build time.
  const errorMessage = error instanceof Error ? error.message : 'Unknown configuration error'
  // Escape HTML to prevent XSS
  const escapedMessage = errorMessage
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: monospace; background: #1a1a1a; color: #ff4444; min-height: 100vh;">
      <h1>Configuration Error</h1>
      <p>${escapedMessage}</p>
      <p style="margin-top: 20px; color: #888;">Please check your environment variables.</p>
    </div>
  `
  throw error
}

const container = document.getElementById('app')!
const root = createRoot(container)

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
