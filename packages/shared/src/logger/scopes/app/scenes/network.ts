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
}
