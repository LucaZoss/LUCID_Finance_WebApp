/**
 * Error handling utilities
 * Provides type-safe error message extraction
 */

/**
 * Extract error message from unknown error type
 * Replaces catch (error: any) pattern with type-safe error handling
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unknown error occurred';
}

/**
 * Extract API error message from axios error response
 */
export function getApiErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as any).response;
    if (response?.data?.detail) {
      return response.data.detail;
    }
  }
  return getErrorMessage(error);
}
