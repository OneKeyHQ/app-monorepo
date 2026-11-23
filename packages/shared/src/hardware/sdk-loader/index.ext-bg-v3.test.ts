import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EHardwareTransportType } from '@onekeyhq/shared/types';

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

jest.mock('@onekeyfe/hd-web-sdk/dist', () => {
  throw new OneKeyLocalError('The iframe client belongs to offscreen');
});

jest.mock('@onekeyhq/kit-bg/src/offscreens/instance/offscreenApiProxy', () => ({
  __esModule: true,
  default: {
    hardwareSDKLowLevel: {
      init: jest.fn(async () => true),
      cancel: jest.fn(async () => undefined),
      dispose: jest.fn(async () => undefined),
    },
    hardwareSDKBridgeLowLevel: {
      init: jest.fn(async () => true),
      call: jest.fn(async () => ({ success: true, payload: [] })),
      cancel: jest.fn(async () => undefined),
      dispose: jest.fn(async () => undefined),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it('keeps the service worker on the offscreen RPC proxy', async () => {
  const { default: offscreenApiProxy } =
    await import('@onekeyhq/kit-bg/src/offscreens/instance/offscreenApiProxy');
  const sdk = await importHardwareSDKLowLevel(EHardwareTransportType.WEBUSB);
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
  const sdk = await importHardwareSDK({
    hardwareTransportType: EHardwareTransportType.WEBUSB,
  });
  const lowLevel = await importHardwareSDKLowLevel(
    EHardwareTransportType.WEBUSB,
  );
  const settings = { env: 'webusb' as const };
  try {
    expect(await sdk.init(settings, lowLevel)).toBe(true);
    expect(lowLevel.init).toHaveBeenLastCalledWith(settings);
    sdk.cancel('synthetic-device');
    expect(lowLevel.cancel).toHaveBeenLastCalledWith('synthetic-device');
    await sdk.dispose();
    expect(lowLevel.dispose).toHaveBeenCalledTimes(1);
    expect(initCore).not.toHaveBeenCalled();
  } finally {
    initCore.mockRestore();
  }
});

it.each([EHardwareTransportType.Bridge, undefined])(
  'delegates Bridge/default transport %s to its separate offscreen client',
  async (hardwareTransportType) => {
    const { default: proxy } =
      await import('@onekeyhq/kit-bg/src/offscreens/instance/offscreenApiProxy');
    const sdk = await importHardwareSDK({ hardwareTransportType });
    const lowLevel = await importHardwareSDKLowLevel(hardwareTransportType);
    expect(lowLevel).toBe(proxy.hardwareSDKBridgeLowLevel);
    const settings = { connectSrc: 'https://jssdk.onekey.so/synthetic/' };
    expect(await sdk.init(settings, lowLevel)).toBe(true);
    expect(proxy.hardwareSDKBridgeLowLevel.init).toHaveBeenCalledWith(settings);
    expect(await sdk.call({ method: 'searchDevices' })).toEqual({
      success: true,
      payload: [],
    });
    expect(proxy.hardwareSDKBridgeLowLevel.call).toHaveBeenCalledWith({
      method: 'searchDevices',
    });
    sdk.cancel('synthetic-bridge-device');
    expect(proxy.hardwareSDKBridgeLowLevel.cancel).toHaveBeenCalledWith(
      'synthetic-bridge-device',
    );
    await sdk.dispose();
    expect(proxy.hardwareSDKBridgeLowLevel.dispose).toHaveBeenCalledTimes(1);
    expect(proxy.hardwareSDKLowLevel.init).not.toHaveBeenCalled();
    expect(proxy.hardwareSDKLowLevel.dispose).not.toHaveBeenCalled();
  },
);
