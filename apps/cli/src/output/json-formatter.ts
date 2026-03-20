import type { IErrorDetail } from '../errors';
import type {
  IErrorResponse,
  IOutputMetadata,
  ISuccessResponse,
} from '../types';

export function formatSuccess<T>(
  data: T,
  metadata?: Partial<IOutputMetadata>,
): ISuccessResponse<T> {
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

export function formatError(error: IErrorDetail): IErrorResponse {
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
