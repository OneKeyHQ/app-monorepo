import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import type { IOneKeyDeviceState } from '@onekeyhq/shared/types/device';

import ServiceAccount from './ServiceAccount';

import type { IDBDevice } from '../../dbs/local/types';

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
    AccountUpdate: 'AccountUpdate',
    WalletUpdate: 'WalletUpdate',
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
    createHwWallet: jest.fn(),
  },
}));

const SEEDED_STATE = {
  protocol: 'V1',
  identity: { deviceId: 'DEVICE_ID_1', serialNo: 'SERIAL_1' },
  status: { mode: 'normal' },
} as unknown as IOneKeyDeviceState;

function buildDbDevice(overrides: Partial<IDBDevice> = {}): IDBDevice {
  return {
    id: 'device-db-id',
    connectId: 'CONNECT_ID_1',
    deviceId: 'DEVICE_ID_1',
    vendor: EHardwareVendor.onekey,
    ...overrides,
  } as unknown as IDBDevice;
}

function buildService({
  dbDevice,
  callOrder,
  seededState = SEEDED_STATE,
  latestDbDevice,
}: {
  dbDevice: IDBDevice;
  callOrder: string[];
  seededState?: IOneKeyDeviceState;
  latestDbDevice?: Partial<IDBDevice>;
}) {
  const getDeviceStateMock = jest.fn().mockImplementation(() => {
    callOrder.push('getDeviceState');
    return Promise.resolve(seededState);
  });
  const getPassphraseStateMock = jest.fn().mockImplementation(() => {
    callOrder.push('getPassphraseState');
    return Promise.resolve('passphrase-state-1');
  });
  const waitForDeviceStateSyncMock = jest.fn().mockImplementation(() => {
    callOrder.push('waitForDeviceStateSync');
    return Promise.resolve();
  });
  const getDeviceByConnectIdMock = jest.fn().mockResolvedValue(latestDbDevice);
  const service = new ServiceAccount({
    backgroundApi: {
      serviceHardware: {
        getCompatibleConnectId: jest.fn().mockResolvedValue('CONNECT_ID_1'),
        getDeviceState: getDeviceStateMock,
        getPassphraseState: getPassphraseStateMock,
        getDeviceByConnectId: getDeviceByConnectIdMock,
        waitForDeviceStateSync: waitForDeviceStateSyncMock,
      },
      serviceThirdPartyHardware: {},
      serviceHardwareUI: {
        withHardwareProcessing: (fn: () => Promise<unknown>) => fn(),
      },
      serviceSetting: {
        getHiddenWalletImmediately: jest.fn().mockResolvedValue(true),
      },
      serviceAccountProfile: {
        isSoftwareWalletOnlyUser: jest.fn().mockResolvedValue(false),
      },
    },
  } as never) as unknown as {
    createHWHiddenWallet(params: { walletId: string }): Promise<unknown>;
    getWallet: jest.Mock;
    getWalletDevice: jest.Mock;
    getFeaturesForHwWalletCreate: jest.Mock;
    createHWWalletBase: jest.Mock;
    setWalletTempStatus: jest.Mock;
  };
  service.getWallet = jest
    .fn()
    .mockResolvedValue({ id: 'hw-wallet-1', deprecated: false });
  service.getWalletDevice = jest.fn().mockResolvedValue(dbDevice);
  service.getFeaturesForHwWalletCreate = jest.fn().mockImplementation(() => {
    callOrder.push('getFeaturesForHwWalletCreate');
    return Promise.resolve({ deviceId: 'DEVICE_ID_1' });
  });
  service.createHWWalletBase = jest
    .fn()
    .mockResolvedValue({ wallet: { id: 'hw-wallet-hidden-1' } });
  service.setWalletTempStatus = jest.fn().mockResolvedValue(undefined);
  return {
    service,
    getDeviceStateMock,
    getPassphraseStateMock,
    getDeviceByConnectIdMock,
  };
}

