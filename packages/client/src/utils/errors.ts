export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public originalError?: Error,
    public userMessage?: string
  ) {
    super(message)
    this.name = 'AppError'
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      userMessage: this.userMessage,
    }
  }
}

export class PermissionError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(
      message,
      'PERMISSION_DENIED',
      403,
      originalError,
      'You do not have permission to perform this action'
    )
  }
}

export class NetworkError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(
      message,
      'NETWORK_ERROR',
      0,
      originalError,
      'Network connection failed. Please check your internet connection'
    )
  }
}

export class ValidationError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(message, 'VALIDATION_ERROR', 400, originalError, 'Invalid input provided')
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(message, 'AUTH_ERROR', 401, originalError, 'Authentication failed. Please log in again')
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(message, 'NOT_FOUND', 404, originalError, 'The requested resource was not found')
  }
}

/**
 * Error handler for consistent logging and user feedback
 * Classifies errors and provides user-friendly messages
 */
export function handleError(error: unknown, context: string): AppError {
  console.error(`[${context}]`, error)

  if (error instanceof AppError) {
    return error
  }

  if (error instanceof Error) {
    // Classify error based on name and message
    if (error.name === 'NotAllowedError' || error.message.includes('permission')) {
      return new PermissionError(error.message, error)
    }

    if (error.name === 'NotFoundError' || error.message.includes('not found')) {
      return new NotFoundError(error.message, error)
    }

    if (
      error.name === 'NetworkError' ||
      error.message.includes('network') ||
      error.message.includes('fetch')
    ) {
      return new NetworkError(error.message, error)
    }

    if (error.name === 'ValidationError' || error.message.includes('invalid')) {
      return new ValidationError(error.message, error)
    }

    if (error.name === 'AuthenticationError' || error.message.includes('auth')) {
      return new AuthenticationError(error.message, error)
    }

    return new AppError(error.message, 'UNKNOWN_ERROR', 500, error)
  }

  return new AppError(String(error), 'UNKNOWN_ERROR', 500)
}
