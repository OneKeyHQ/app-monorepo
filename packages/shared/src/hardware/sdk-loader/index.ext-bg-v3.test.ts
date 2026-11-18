import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { CoreSDKLoader } from '../coreSdkLoader';

import {
  importHardwareSDK,
  importHardwareSDKLowLevel,
} from './index.ext-bg-v3';

jest.mock('@onekeyfe/hd-web-sdk', () => {
  throw new OneKeyLocalError('Extension hardware must not load the iframe SDK');
});

jest.mock('@onekeyfe/hd-common-connect-sdk', () => {
  throw new OneKeyLocalError(
    'The service worker must not load the local hardware Core',
  );
});

jest.mock('@onekeyhq/kit-bg/src/offscreens/instance/offscreenApiProxy', () => ({
  __esModule: true,
  default: {
    hardwareSDKLowLevel: {
      init: jest.fn(async () => true),
      cancel: jest.fn(async () => undefined),
      dispose: jest.fn(async () => undefined),
    },
  },
}));

it('keeps the service worker on the offscreen RPC proxy', async () => {
  const { default: offscreenApiProxy } =
    await import('@onekeyhq/kit-bg/src/offscreens/instance/offscreenApiProxy');
  const sdk = await importHardwareSDKLowLevel();
  expect(sdk).toBe(offscreenApiProxy.hardwareSDKLowLevel);
  expect(await sdk.init({ env: 'webusb' })).toBe(true);
  expect(offscreenApiProxy.hardwareSDKLowLevel.init).toHaveBeenCalledWith({
    env: 'webusb',
  });
  sdk.cancel('synthetic-device');
  expect(offscreenApiProxy.hardwareSDKLowLevel.cancel).toHaveBeenCalledWith(
    'synthetic-device',
  );
  await sdk.dispose();
  expect(offscreenApiProxy.hardwareSDKLowLevel.dispose).toHaveBeenCalledTimes(
    1,
  );
});

it('uses the real TopLevel facade to delegate initialization and cancellation to offscreen', async () => {
  const core = await CoreSDKLoader();
  const initCore = jest.spyOn(core, 'initCore');
  const sdk = await importHardwareSDK({});
  const lowLevel = await importHardwareSDKLowLevel();
  const settings = { env: 'webusb' as const };
  try {
    expect(await sdk.init(settings, lowLevel)).toBe(true);
    expect(lowLevel.init).toHaveBeenLastCalledWith(settings);
    sdk.cancel('synthetic-device');
    expect(lowLevel.cancel).toHaveBeenLastCalledWith('synthetic-device');
    await sdk.dispose();
    expect(lowLevel.dispose).toHaveBeenCalledTimes(2);
    expect(initCore).not.toHaveBeenCalled();
  } finally {
    initCore.mockRestore();
  }
});
