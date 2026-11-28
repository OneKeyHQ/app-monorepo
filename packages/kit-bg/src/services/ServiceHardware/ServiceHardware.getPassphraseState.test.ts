import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import ServiceHardware from './ServiceHardware';

import type { CoreApi } from '@onekeyfe/hd-core';

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
    SyncDeviceLabelToWalletName: 'SyncDeviceLabelToWalletName',
    UpdateWalletAvatarByDeviceSerialNo: 'UpdateWalletAvatarByDeviceSerialNo',
    RequestHardwareUIDialog: 'RequestHardwareUIDialog',
  },
  appEventBus: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: true,
    isJest: true,
    isNative: false,
    isNativeAndroid: false,
    isSupportDesktopBle: false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/deviceHomeScreenUtils', () => ({
  __esModule: true,
  DEFAULT_T1_HOME_SCREEN_INFORMATION: {},
  T1_HOME_SCREEN_DEFAULT_IMAGES: [],
  default: {},
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../offscreens/offscreenEventBus', () => ({
  __esModule: true,
  dispatchOffscreenEvent: jest.fn(),
}));

jest.mock('../../states/jotai/atoms', () => {
  const hardwareUi = jest.requireActual<
    typeof import('@onekeyhq/shared/types/hardwareUi')
  >('@onekeyhq/shared/types/hardwareUi');
  return {
    __esModule: true,
    EHardwareUiStateAction: hardwareUi.EHardwareUiStateAction,
    hardwareForceTransportAtom: {},
    hardwareUiStateAtom: {},
    hardwareUiStateCompletedAtom: {},
    settingsPersistAtom: {},
  };
});

jest.mock('../ServiceFirmwareUpdate/FirmwareManifestProvider', () => ({
  __esModule: true,
  getFirmwareManifestSnapshot: jest.fn(),
}));

jest.mock('../ServiceKeylessCloudSync/hardwareCloudSyncLog', () => ({
  __esModule: true,
  callHardwareCloudSyncDevice: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/hardware/blePermissions', () => ({
  __esModule: true,
  checkBLEPermissions: jest.fn(),
  checkBLEState: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/hardware/instance', () => ({
  __esModule: true,
  CoreSDKLoader: jest.fn(),
  getHardwareSDKInstance: jest.fn(),
  resetHardwareSDKInstance: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/hardware/sdk-loader', () => ({
  __esModule: true,
  probeUsbDeviceIdentities: jest.fn(),
}));

jest.mock('./DeviceSettingsManager', () => ({
  __esModule: true,
  DeviceSettingsManager: jest.fn(),
}));

jest.mock('./HardwareConnectionManager', () => ({
  __esModule: true,
  HardwareConnectionManager: jest.fn(),
}));

jest.mock('./HardwareVerifyManager', () => ({
  __esModule: true,
  HardwareVerifyManager: jest.fn(),
}));

jest.mock('./HardwareTelemetry', () => ({
  __esModule: true,
  getHardwareTelemetry: jest.fn(),
}));

type IProtocol = 'V1' | 'V2';

type ISdkCallArgs = [string, Record<string, unknown>];

type IOpenWalletSessionResponse = {
  success: true;
  payload: {
    walletType: 'hidden' | 'standard';
    passphraseState?: string;
    resumed: boolean;
  };
};

type IOpenWalletSessionMock = jest.Mock<
  Promise<IOpenWalletSessionResponse>,
  ISdkCallArgs
>;

type IGetPassphraseStateResponse = {
  success: true;
  payload: string | undefined;
};

type IGetPassphraseStateMock = jest.Mock<
  Promise<IGetPassphraseStateResponse>,
  ISdkCallArgs
>;

interface ITestServiceHardware {
  getKnownDeviceProtocol: jest.Mock<Promise<IProtocol | undefined>, [string?]>;
  convertHardwareResponse: ServiceHardware['convertHardwareResponse'];
}

function createTestService({
  protocol,
  openWalletSession,
  getPassphraseState,
}: {
  protocol: IProtocol;
  openWalletSession?: IOpenWalletSessionMock;
  getPassphraseState?: IGetPassphraseStateMock;
}) {
  const service = Object.create(ServiceHardware.prototype) as ServiceHardware;
  const internals = service as unknown as ITestServiceHardware;
  internals.getKnownDeviceProtocol = jest
    .fn<Promise<IProtocol | undefined>, [string?]>()
    .mockResolvedValue(protocol);
  service.getSDKInstance = jest.fn().mockResolvedValue({
    openWalletSession,
    getPassphraseState,
  } as unknown as CoreApi);
  internals.convertHardwareResponse = jest.fn(
    async (fn: () => Promise<{ success: boolean; payload?: unknown }>) => {
      const response = await fn();
      if (!response.success) {
        throw new OneKeyLocalError(
          'Unexpected failed hardware response in test',
        );
      }
      return response.payload;
    },
  ) as unknown as ServiceHardware['convertHardwareResponse'];
  return service;
}

