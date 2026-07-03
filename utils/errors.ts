/**
 * Base application error class.
 * All domain errors should extend this class.
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Error thrown when request validation fails.
 */
export class ValidationError extends AppError {
  constructor(
    message: string = 'Validation failed',
    details?: Record<string, unknown>,
  ) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when a requested resource is not found.
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Error thrown when the AI service is unavailable.
 */
export class AIServiceError extends AppError {
  constructor(message: string = 'AI service is unavailable') {
    super(message, 'AI_SERVICE_ERROR', 503);
    this.name = 'AIServiceError';
  }
}
