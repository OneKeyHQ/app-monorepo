import { HardwareSDKLowLevel } from '@onekeyfe/hd-common-connect-sdk';

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

jest.mock('@onekeyfe/hd-common-connect-sdk', () => ({
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

// Loading the shared Web LowLevel here would restore the remote iframe.
jest.mock('@onekeyhq/shared/src/hardware/sdk-loader', () => {
  throw new OneKeyLocalError('Offscreen must own the local hardware SDK');
});

const sdk = jest.mocked(HardwareSDKLowLevel);
const call = (method: string, params: IOffscreenApiMessagePayload['params']) =>
  offscreenApi.callOffscreenApiMethod({
    type: OFFSCREEN_API_MESSAGE_TYPE,
    module: 'hardwareSDKLowLevel',
    method,
    params,
  });

describe('offscreenApi local hardware SDK', () => {
  let activeListener: ((message: CoreMessage) => void) | undefined;
  const request = jest.fn(async () => undefined);

  beforeAll(() => {
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
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes the local SDK once and forwards transport settings', async () => {
    sdk.init.mockResolvedValue(true);
    const settings = { env: 'webusb', fetchConfig: false };
    expect(await call('init', [settings])).toBe(true);
    expect(sdk.init).toHaveBeenCalledWith(settings);
    expect(sdk.addHardwareGlobalEventListener).toHaveBeenCalledTimes(1);

    const switched = { success: true, payload: {} };
    sdk.switchTransport.mockResolvedValue(switched);
    expect(await call('switchTransport', ['webusb'])).toBe(switched);
    expect(sdk.switchTransport).toHaveBeenCalledWith('webusb');
    expect(sdk.addHardwareGlobalEventListener).toHaveBeenCalledTimes(1);
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