describe('ServiceHardware.getPassphraseState', () => {
  it('passes deriveCardano: true to V2 openWalletSession only when requested', async () => {
    const openWalletSession: IOpenWalletSessionMock = jest.fn<
      Promise<IOpenWalletSessionResponse>,
      ISdkCallArgs
    >(async () => ({
      success: true,
      payload: {
        walletType: 'hidden',
        passphraseState: 'PRO2_HIDDEN_STATE',
        resumed: false,
      },
    }));
    const service = createTestService({
      protocol: 'V2',
      openWalletSession,
    });

    await expect(
      service.getPassphraseState({
        connectId: 'PRO2-USB',
        forceInputPassphrase: true,
        deriveCardano: true,
      }),
    ).resolves.toBe('PRO2_HIDDEN_STATE');

    expect(openWalletSession).toHaveBeenCalledWith('PRO2-USB', {
      mode: 'select-hidden',
      deriveCardano: true,
    });
  });

  it('omits deriveCardano from V2 openWalletSession params when omitted or false', async () => {
    const openWalletSession: IOpenWalletSessionMock = jest.fn<
      Promise<IOpenWalletSessionResponse>,
      ISdkCallArgs
    >(async () => ({
      success: true,
      payload: {
        walletType: 'hidden',
        passphraseState: 'PRO2_HIDDEN_STATE',
        resumed: false,
      },
    }));
    const service = createTestService({
      protocol: 'V2',
      openWalletSession,
    });

    await service.getPassphraseState({
      connectId: 'PRO2-USB',
      forceInputPassphrase: true,
    });
    await service.getPassphraseState({
      connectId: 'PRO2-USB',
      forceInputPassphrase: true,
      deriveCardano: false,
    });

    const omittedParams = openWalletSession.mock.calls[0][1];
    const falseParams = openWalletSession.mock.calls[1][1];

    expect(omittedParams).toEqual({ mode: 'select-hidden' });
    expect('deriveCardano' in omittedParams).toBe(false);
    expect(falseParams).toEqual({ mode: 'select-hidden' });
    expect('deriveCardano' in falseParams).toBe(false);
  });

  it('handles deriveCardano with standard mode in getPassphraseStateBase', async () => {
    const openWalletSession: IOpenWalletSessionMock = jest.fn<
      Promise<IOpenWalletSessionResponse>,
      ISdkCallArgs
    >(async () => ({
      success: true,
      payload: {
        walletType: 'standard',
        resumed: false,
      },
    }));
    const service = createTestService({
      protocol: 'V2',
      openWalletSession,
    });

    await expect(
      service.getPassphraseStateBase({
        connectId: 'PRO2-USB',
        forceInputPassphrase: false,
        useEmptyPassphrase: true,
        deriveCardano: true,
      }),
    ).resolves.toBeUndefined();

    expect(openWalletSession).toHaveBeenNthCalledWith(1, 'PRO2-USB', {
      mode: 'standard',
      deriveCardano: true,
    });

    await expect(
      service.getPassphraseStateBase({
        connectId: 'PRO2-USB',
        forceInputPassphrase: false,
        useEmptyPassphrase: true,
      }),
    ).resolves.toBeUndefined();

    const secondParams = openWalletSession.mock.calls[1][1];
    expect(secondParams).toEqual({ mode: 'standard' });
    expect('deriveCardano' in secondParams).toBe(false);
  });

  it('leaves Protocol V1 getPassphraseState params unchanged', async () => {
    const getPassphraseStateSdk: IGetPassphraseStateMock = jest.fn<
      Promise<IGetPassphraseStateResponse>,
      ISdkCallArgs
    >(async () => ({
      success: true,
      payload: 'V1_HIDDEN_STATE',
    }));
    const service = createTestService({
      protocol: 'V1',
      getPassphraseState: getPassphraseStateSdk,
    });

    await expect(
      service.getPassphraseState({
        connectId: 'PRO-USB',
        forceInputPassphrase: true,
        deriveCardano: true,
      }),
    ).resolves.toBe('V1_HIDDEN_STATE');

    const sdkParams = getPassphraseStateSdk.mock.calls[0][1];
    expect(sdkParams).toEqual({
      initSession: true,
      useEmptyPassphrase: undefined,
      connectProtocol: 'V1',
    });
    expect('deriveCardano' in sdkParams).toBe(false);
  });
});
