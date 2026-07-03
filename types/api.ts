/**
 * Standard API response wrapper.
 */
export interface ApiResponse<T = unknown> {
  /** Whether the request succeeded */
  success: boolean;
  /** The response payload */
  data?: T;
  /** Human-readable message */
  message?: string;
}

/**
 * Paginated response wrapper.
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  /** Current page number */
  page: number;
  /** Items per page */
  limit: number;
  /** Total items available */
  total: number;
  /** Total number of pages */
  totalPages: number;
}

/**
 * Error response payload.
 */
export interface ErrorResponse {
  /** Always false */
  success: false;
  /** Error message */
  message: string;
  /** Error code for programmatic handling */
  code: string;
  /** Validation errors (if applicable) */
  errors?: Record<string, string[]>;
}
