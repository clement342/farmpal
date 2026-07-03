import { NextResponse } from 'next/server';
import type { ApiResponse, ErrorResponse, PaginatedResponse } from '@/types';

/**
 * Creates a successful API response.
 *
 * @param data - The response payload
 * @param message - Optional success message
 * @param status - HTTP status code (default 200)
 */
export function successResponse<T>(
  data: T,
  message?: string,
  status: number = 200,
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    { success: true, data, message },
    { status },
  );
}

/**
 * Creates a paginated API response.
 *
 * @param data - Array of items
 * @param total - Total item count
 * @param page - Current page
 * @param limit - Items per page
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): NextResponse<PaginatedResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

/**
 * Creates an error API response.
 *
 * @param message - Human-readable error message
 * @param code - Programmatic error code
 * @param status - HTTP status code
 * @param errors - Optional field-level validation errors
 */
export function errorResponse(
  message: string,
  code: string = 'INTERNAL_ERROR',
  status: number = 500,
  errors?: Record<string, string[]>,
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    { success: false, message, code, ...(errors ? { errors } : {}) },
    { status },
  );
}
