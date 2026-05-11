import {
  encryptAsync,
  encryptImportedCredential,
  encryptRevealableSeed,
  encryptStringAsync,
} from '@onekeyhq/core/src/secret';

import {
  EAppCryptoSharedEncryptScene,
  type IAppCryptoSharedEncryptFormat,
  resolveSharedEncryptFormat,
} from '../../../shared/src/appCrypto/sharedEncryptPolicy';

export { EAppCryptoSharedEncryptScene };

type IWithEncryptFormat<T> = T extends (params: infer P) => infer R
  ? (
      params: Omit<P, 'format'> & {
        format?: IAppCryptoSharedEncryptFormat;
        sharedScene?: EAppCryptoSharedEncryptScene;
      },
    ) => R
  : T;

type IEncryptAsyncWithFormat = IWithEncryptFormat<typeof encryptAsync>;
type IEncryptStringAsyncWithFormat = IWithEncryptFormat<
  typeof encryptStringAsync
>;
type IEncryptRevealableSeedWithFormat = IWithEncryptFormat<
  typeof encryptRevealableSeed
>;
type IEncryptImportedCredentialWithFormat = IWithEncryptFormat<
  typeof encryptImportedCredential
>;

function resolveKitBgSharedEncryptFormat({
  format,
  scene,
}: {
  format?: IAppCryptoSharedEncryptFormat;
  scene?: EAppCryptoSharedEncryptScene;
}): IAppCryptoSharedEncryptFormat {
  return resolveSharedEncryptFormat({ format, scene });
}

export const encryptAsyncWithFormat: IEncryptAsyncWithFormat = ({
  format,
  sharedScene,
  ...params
}) =>
  (encryptAsync as unknown as IEncryptAsyncWithFormat)({
    ...params,
    format: resolveKitBgSharedEncryptFormat({ format, scene: sharedScene }),
  });

export const encryptStringAsyncWithFormat: IEncryptStringAsyncWithFormat = ({
  format,
  sharedScene,
  ...params
}) =>
  (encryptStringAsync as unknown as IEncryptStringAsyncWithFormat)({
    ...params,
    format: resolveKitBgSharedEncryptFormat({ format, scene: sharedScene }),
  });

export const encryptRevealableSeedWithFormat: IEncryptRevealableSeedWithFormat =
  ({ format, sharedScene, ...params }) =>
    (encryptRevealableSeed as unknown as IEncryptRevealableSeedWithFormat)({
      ...params,
      format: resolveKitBgSharedEncryptFormat({ format, scene: sharedScene }),
    });

export const encryptImportedCredentialWithFormat: IEncryptImportedCredentialWithFormat =
  ({ format, sharedScene, ...params }) =>
    (
      encryptImportedCredential as unknown as IEncryptImportedCredentialWithFormat
    )({
      ...params,
      format: resolveKitBgSharedEncryptFormat({ format, scene: sharedScene }),
    });
