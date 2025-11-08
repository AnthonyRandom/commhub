import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './app.css'
import { validateConfig } from './config/environment'

// Validate environment configuration before starting app
try {
  validateConfig()
} catch (error) {
  console.error('[Init] Configuration validation failed:', error)
  // In development, show error in UI. In production, this would have failed at build time.
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: monospace; background: #1a1a1a; color: #ff4444; min-height: 100vh;">
      <h1>Configuration Error</h1>
      <p>${error instanceof Error ? error.message : 'Unknown configuration error'}</p>
      <p style="margin-top: 20px; color: #888;">Please check your environment variables.</p>
    </div>
  `
  throw error
}

const container = document.getElementById('app')!
const root = createRoot(container)

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
