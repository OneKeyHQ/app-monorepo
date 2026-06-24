export type IDesktopNativeSafeStoragePublicKeyJwk = {
  kty: 'EC';
  crv: 'P-256';
  x: string;
  y: string;
};

export type IDesktopNativeSafeStorageOwner = {
  extensionId: string;
  clientId: string;
  publicKeyHash: string;
};

export type IDesktopNativeSafeStorageChallenge = {
  version: 1;
  method: 'safeStorageEncryptString' | 'safeStorageDecryptString';
  purpose: string;
  owner: IDesktopNativeSafeStorageOwner;
  timestamp: number;
  nonce: string;
  valueHash?: string;
  encryptedTextHash?: string;
};

export type IDesktopNativeSafeStorageAuth = {
  publicKeyJwk: IDesktopNativeSafeStoragePublicKeyJwk;
  challenge: IDesktopNativeSafeStorageChallenge;
  signature: string;
};

export type IDesktopNativeSafeStorageEncryptStringParams = {
  purpose: string;
  value: string;
  auth: IDesktopNativeSafeStorageAuth;
};

export type IDesktopNativeSafeStorageDecryptStringParams = {
  purpose: string;
  encryptedText: string;
  auth: IDesktopNativeSafeStorageAuth;
};

export type IDesktopNativeSafeStorageEnvelope = {
  version: 1;
  purpose: string;
  owner: IDesktopNativeSafeStorageOwner;
  value: string;
};

export type IDesktopNativeMessagingMethod =
  | 'ping'
  | 'safeStorageIsAvailable'
  | 'safeStorageEncryptString'
  | 'safeStorageDecryptString';

export type IDesktopNativeMessagingRequest = {
  id?: string;
  method: IDesktopNativeMessagingMethod;
  params?: unknown;
};

export type IDesktopNativeMessagingResponse<T = unknown> =
  | {
      id?: string;
      success: true;
      payload: T;
    }
  | {
      id?: string;
      success: false;
      error: {
        code: string;
        message: string;
        unsupported?: boolean;
      };
    };

export type IDesktopNativeMessagingErrorCode =
  | 'BAD_REQUEST'
  | 'INTERNAL_ERROR'
  | 'NATIVE_HOST_FORBIDDEN'
  | 'NATIVE_HOST_NO_RESPONSE'
  | 'NATIVE_HOST_UNAVAILABLE'
  | 'NATIVE_MESSAGING_API_UNAVAILABLE'
  | 'OWNER_AUTH_FAILED'
  | 'SAFE_STORAGE_DECRYPT_FAILED'
  | 'SAFE_STORAGE_UNAVAILABLE'
  | 'SAFE_STORAGE_VALUE_TOO_LARGE'
  | 'UNSUPPORTED';

export type IDesktopNativeMessagingCallResult<T> =
  | {
      supported: true;
      payload: T;
    }
  | {
      supported: false;
      reason?: string;
      code?: IDesktopNativeMessagingErrorCode | string;
    };
