// Below codes are comments to note algorithm and digest method used.
// const ALGORITHM = 'aes-256-cbc';
// const PBKDF2_DIGEST_METHOD = 'sha256';
export const PBKDF2_NUM_OF_ITERATIONS = 5000; // bitwarden: 600_000  1password: 650_000   last-pass: 600_000
// export const PBKDF2_NUM_OF_ITERATIONS = 600_000;
export const PBKDF2_KEY_LENGTH = 32;
export const PBKDF2_SALT_LENGTH = 32;
export const AES256_IV_LENGTH = 16;
export const AES_GCM_NONCE_LENGTH = 12;
export const AES_GCM_TAG_LENGTH = 16;
// Magic header used to identify AES-GCM payloads for auto-detection during decrypt.
export const AES_GCM_ENCRYPTION_MAGIC = '1K_AES_GCM';
export const ENCRYPTED_DATA_OFFSET = PBKDF2_SALT_LENGTH + AES256_IV_LENGTH;
// in web environment, if async function (globalThis.crypto.subtle) is executed in indexedDB.transaction, it will cause the transaction to be committed prematurely, so here use synchronous function
export const ALLOW_USE_WEB_CRYPTO_SUBTLE = false;

export enum EAppCryptoAesEncryptionMode {
  cbc = 'cbc',
  gcm = 'gcm',
}
