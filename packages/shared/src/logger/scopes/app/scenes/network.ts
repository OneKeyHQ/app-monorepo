import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type {
  IApiAvailabilityResultParams,
  IWebSocketConnectionAttemptParams,
  IWebSocketConnectionClosedParams,
  IWebSocketConnectionResultParams,
  IWebViewAvailabilityResultParams,
} from '../types';

export { isEnableLogNetwork } from './networkFilter';

export class NetworkScene extends BaseScene {
  /**
   * Reports a sampled, low-cardinality API result without request payloads,
   * query parameters, raw URLs, addresses, or free-form error messages.
   */
  @LogToServer()
  @LogToLocal({ level: 'debug' })
  public apiAvailabilityResult(params: IApiAvailabilityResultParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public webSocketConnectionAttempt(params: IWebSocketConnectionAttemptParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public webSocketConnectionResult(params: IWebSocketConnectionResultParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public webSocketConnectionClosed(params: IWebSocketConnectionClosedParams) {
    return params;
  }

  /**
   * Reports a sampled WebView terminal result without raw URLs, page titles,
   * navigation history, or page content.
   */
  @LogToServer()
  @LogToLocal()
  public webViewAvailabilityResult(params: IWebViewAvailabilityResultParams) {
    return params;
  }

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
