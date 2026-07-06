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

// Thrown when authenticating a specific, previously-stored WebAuthn/PRF
// credential fails with NotAllowedError. WebAuthn reports both a genuine
// user-cancel and a lost/deleted platform credential ("No passkeys available")
// as NotAllowedError, so they are indistinguishable at the API level. This
// dedicated name lets the enable flow's repair-and-re-enroll fire instead of
// treating the failure as a plain user-cancel that dead-ends the feature.
export const WEB_AUTH_CREDENTIAL_UNAVAILABLE_ERROR =
  'web_auth_credential_unavailable';

export const PASSCODE_LENGTH = 6;
export const PASSCODE_PROTECTION_ATTEMPTS = 10;
export const PASSCODE_PROTECTION_ATTEMPTS_MESSAGE_SHOW_MAX = 5;
// Regex to match non-digit characters (used to filter out non-digits from passcode input)
export const PASSCODE_REGEX = /[^\d]/gm;
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
