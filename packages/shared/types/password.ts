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

export interface IPasswordRes {
  password: string;
}

export enum EPasswordPromptType {
  PASSWORD_SETUP = 'setup',
  PASSWORD_VERIFY = 'verify',
}

export enum EPasswordMode {
  PASSCODE = 'passcode',
  PASSWORD = 'password',
}

export const BIOLOGY_AUTH_CANCEL_ERROR = 'user_cancel';

export const PASSCODE_LENGTH = 6;
export const PASSCODE_PROTECTION_ATTEMPTS = 10;
export const PASSCODE_PROTECTION_ATTEMPTS_MESSAGE_SHOW_MAX = 5;
export const PASSCODE_PROTECTION_ATTEMPTS_PER_MINUTE_MAP: Record<
  string,
  number
> = {
  '5': 2,
  '6': 10,
  '7': 30,
  '8': 60,
  '9': 180,
};

export const BIOLOGY_AUTH_ATTEMPTS_FACE = 1;
export const BIOLOGY_AUTH_ATTEMPTS_FINGERPRINT = 2;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
