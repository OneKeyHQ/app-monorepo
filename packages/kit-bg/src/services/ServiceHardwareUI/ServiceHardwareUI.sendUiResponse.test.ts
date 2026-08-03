import ServiceHardwareUI from './ServiceHardwareUI';

import type { UiResponseEvent } from '@onekeyfe/hd-core';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    HardwareDeviceStateUpdate: 'HardwareDeviceStateUpdate',
    HardwareFeaturesUpdate: 'HardwareFeaturesUpdate',
  },
  appEventBus: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getDevice: jest.fn(),
  },
}));

describe('ServiceHardwareUI.sendUiResponse', () => {
  it('Pro2 通过 USB 连接时仍把 Pro BLE 的 Passphrase 回包交给当前 SDK', async () => {
    const sendUiResponseToActiveSdk = jest.fn();
    const sdkUiResponse = jest.fn();
    const getSDKInstance = jest.fn().mockResolvedValue({
      uiResponse: sdkUiResponse,
    });
    const service = new ServiceHardwareUI({
      backgroundApi: {
        serviceHardware: {
          getSDKInstance,
          sendUiResponseToActiveSdk,
        },
      },
    });
    const response = {
      type: 'ui-receive_passphrase',
      payload: {
        value: 'hidden wallet',
        passphraseOnDevice: false,
        attachPinOnDevice: false,
        save: false,
      },
      interactionId: 'pro-ble-interaction',
      deviceId: 'pro-device',
    } as UiResponseEvent;

    await service.sendUiResponse(response);

    expect(sendUiResponseToActiveSdk).toHaveBeenCalledWith(response);
    expect(getSDKInstance).not.toHaveBeenCalled();
    expect(sdkUiResponse).not.toHaveBeenCalled();
  });
});
