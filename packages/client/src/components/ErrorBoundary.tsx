import { Component, ErrorInfo, ReactNode } from 'react'
import { logger } from '../utils/logger'
import { handleError, AppError } from '../utils/errors'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to our logging service
    logger.error('ErrorBoundary', 'React error boundary caught an error', {
      error: error.message,
      componentStack: errorInfo.componentStack,
      errorStack: error.stack,
    })

    // Handle the error (which will also log to console with proper formatting)
    handleError(error, 'ErrorBoundary')

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      const error = this.state.error
      const isAppError = error instanceof AppError

      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-900 p-4">
          <div className="w-full max-w-md rounded-lg bg-gray-800 p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-red-500/20 p-3">
                <svg
                  className="h-6 w-6 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Something went wrong</h2>
                {isAppError && (
                  <p className="text-sm text-gray-400">Error Code: {(error as AppError).code}</p>
                )}
              </div>
            </div>

            <div className="mb-4 rounded bg-gray-900/50 p-4">
              <p className="text-sm text-gray-300">
                {error?.message || 'An unexpected error occurred'}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 transition-colors"
              >
                Reload Page
              </button>
            </div>

            {import.meta.env.DEV && error?.stack && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-300">
                  Stack Trace (Development Only)
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-900/50 p-2 text-xs text-gray-400">
                  {error.stack}
                </pre>
              </details>
            )}

            <div className="mt-4 text-center">
              <button
                onClick={() => logger.downloadLogs()}
                className="text-xs text-gray-400 hover:text-gray-300 underline"
              >
                Download Debug Logs
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
