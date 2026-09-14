import { bridgeSetup } from '@onekeyfe/extension-bridge-hosted';

import appGlobals from '@onekeyhq/shared/src/appGlobals';

import { offscreenSetup } from './offscreenSetup';

jest.mock('@onekeyfe/extension-bridge-hosted', () => ({
  bridgeSetup: {
    offscreen: { createOffscreenJsBridge: jest.fn() },
  },
}));

jest.mock('@onekeyhq/kit-bg/src/offscreens/instance/offscreenApi', () => ({
  __esModule: true,
  default: { callOffscreenApiMethod: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/appGlobals', () => ({
  __esModule: true,
  default: {},
}));

describe('offscreenSetup', () => {
  it('recreates the offscreen bridge after its background port disconnects', () => {
    jest.useFakeTimers();
    const bridges = [{ id: 1 }, { id: 2 }];
    const createOffscreenJsBridge = jest.mocked(
      bridgeSetup.offscreen.createOffscreenJsBridge,
    );
    createOffscreenJsBridge
      .mockReturnValueOnce(bridges[0] as never)
      .mockReturnValueOnce(bridges[1] as never);

    expect(offscreenSetup()).toBe(bridges[0]);
    expect(appGlobals.extJsBridgeOffscreenToBg).toBe(bridges[0]);

    const addDisconnectListener = jest.fn();
    const firstConfig = createOffscreenJsBridge.mock.calls[0]?.[0];
    firstConfig?.onPortConnect({
      onDisconnect: { addListener: addDisconnectListener },
    } as never);
    const onDisconnect = addDisconnectListener.mock.calls[0]?.[0] as
      | (() => void)
      | undefined;
    onDisconnect?.();
    jest.advanceTimersByTime(100);

    expect(createOffscreenJsBridge).toHaveBeenCalledTimes(2);
    expect(appGlobals.extJsBridgeOffscreenToBg).toBe(bridges[1]);

    jest.useRealTimers();
  });
});
