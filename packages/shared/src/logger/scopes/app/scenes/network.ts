import { ANALYTICS_EVENT_PATH } from '@onekeyhq/shared/src/analytics';
import { SENTRY_IPC } from '@onekeyhq/shared/src/modules3rdParty/sentry/basicOptions';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export const isEnableLogNetwork = (path = '') =>
  !(
    path.includes(ANALYTICS_EVENT_PATH) ||
    (platformEnv.isDesktop && path.includes(SENTRY_IPC))
  );

function stringifyDiagnosticValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value).slice(0, 240);
  }
  try {
    return JSON.stringify(value).slice(0, 240);
  } catch {
    return String(value).slice(0, 240);
  }
}

export class NetworkScene extends BaseScene {
  @LogToLocal({ level: 'debug' })
  public start(
    requestType: string,
    method = 'GET',
    path = '/',
    requestId?: string,
  ) {
    return `${requestType}:${method}:${path}, requestId: ${requestId || ''}`;
  }

  @LogToLocal({ level: 'debug' })
  public end({
    requestType,
    method = 'GET',
    path = '/',
    statusCode,
    requestId,
    responseCode = 0,
    responseErrorMessage,
  }: {
    requestType: string;
    method: string;
    path: string;
    statusCode: number;
    requestId?: string;
    responseCode?: number;
    responseErrorMessage?: string;
  }) {
    return `${requestType}:${method}:${path}:${statusCode}, requestId: ${
      requestId || ''
    }, responseCode: ${responseCode}, errorMessage: ${
      responseErrorMessage || ''
    }`;
  }

  @LogToLocal({ level: 'debug' })
  public error({
    requestType,
    method = 'GET',
    path = '/',
    statusCode,
    requestId,
    responseCode = 0,
    errorMessage,
  }: {
    requestType: string;
    method: string;
    path: string;
    statusCode: number;
    requestId?: string;
    responseCode?: number;
    errorMessage?: string;
  }) {
    return `${requestType}:${method}:${path}:${statusCode}, requestId: ${
      requestId || ''
    }, responseCode: ${responseCode}, errorMessage: ${errorMessage || ''}`;
  }

  @LogToLocal({ level: 'info' })
  public throttleDiagnostic(
    label: string,
    payload: Record<string, unknown> = {},
  ) {
    const payloadText = Object.entries(payload)
      .map(([key, value]) => [key, stringifyDiagnosticValue(value)] as const)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}=${value}`)
      .join(' ');
    return `[network-throttle-diagnostic] ${label}${
      payloadText ? ` ${payloadText}` : ''
    }`;
  }
}
