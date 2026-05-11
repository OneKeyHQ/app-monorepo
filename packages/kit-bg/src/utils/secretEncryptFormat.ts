import {
  encryptAsync,
  encryptImportedCredential,
  encryptRevealableSeed,
  encryptStringAsync,
} from '@onekeyhq/core/src/secret';

type IWithEncryptFormat<T> = T extends (params: infer P) => infer R
  ? (params: P & { format?: 'legacy' | 'v2' }) => R
  : T;

export const encryptAsyncWithFormat =
  encryptAsync as unknown as IWithEncryptFormat<typeof encryptAsync>;

export const encryptStringAsyncWithFormat =
  encryptStringAsync as unknown as IWithEncryptFormat<
    typeof encryptStringAsync
  >;

export const encryptRevealableSeedWithFormat =
  encryptRevealableSeed as unknown as IWithEncryptFormat<
    typeof encryptRevealableSeed
  >;

export const encryptImportedCredentialWithFormat =
  encryptImportedCredential as unknown as IWithEncryptFormat<
    typeof encryptImportedCredential
  >;
