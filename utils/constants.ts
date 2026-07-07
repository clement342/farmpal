/**
 * Shared application constants.
 */

/** Default pagination values. */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/** HTTP status code labels. */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/** Common error codes used across the API. */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

/** Severity levels for diagnoses. */
export const SEVERITY_LEVELS = ['low', 'moderate', 'high', 'critical'] as const;

/** AI provider identifiers. */
export const AI_PROVIDERS = {
  OLLAMA: 'ollama',
  CLOUD: 'cloud',
} as const;
