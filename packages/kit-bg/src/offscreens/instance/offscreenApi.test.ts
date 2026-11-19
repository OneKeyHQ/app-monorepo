import { execFileSync } from 'node:child_process';

import { HardwareSDKLowLevel } from '@onekeyfe/hd-common-connect-sdk-extension';
import bridgeSDK from '@onekeyfe/hd-web-sdk/dist';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { OFFSCREEN_API_MESSAGE_TYPE } from '../types';

import offscreenApi from './offscreenApi';

import type { IOffscreenApiMessagePayload } from '../../apis/IBackgroundApi';
import type { CoreMessage } from '@onekeyfe/hd-core';

jest.mock('@onekeyhq/shared/src/appGlobals', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyfe/hd-common-connect-sdk-extension', () => ({
  HardwareSDKLowLevel: {
    init: jest.fn(),
    call: jest.fn(),
    uiResponse: jest.fn(),
    cancel: jest.fn(),
    switchTransport: jest.fn(),
    addHardwareGlobalEventListener: jest.fn(),
    removeAllListeners: jest.fn(),
    dispose: jest.fn(),
  },
}));

jest.mock('@onekeyfe/hd-web-sdk/dist', () => ({
  __esModule: true,
  default: {
    HardwareSDKLowLevel: {
      init: jest.fn(),
      call: jest.fn(),
      uiResponse: jest.fn(),
      cancel: jest.fn(),
      switchTransport: jest.fn(),
      addHardwareGlobalEventListener: jest.fn(),
      removeAllListeners: jest.fn(),
      dispose: jest.fn(),
    },
  },
}));

// Offscreen owns both clients instead of resolving the background loader.
jest.mock('@onekeyhq/shared/src/hardware/sdk-loader', () => {
  throw new OneKeyLocalError('Offscreen must own the local hardware SDK');
});

const sdk = jest.mocked(HardwareSDKLowLevel);
const bridgeSdk = jest.mocked(bridgeSDK.HardwareSDKLowLevel);
const call = (
  method: string,
  params: IOffscreenApiMessagePayload['params'],
  module:
    | 'hardwareSDKLowLevel'
    | 'hardwareSDKBridgeLowLevel' = 'hardwareSDKLowLevel',
) =>
  offscreenApi.callOffscreenApiMethod({
    type: OFFSCREEN_API_MESSAGE_TYPE,
    module,
    method,
    params,
  });

it('loads the low-level WebUSB exports from the published SDK', () => {
  const published = jest.requireActual<
    typeof import('@onekeyfe/hd-common-connect-sdk-extension')
  >('@onekeyfe/hd-common-connect-sdk-extension');
  expect(typeof published.HardwareSDKLowLevel.init).toBe('function');
  expect(typeof published.HardwareSDKLowLevel.call).toBe('function');
  expect(typeof published.probeUsbDeviceIdentities).toBe('function');
});

it('loads the extension transport with dynamic code generation disabled', () => {
  execFileSync(process.execPath, [
    '--disallow-code-generation-from-strings',
    '-e',
    `
      const assert = require('node:assert/strict');
      const fs = require('node:fs');
      const Module = require('node:module');
      const path = require('node:path');
      const adapt = require('./development/rspack/static-protobuf-compat-loader.cjs');
      const sdkRequire = Module.createRequire(
        require.resolve('@onekeyfe/hd-common-connect-sdk-extension/package.json'),
      );
      const entry = sdkRequire.resolve('@onekeyfe/hd-transport');
      const transport = new Module(entry, module);
      transport.paths = Module._nodeModulePaths(path.dirname(entry));
      transport._compile(adapt(fs.readFileSync(entry, 'utf8')), entry);
      assert.equal(typeof transport.exports.default.parseTransportConfigure, 'function');
    `,
  ]);
});

