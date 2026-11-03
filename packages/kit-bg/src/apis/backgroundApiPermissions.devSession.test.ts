import { markWebEmbedChannelPayload } from '@onekeyhq/shared/src/utils/webEmbedChannelUtils';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

type IPermissions = typeof import('./backgroundApiPermissions');

function loadPermissions(env: {
  isDev: boolean;
  isNativeAndroid?: boolean;
}): IPermissions {
  let permissions: IPermissions | undefined;
  jest.isolateModules(() => {
    jest.doMock('@onekeyhq/shared/src/platformEnv', () => ({
      __esModule: true,
      default: { isNative: true, ...env },
    }));
    permissions = jest.requireActual<IPermissions>(
      './backgroundApiPermissions',
    );
  });
  if (!permissions) throw new TypeError('permissions not loaded');
  return permissions;
}

const DEV_SESSION_ORIGINS = [
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19123',
  'http://10.0.2.2:8081',
  'http://localhost:8081',
];

const singleton = (origin: string) =>
  markWebEmbedChannelPayload(
    {
      origin,
      scope: '$private',
      data: { method: 'webEmbedApiReady' },
    } as unknown as IJsBridgeMessagePayload,
    true,
  );

describe('web-embed origins: Mobile DevSession', () => {
  it.each(DEV_SESSION_ORIGINS)(
    'dev build serves the singleton at %s',
    (origin) => {
      const permissions = loadPermissions({ isDev: true });
      expect(permissions.isWebEmbedApiAllowedOrigin(origin)).toBe(true);
      expect(permissions.isWebEmbedChannelRequest(singleton(origin))).toBe(
        true,
      );
      expect(
        permissions.isProviderApiPrivateOriginDenied({
          method: 'getSensitiveEncodeKey',
          origin,
        }),
      ).toBe(false);
    },
  );

  it.each(DEV_SESSION_ORIGINS)('production build rejects %s', (origin) => {
    const permissions = loadPermissions({ isDev: false });
    expect(permissions.isWebEmbedApiAllowedOrigin(origin)).toBe(false);
    expect(permissions.isWebEmbedChannelRequest(singleton(origin))).toBe(false);
  });

  it.each([
    'https://127.0.0.1:8081',
    'http://192.0.2.1:8081',
    'http://127.0.0.1.evil.example',
    'http://127.0.0.1:8081/path',
  ])('dev build still rejects %s', (origin) => {
    const permissions = loadPermissions({ isDev: true });
    expect(permissions.isWebEmbedApiAllowedOrigin(origin)).toBe(false);
  });

  it.each([
    [{ isDev: false }, ['null', 'file://']],
    [
      { isDev: false, isNativeAndroid: true },
      ['null', 'file://', 'https://appassets.androidplatform.net'],
    ],
    [{ isDev: true }, ['null', 'file://']],
  ])('keeps the production web-embed origins (%j)', (env, origins) => {
    const permissions = loadPermissions(env);
    for (const origin of origins) {
      expect(permissions.isWebEmbedApiAllowedOrigin(origin)).toBe(true);
      expect(permissions.isWebEmbedChannelRequest(singleton(origin))).toBe(
        true,
      );
    }
  });
});
