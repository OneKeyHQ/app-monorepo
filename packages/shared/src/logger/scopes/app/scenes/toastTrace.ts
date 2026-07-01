import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

const TOAST_OFFLINE_GUARD_LOG_PREFIX = '[TOAST-OFFLINE-GUARD]';

type IToastTraceStringValue = string | number | boolean | null | undefined;

export type IToastTraceDecisionParams = {
  isInternetReachable: boolean | null | undefined;
  shouldSuppress: boolean;
  suppressReason?: string | null;
  method: string;
  title?: IToastTraceStringValue;
  message?: IToastTraceStringValue;
  errorCode?: IToastTraceStringValue;
  errorName?: IToastTraceStringValue;
  errorClassName?: IToastTraceStringValue;
  httpStatusCode?: number;
  hasRequestId: boolean;
  hasToastId: boolean;
};

export type IToastTraceAxiosNetworkErrorParams = {
  code?: IToastTraceStringValue;
  name?: IToastTraceStringValue;
  message?: IToastTraceStringValue;
  method?: IToastTraceStringValue;
  path?: IToastTraceStringValue;
  timeout?: IToastTraceStringValue;
  hasResponse: boolean;
  hasBaseURL: boolean;
};

export class ToastTraceScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public toastDecision(params: IToastTraceDecisionParams) {
    return {
      tracePrefix: TOAST_OFFLINE_GUARD_LOG_PREFIX,
      stage: 'toast-decision',
      ...params,
    };
  }

  @LogToLocal({ level: 'info' })
  public axiosNetworkError(params: IToastTraceAxiosNetworkErrorParams) {
    return {
      tracePrefix: TOAST_OFFLINE_GUARD_LOG_PREFIX,
      stage: 'axios-network-error',
      ...params,
    };
  }
}