describe('offscreenApi local hardware SDK', () => {
  let activeListener: ((message: CoreMessage) => void) | undefined;
  const request = jest.fn(async () => undefined);

  beforeAll(async () => {
    sdk.addHardwareGlobalEventListener.mockImplementation((listener) => {
      activeListener = listener;
    });
    sdk.removeAllListeners.mockImplementation(() => {
      activeListener = undefined;
    });
    sdk.dispose.mockImplementation(async () => {
      activeListener = undefined;
    });
    appGlobals.extJsBridgeOffscreenToBg = { request } as never;
    sdk.init.mockResolvedValue(true);
    await call('init', [{ env: 'webusb' }]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards direct settings and transport switches without duplicating listeners', async () => {
    sdk.init.mockResolvedValue(true);
    const settings = { env: 'webusb', fetchConfig: false };
    expect(await call('init', [settings])).toBe(true);
    expect(sdk.init).toHaveBeenCalledWith(settings);
    expect(activeListener).toEqual(expect.any(Function));
    expect(sdk.addHardwareGlobalEventListener).not.toHaveBeenCalled();

    const switched = { success: true, payload: {} };
    sdk.switchTransport.mockResolvedValue(switched);
    expect(await call('switchTransport', ['webusb'])).toBe(switched);
    expect(sdk.switchTransport).toHaveBeenCalledWith('webusb');
    expect(sdk.addHardwareGlobalEventListener).not.toHaveBeenCalled();
  });

  it('forwards interaction events and accepts UI response and cancel while a call is pending', async () => {
    let finishCall: ((value: unknown) => void) | undefined;
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    sdk.call.mockImplementationOnce(
      async () =>
        new Promise((resolve) => {
          finishCall = resolve;
          markStarted?.();
        }),
    );
    const params = { method: 'getFeatures', connectId: 'synthetic-device' };
    const pending = call('call', [params]);
    await started;
    expect(sdk.call).toHaveBeenCalledWith(params);

    const event = {
      event: 'UI_EVENT',
      type: 'ui-button',
      payload: { code: 'ButtonRequest_Other' },
    } as CoreMessage;
    activeListener?.(event);
    expect(request).toHaveBeenCalledWith({
      data: expect.objectContaining({
        service: 'serviceHardware',
        method: 'INTERNAL_passHardwareEventsFromOffscreenToBackground',
        params: [event],
      }),
    });

    const response = {
      type: 'ui-receive_select-device-in-bootloader-for-web-device',
      payload: { deviceId: 'synthetic-device' },
    };
    await call('uiResponse', [response]);
    expect(sdk.uiResponse).toHaveBeenCalledWith(response);
    await call('cancel', ['synthetic-device']);
    expect(sdk.cancel).toHaveBeenCalledWith('synthetic-device');

    const result = { success: false, payload: { error: 'Cancelled' } };
    finishCall?.(result);
    expect(await pending).toBe(result);
  });

  it('restores event forwarding after dispose and unscoped listener cleanup', async () => {
    await call('dispose', []);
    expect(sdk.dispose).toHaveBeenCalledTimes(1);
    expect(sdk.addHardwareGlobalEventListener).toHaveBeenCalledTimes(1);

    await call('removeAllListeners', []);
    expect(sdk.addHardwareGlobalEventListener).toHaveBeenCalledTimes(2);
    const progressEvent = {
      event: 'UI_EVENT',
      type: 'ui-firmware-progress',
      payload: { progress: 25, progressType: 'transferData' },
    } as CoreMessage;
    activeListener?.(progressEvent);
    expect(request).toHaveBeenCalledWith({
      data: expect.objectContaining({ params: [progressEvent] }),
    });

    await call('removeAllListeners', ['UI_EVENT']);
    expect(sdk.addHardwareGlobalEventListener).toHaveBeenCalledTimes(2);
  });

  it('returns initialization and transport errors to the caller without retrying', async () => {
    sdk.init.mockResolvedValueOnce(false);
    expect(await call('init', [{ env: 'webusb' }])).toBe(false);
    const failure = new Error('Synthetic USB disconnect');
    sdk.call.mockRejectedValueOnce(failure);
    await expect(call('call', [{ method: 'getFeatures' }])).rejects.toBe(
      failure,
    );
    expect(sdk.call).toHaveBeenCalledTimes(1);
  });

  it('keeps event forwarding available when transport cleanup rejects', async () => {
    const failure = new Error('Synthetic USB cleanup failure');
    sdk.dispose.mockImplementationOnce(async () => {
      activeListener = undefined;
      throw failure;
    });
    await expect(call('dispose', [])).rejects.toBe(failure);
    expect(sdk.addHardwareGlobalEventListener).toHaveBeenCalledTimes(1);
    expect(activeListener).toEqual(expect.any(Function));
  });
});

describe('offscreenApi Bridge SDK', () => {
  let activeListener: ((message: CoreMessage) => void) | undefined;
  const request = jest.fn(async () => undefined);

  beforeAll(async () => {
    bridgeSdk.addHardwareGlobalEventListener.mockImplementation((listener) => {
      activeListener = listener;
    });
    bridgeSdk.removeAllListeners.mockImplementation(() => {
      activeListener = undefined;
    });
    bridgeSdk.dispose.mockImplementation(async () => {
      activeListener = undefined;
    });
    appGlobals.extJsBridgeOffscreenToBg = { request } as never;
    bridgeSdk.init.mockResolvedValue(true);
    await call('init', [{}], 'hardwareSDKBridgeLowLevel');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    bridgeSdk.init.mockResolvedValue(true);
    sdk.init.mockResolvedValue(true);
  });

  it('initializes the iframe client with the versioned connect source', async () => {
    const settings = { connectSrc: 'https://jssdk.onekey.so/synthetic/' };
    expect(await call('init', [settings], 'hardwareSDKBridgeLowLevel')).toBe(
      true,
    );
    expect(bridgeSdk.init).toHaveBeenCalledWith(settings);
    expect(activeListener).toEqual(expect.any(Function));
    expect(bridgeSdk.addHardwareGlobalEventListener).not.toHaveBeenCalled();
    expect(sdk.init).not.toHaveBeenCalled();
  });

  it('forwards Bridge interactions and cleanup through the Bridge client', async () => {
    const event = {
      event: 'UI_EVENT',
      type: 'ui-button',
      payload: { code: 'ButtonRequest_Other' },
    } as CoreMessage;
    activeListener?.(event);
    expect(request).toHaveBeenCalledWith({
      data: expect.objectContaining({ params: [event] }),
    });
    const response = { type: 'ui-receive_pin', payload: '' };
    await call('uiResponse', [response], 'hardwareSDKBridgeLowLevel');
    expect(bridgeSdk.uiResponse).toHaveBeenCalledWith(response);
    await call(
      'cancel',
      ['synthetic-bridge-device'],
      'hardwareSDKBridgeLowLevel',
    );
    expect(bridgeSdk.cancel).toHaveBeenCalledWith('synthetic-bridge-device');
    await call('dispose', [], 'hardwareSDKBridgeLowLevel');
    expect(bridgeSdk.addHardwareGlobalEventListener).toHaveBeenCalledTimes(1);
    expect(activeListener).toEqual(expect.any(Function));
    expect(sdk.dispose).not.toHaveBeenCalled();
    expect(sdk.addHardwareGlobalEventListener).not.toHaveBeenCalled();
  });

  it('keeps WebUSB and Bridge clients isolated when changing transports', async () => {
    await call('init', [{ env: 'webusb' }]);
    await call('dispose', []);
    await call('init', [{}], 'hardwareSDKBridgeLowLevel');
    await call('dispose', [], 'hardwareSDKBridgeLowLevel');
    await call('init', [{ env: 'webusb' }]);
    expect(sdk.init).toHaveBeenCalledTimes(2);
    expect(sdk.dispose).toHaveBeenCalledTimes(1);
    expect(bridgeSdk.init).toHaveBeenCalledTimes(1);
    expect(bridgeSdk.dispose).toHaveBeenCalledTimes(1);
  });
});
