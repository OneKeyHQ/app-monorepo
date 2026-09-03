import type { EHostSecurityLevel } from './discovery';

export enum ETransactionSecurityResultCode {
  UnableToAssess = 'unable_to_assess',
  NotSupported = 'not_supported',
  CheckFailed = 'check_failed',
}

export type ITransactionSecurityFeature = {
  level: EHostSecurityLevel;
  code: string;
  title?: string;
  content?: string;
  address?: string;
};

export type ITransactionSecurityDetail = {
  code: string;
  title?: string;
  content?: string;
  features: ITransactionSecurityFeature[];
};

export type ITransactionSecurityCheckResult = {
  level: EHostSecurityLevel;
  detail: ITransactionSecurityDetail;
};

export type ITransactionSecurityFeatureRaw = {
  level?: string;
  type?: string;
  code?: string;
  title?: string;
  content?: string;
  address?: string;
};

export type ITransactionSecurityCheckResultRaw = {
  level?: string;
  supported?: boolean;
  detail?: {
    code?: string;
    summaryCode?: string;
    title?: string;
    content?: string;
    features?: ITransactionSecurityFeatureRaw[];
  };
};

export type ITransactionSecurityJsonRpc = {
  method: string;
  params: unknown[];
};
