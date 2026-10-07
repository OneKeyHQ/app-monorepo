import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { IAvailabilitySnapshotParams } from '../types';

export { isEnableLogNetwork } from './networkFilter';

export class NetworkScene extends BaseScene {
  /**
   * Aggregated client API availability counters for one or more time windows.
   * Only availabilityAggregator emits it, at most once per
   * AVAILABILITY_MIN_SEND_GAP_MS (2h) per runtime, so volume does not scale
   * with request count or failure storms. Params are numeric counters plus
   * sanitized failure details: no URLs, query strings, addresses, payloads,
   * device identifiers or free-form errors.
   */
  @LogToServer({ level: 'info', waitForServer: true })
  @LogToLocal({ level: 'debug' })
  private availabilitySnapshot(params: IAvailabilitySnapshotParams) {
    return params;
  }

  public reportAvailabilitySnapshot(
    params: IAvailabilitySnapshotParams,
  ): Promise<void> {
    return this.availabilitySnapshot(params) as unknown as Promise<void>;
  }

  /**
   * Why a flush did or did not send, so an aggregator that goes quiet can be
   * diagnosed from an exported log. Local only: fixed tokens, no user data.
   */
  @LogToLocal({ level: 'debug' })
  public availabilityFlush(reason: string, result: string) {
    return `${reason} -> ${result}`;
  }

  /** Why the network type could not be read. Local only, fixed tokens. */
  @LogToLocal({ level: 'debug' })
  public availabilityNetworkType(reason: string) {
    return `unread: ${reason}`;
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
