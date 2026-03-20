import type { ErrorResponse, OutputMetadata, SuccessResponse } from '../types';
import type { ErrorDetail } from '../errors';

export function formatSuccess<T>(
  data: T,
  metadata?: Partial<OutputMetadata>,
): SuccessResponse<T> {
  return {
    status: 'success',
    api_version: '1',
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  };
}

export function formatError(error: ErrorDetail): ErrorResponse {
  return {
    status: 'error',
    api_version: '1',
    error: {
      code: error.code,
      message: error.message,
      suggestion: error.suggestion,
      ...(error.details ? { details: error.details } : {}),
    },
  };
}
