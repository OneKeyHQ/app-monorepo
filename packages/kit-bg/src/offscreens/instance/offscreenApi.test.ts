import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { importHardwareSDKLowLevel } from '@onekeyhq/shared/src/hardware/sdk-loader';

import { OFFSCREEN_API_MESSAGE_TYPE } from '../types';

import offscreenApi from './offscreenApi';

import type { CoreMessage } from '@onekeyfe/hd-core';

jest.mock('@onekeyhq/shared/src/appGlobals', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/shared/src/hardware/sdk-loader', () => ({
  importHardwareSDKLowLevel: jest.fn(),
}));

describe('offscreenApi hardware events', () => {
  it('restores event forwarding after the SDK clears its listeners', async () => {
    let activeListener: ((message: CoreMessage) => void) | undefined;
    const addHardwareGlobalEventListener = jest.fn(
      (listener: (message: CoreMessage) => void) => {
        activeListener = listener;
      },
    );
    const removeAllListeners = jest.fn(() => {
      activeListener = undefined;
    });
    const dispose = jest.fn(async () => {
      activeListener = undefined;
    });
    jest.mocked(importHardwareSDKLowLevel).mockResolvedValue({
      addHardwareGlobalEventListener,
      removeAllListeners,
      dispose,
    } as never);
    const request = jest.fn(async () => undefined);
    appGlobals.extJsBridgeOffscreenToBg = { request } as never;

    await offscreenApi.callOffscreenApiMethod({
      type: OFFSCREEN_API_MESSAGE_TYPE,
      module: 'hardwareSDKLowLevel',
      method: 'removeAllListeners',
      params: [],
    });
    expect(addHardwareGlobalEventListener).toHaveBeenCalledTimes(2);

    await offscreenApi.callOffscreenApiMethod({
      type: OFFSCREEN_API_MESSAGE_TYPE,
      module: 'hardwareSDKLowLevel',
      method: 'dispose',
      params: [],
    });
    expect(addHardwareGlobalEventListener).toHaveBeenCalledTimes(3);

    const progressEvent = {
      event: 'UI_EVENT',
      type: 'ui-firmware-progress',
      payload: { progress: 25, progressType: 'transferData' },
    } as CoreMessage;
    activeListener?.(progressEvent);

    expect(request).toHaveBeenCalledWith({
      data: expect.objectContaining({
        service: 'serviceHardware',
        params: [progressEvent],
      }),
    });
  });
});
