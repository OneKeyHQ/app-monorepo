export type OutputMode = 'agent' | 'human' | 'quiet';

export interface OutputMetadata {
  duration_ms?: number;
  chain?: string;
  timestamp: string;
}

export interface SuccessResponse<T> {
  status: 'success';
  api_version: '1';
  data: T;
  metadata: OutputMetadata;
}

export interface ErrorResponse {
  status: 'error';
  api_version: '1';
  error: {
    code: string;
    message: string;
    suggestion: string;
    details?: Record<string, unknown>;
  };
}

export type { ErrorDetail } from '../errors/app-error';
