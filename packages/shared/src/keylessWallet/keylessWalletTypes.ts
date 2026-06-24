import type { JWTPayload } from 'jose';

export type IKeylessWalletShare = string; // base64 string

export type IKeylessWalletUserInfo = {
  onekeyIdEmail: string;
  onekeyIdUserId: string;
};

export type IKeylessBackendShare = {
  encryptedMnemonic: string;
  backendShare: string;
  // pinSalt: string; // TODO
  juiceboxShareX: number; // x-coordinate of the juicebox share for recovery
};

export type IKeylessJuiceboxShare = {
  ownerId: string;
  pin: string;
  juiceboxShare: string;
  backendShareX: number; // x-coordinate of the backend share for recovery
};

export type ISupabaseJWTPayload = JWTPayload & {
  app_metadata: {
    /*
     Do not use this field as the final Provider. If a user uses the same Gmail address for both Apple and Google, this field will always default to the first platform used for login.
     For example:
     1. If the user first logs in using Google, the Provider will permanently remain as Google.
     2. Even if they subsequently log in using Apple, the field will not update to reflect Apple.
     This remains the case as long as the same Gmail address is associated with both the Apple and Google accounts.
    */
    provider: string;
  };
  user_metadata: {
    sub: string;
    iss: string;
  };
};