describe('createHWHiddenWallet canonical device state seeding', () => {
  it('seeds device state before the passphrase session when no snapshot is persisted', async () => {
    const callOrder: string[] = [];
    const dbDevice = buildDbDevice({ connectProtocol: 'V1' });
    const { service, getDeviceStateMock } = buildService({
      dbDevice,
      callOrder,
    });

    await service.createHWHiddenWallet({ walletId: 'hw-wallet-1' });

    expect(getDeviceStateMock).toHaveBeenCalledTimes(1);
    expect(getDeviceStateMock).toHaveBeenCalledWith({
      connectId: 'CONNECT_ID_1',
      params: { scope: 'runtime', connectProtocol: 'V1' },
    });
    // The live read must happen before the hidden-wallet session is opened,
    // otherwise it restores the standard Protocol V1 session. Persistence
    // drain happens after the passphrase call before wallet creation.
    expect(callOrder).toEqual([
      'getDeviceState',
      'getPassphraseState',
      'waitForDeviceStateSync',
      'getFeaturesForHwWalletCreate',
      'waitForDeviceStateSync',
    ]);
    expect(service.getFeaturesForHwWalletCreate).toHaveBeenCalledWith({
      dbDevice: expect.objectContaining({ deviceStateInfo: SEEDED_STATE }),
      compatibleConnectId: 'CONNECT_ID_1',
    });
    expect(service.createHWWalletBase).toHaveBeenCalledWith(
      expect.objectContaining({
        connectProtocol: 'V1',
        deviceState: SEEDED_STATE,
        passphraseState: 'passphrase-state-1',
      }),
    );
  });

  it('skips the live read when a snapshot is already persisted', async () => {
    const callOrder: string[] = [];
    const persistedState = {
      ...SEEDED_STATE,
      identity: { deviceId: 'DEVICE_ID_1', serialNo: 'SERIAL_PERSISTED' },
    } as unknown as IOneKeyDeviceState;
    const dbDevice = buildDbDevice({
      connectProtocol: 'V1',
      deviceStateInfo: persistedState,
    });
    const { service, getDeviceStateMock } = buildService({
      dbDevice,
      callOrder,
    });

    await service.createHWHiddenWallet({ walletId: 'hw-wallet-1' });

    expect(getDeviceStateMock).not.toHaveBeenCalled();
    expect(service.createHWWalletBase).toHaveBeenCalledWith(
      expect.objectContaining({ deviceState: persistedState }),
    );
  });

  it('skips seeding for known Protocol V2 devices', async () => {
    const callOrder: string[] = [];
    const dbDevice = buildDbDevice({ connectProtocol: 'V2' });
    const { service, getDeviceStateMock } = buildService({
      dbDevice,
      callOrder,
    });

    await service.createHWHiddenWallet({ walletId: 'hw-wallet-1' });

    expect(getDeviceStateMock).not.toHaveBeenCalled();
    expect(service.createHWWalletBase).toHaveBeenCalledWith(
      expect.objectContaining({
        connectProtocol: 'V2',
        deviceState: undefined,
      }),
    );
  });

  it('backfills the connect protocol from the seeded state when unknown', async () => {
    const callOrder: string[] = [];
    const dbDevice = buildDbDevice();
    const { service, getDeviceStateMock } = buildService({
      dbDevice,
      callOrder,
    });

    await service.createHWHiddenWallet({ walletId: 'hw-wallet-1' });

    expect(getDeviceStateMock).toHaveBeenCalledWith({
      connectId: 'CONNECT_ID_1',
      params: { scope: 'runtime' },
    });
    expect(service.createHWWalletBase).toHaveBeenCalledWith(
      expect.objectContaining({
        connectProtocol: 'V1',
        deviceState: SEEDED_STATE,
      }),
    );
  });

  it('rejects a seeded normal-mode state without a live device identity', async () => {
    const callOrder: string[] = [];
    const dbDevice = buildDbDevice({ connectProtocol: 'V1' });
    const anonymousState = {
      protocol: 'V1',
      identity: { deviceId: null, serialNo: 'SERIAL_1' },
      status: { mode: 'normal' },
    } as unknown as IOneKeyDeviceState;
    const { service, getPassphraseStateMock } = buildService({
      dbDevice,
      callOrder,
      seededState: anonymousState,
    });

    await expect(
      service.createHWHiddenWallet({ walletId: 'hw-wallet-1' }),
    ).rejects.toThrow('Unable to resolve live hardware device identity');

    // Fail fast: the guard fires before the passphrase prompt or any creation.
    expect(getPassphraseStateMock).not.toHaveBeenCalled();
    expect(service.createHWWalletBase).not.toHaveBeenCalled();
  });

  it('prefers the persisted post-unlock snapshot over the pre-unlock seed', async () => {
    const callOrder: string[] = [];
    const dbDevice = buildDbDevice({ connectProtocol: 'V1' });
    const postUnlockState = {
      ...SEEDED_STATE,
      status: { mode: 'normal', unlocked: true, unlockedAttachPin: false },
    } as unknown as IOneKeyDeviceState;
    const { service, getDeviceByConnectIdMock } = buildService({
      dbDevice,
      callOrder,
      latestDbDevice: { deviceStateInfo: postUnlockState },
    });

    await service.createHWHiddenWallet({ walletId: 'hw-wallet-1' });

    // Downstream steps must consume the persisted post-unlock snapshot, not
    // the pre-unlock seed captured before the passphrase prompt.
    expect(service.getFeaturesForHwWalletCreate).toHaveBeenCalledWith({
      dbDevice: expect.objectContaining({ deviceStateInfo: postUnlockState }),
      compatibleConnectId: 'CONNECT_ID_1',
    });
    expect(service.createHWWalletBase).toHaveBeenCalledWith(
      expect.objectContaining({ deviceState: postUnlockState }),
    );
    expect(getDeviceByConnectIdMock).toHaveBeenNthCalledWith(1, {
      connectId: 'CONNECT_ID_1',
      featuresDeviceId: 'DEVICE_ID_1',
    });
  });

  it('never queries by an empty connectId for the post-unlock refresh', async () => {
    const callOrder: string[] = [];
    // Third-party USB records may legitimately have no connectId; an empty
    // connectId lookup would degenerate to "first OneKey device" in the DB.
    const dbDevice = buildDbDevice({ connectProtocol: 'V1', connectId: '' });
    const { service, getDeviceByConnectIdMock } = buildService({
      dbDevice,
      callOrder,
      latestDbDevice: {
        deviceStateInfo: {
          ...SEEDED_STATE,
          identity: { deviceId: 'UNRELATED_DEVICE', serialNo: 'UNRELATED' },
        } as unknown as IOneKeyDeviceState,
      },
    });

    await service.createHWHiddenWallet({ walletId: 'hw-wallet-1' });

    expect(getDeviceByConnectIdMock).not.toHaveBeenCalled();
    // The seeded state stays in place instead of an unrelated device's record.
    expect(service.createHWWalletBase).toHaveBeenCalledWith(
      expect.objectContaining({ deviceState: SEEDED_STATE }),
    );
  });

  it('reports isAttachPinMode from the persisted post-unlock state', async () => {
    const callOrder: string[] = [];
    const dbDevice = buildDbDevice({ connectProtocol: 'V1' });
    const postUnlockState = {
      ...SEEDED_STATE,
      status: { mode: 'normal', unlockedAttachPin: false },
    } as unknown as IOneKeyDeviceState;
    const postDerivationState = {
      ...SEEDED_STATE,
      status: { mode: 'normal', unlockedAttachPin: true },
    } as unknown as IOneKeyDeviceState;
    const { service, getDeviceByConnectIdMock } = buildService({
      dbDevice,
      callOrder,
      latestDbDevice: {
        deviceStateInfo: postUnlockState,
      },
    });
    getDeviceByConnectIdMock
      .mockResolvedValueOnce({ deviceStateInfo: postUnlockState })
      .mockResolvedValueOnce({ deviceStateInfo: postDerivationState });
    service.getFeaturesForHwWalletCreate.mockResolvedValue({
      deviceId: 'DEVICE_ID_1',
      unlockedAttachPin: false,
    });

    const result = (await service.createHWHiddenWallet({
      walletId: 'hw-wallet-1',
    })) as { isAttachPinMode?: boolean };

    expect(result.isAttachPinMode).toBe(true);
  });
});
