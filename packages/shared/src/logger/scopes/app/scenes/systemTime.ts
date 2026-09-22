import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export type ISystemTimeCheckSource =
  | 'health-check'
  | 'axios'
  | 'fetch'
  | 'cloud-sync'
  | 'server-update'
  | 'estimated';

export type ISystemTimeRefreshResult =
  | 'success'
  | 'missing-date'
  | 'invalid-date'
  | 'request-error';

export class SystemTimeScene extends BaseScene {
  @LogToLocal()
  public check(params: {
    observedAt: number;
    platform?: string;
    runtime: string;
    source: ISystemTimeCheckSource;
    responseHost?: string;
    requestId?: string;
    previousStatus: string;
    status: string;
    localTime: number;
    serverTime?: number;
    differenceMs?: number;
    thresholdMs: number;
    appBuildTime: number;
    lastServerTime?: number;
    estimateBase?: number;
    localTimeAtBaseline?: number;
    monotonicTime?: number;
    monotonicTimeAtBaseline?: number;
    wallElapsedMs?: number;
    monotonicElapsedMs?: number;
    clockElapsedDifferenceMs?: number;
  }) {
    return params;
  }

  @LogToLocal()
  public refresh(params: {
    startedAt: number;
    completedAt: number;
    platform?: string;
    runtime: string;
    result: ISystemTimeRefreshResult;
    wallDurationMs: number;
    monotonicDurationMs?: number;
    serverTime?: number;
    httpStatus?: number;
    requestId?: string;
    errorCode?: string;
  }) {
    return params;
  }

  @LogToLocal()
  public dialogShown(params: { observedAt: number }) {
    return params;
  }
}
