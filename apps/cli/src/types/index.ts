export type IOutputMode = 'agent' | 'human' | 'quiet';

export interface IOutputMetadata {
  duration_ms?: number;
  chain?: string;
  address?: string;
  count?: number;
  hasMore?: boolean;
  timestamp: string;
}

export interface ISuccessResponse<T> {
  status: 'success';
  api_version: '1';
  data: T;
  metadata: IOutputMetadata;
}

export interface IErrorResponse {
  status: 'error';
  api_version: '1';
  error: {
    code: string;
    message: string;
    suggestion: string;
    details?: Record<string, unknown>;
  };
}

export type { IErrorDetail } from '../errors/app-error';
export type { IResolvedToken } from './token';
