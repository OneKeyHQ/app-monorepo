export enum EPasswordVerifyStatus {
  DEFAULT = 'default',
  VERIFYING = 'verifying',
  VERIFIED = 'verified',
  ERROR = 'error',
}

export type IPasswordSecuritySession = {
  startAt: number;
  timeout: number;
  lastVisit: Record<string, number>;
};
