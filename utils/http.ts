import { NextRequest } from 'next/server';

/**
 * Parses the request body as JSON.
 * Returns null if the body is empty or malformed.
 */
export async function parseBody<T>(request: NextRequest): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Extracts a search parameter from the request URL.
 */
export function getQueryParam(
  request: NextRequest,
  key: string,
): string | null {
  return request.nextUrl.searchParams.get(key);
}

/**
 * Extracts multiple search parameters from the request URL.
 */
export function getQueryParams(
  request: NextRequest,
  keys: string[],
): Record<string, string | null> {
  const params: Record<string, string | null> = {};
  for (const key of keys) {
    params[key] = getQueryParam(request, key);
  }
  return params;
}

/**
 * Extracts pagination parameters from the request URL.
 * Falls back to sensible defaults.
 */
export function getPaginationParams(
  request: NextRequest,
): { page: number; limit: number } {
  const page = Math.max(1, Number(getQueryParam(request, 'page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(getQueryParam(request, 'limit')) || 20));
  return { page, limit };
}
