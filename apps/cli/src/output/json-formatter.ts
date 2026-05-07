import { formatOk as formatCliOk } from './format';
import { redactSensitiveText } from './redact';

import type { IErrorDetail } from '../errors';
import type {
  IErrorResponse,
  IOutputMetadata,
  ISuccessResponse,
} from '../types';

export function formatSuccess<T>(
  data: T,
  _metadata?: Partial<IOutputMetadata>,
): ISuccessResponse<T> {
  return JSON.parse(formatCliOk(data, 'json')) as ISuccessResponse<T>;
}

export function formatError(error: IErrorDetail): IErrorResponse {
  return {
    ok: false,
    error: {
      code: error.code,
      message: redactSensitiveText(error.message),
    },
  };
}
