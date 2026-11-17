import extensionSdk from '@onekeyhq/core/src/chains/ada/sdkAda/sdk/index.ext-bg-v3';
import nativeSdk from '@onekeyhq/core/src/chains/ada/sdkAda/sdk/index.native';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ensureWebembedApiProxyAvailable } from '@onekeyhq/shared/src/utils/assertUtils';

jest.mock('@onekeyhq/shared/src/appGlobals', () => ({
  __esModule: true,
  default: {
    $offscreenApiProxy: { adaSdk: { derivePublicAccountAddresses: jest.fn() } },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/assertUtils', () => ({
  ensureWebembedApiProxyAvailable: jest.fn(),
}));
// Importing either background facade must not load the heavy CSL host module.
jest.mock('@onekeyhq/core/src/chains/ada/sdkAda/publicAccountAddresses', () => {
  throw new OneKeyLocalError(
    'Public derivation host leaked into the background runtime',
  );
});

const params = { xpub: 'public-xpub', paths: ['0/0'], networkId: 1 as const };

test('extension background sends one public batch through offscreen', async () => {
  const remote = jest.spyOn(
    appGlobals.$offscreenApiProxy.adaSdk,
    'derivePublicAccountAddresses',
  );
  remote.mockResolvedValue({ '0/0': 'public-address' });
  const api = await extensionSdk.getCardanoApi();
  await expect(api.derivePublicAccountAddresses(params)).resolves.toEqual({
    '0/0': 'public-address',
  });
  expect(remote).toHaveBeenCalledTimes(1);
  expect(remote).toHaveBeenCalledWith(params);
});

test('native background sends one public batch through the existing WebEmbed host', async () => {
  const remote = jest.fn(async () => ({ '0/0': 'public-address' }));
  jest.mocked(ensureWebembedApiProxyAvailable).mockReturnValue({
    chainAdaLegacy: { derivePublicAccountAddresses: remote },
  } as unknown as ReturnType<typeof ensureWebembedApiProxyAvailable>);
  const api = await nativeSdk.getCardanoApi();
  await expect(api.derivePublicAccountAddresses(params)).resolves.toEqual({
    '0/0': 'public-address',
  });
  expect(remote).toHaveBeenCalledTimes(1);
  expect(remote).toHaveBeenCalledWith(params);
});
