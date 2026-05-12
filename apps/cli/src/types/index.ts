export type IOutputMode = 'agent' | 'human' | 'quiet' | 'text';

export interface IOutputMetadata {
  duration_ms?: number;
  chain?: string;
  address?: string;
  count?: number;
  hasMore?: boolean;
  timestamp: string;
}

export interface ISuccessResponse<T> {
  ok: true;
  data: T;
}

export interface IErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type { IErrorDetail } from '../errors/app-error';
export type { IResolvedToken } from './token';
