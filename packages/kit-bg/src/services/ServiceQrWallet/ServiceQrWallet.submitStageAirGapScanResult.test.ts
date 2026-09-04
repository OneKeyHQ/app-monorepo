/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import ServiceQrWallet from './ServiceQrWallet';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

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
  EAppEventBusNames: { ShowAirGapQrcode: 'ShowAirGapQrcode' },
  appEventBus: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
}));

jest.mock('@onekeyhq/qr-wallet-sdk', () => ({
  airGapUrUtils: {
    urToJson: jest.fn(() => ({ type: 'bytes', cbor: 'mock' })),
    qrcodeToUr: jest.fn(async () => ({ type: 'bytes' })),
  },
}));

const mockSdkLog = jest.fn<void, [string, string]>();
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    hardware: {
      sdkLog: {
        log: (scene: string, message: string) => mockSdkLog(scene, message),
      },
    },
  },
}));

// The scan-result path never touches the vault graph or the wallet SDK;
// stub the heavy imports so the service can be constructed in isolation.
jest.mock('../../vaults/factory', () => ({ vaultFactory: {} }));
jest.mock('../ServiceAccount/defaultNetworkAccountsConfig', () => ({
  buildDefaultAddAccountNetworksForQrWallet: jest.fn(),
}));

const mockQrNoteScanCompleted = jest.fn<Promise<void>, []>();
const mockResolveCallback = jest.fn<
  Promise<void>,
  [{ id: number; data: unknown }]
>();
const mockRejectCallback = jest.fn<
  Promise<void>,
  [{ id: number; error: unknown }]
>();

type IStageAirGapSession = { promiseId: number; sessionId: number };

function createService() {
  const backgroundApi = {
    serviceHardwareUI: {
      deviceStageBurst: { qrNoteScanCompleted: mockQrNoteScanCompleted },
    },
    servicePromise: {
      resolveCallback: mockResolveCallback,
      rejectCallback: mockRejectCallback,
    },
  } as unknown as IBackgroundApi;
  const service = new ServiceQrWallet({ backgroundApi });
  const sessions = service as unknown as {
    stageAirGapSession: IStageAirGapSession | undefined;
  };
  return { service, sessions };
}

const scanResult = { raw: 'ur:bytes/mock' } as unknown as Parameters<
  ServiceQrWallet['submitStageAirGapScanResult']
>[0]['result'];

describe('ServiceQrWallet.submitStageAirGapScanResult', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQrNoteScanCompleted.mockResolvedValue(undefined);
    mockResolveCallback.mockResolvedValue(undefined);
    mockRejectCallback.mockResolvedValue(undefined);
  });

  it('resolves the pending scan even when the stage paint rejects', async () => {
    // The session is discarded before the paint; if the paint could take
    // the resolve down with it, nothing would be left to answer the call
    // until the callback expiry.
    const { service, sessions } = createService();
    sessions.stageAirGapSession = { promiseId: 7, sessionId: 3 };
    mockQrNoteScanCompleted.mockRejectedValue(
      new OneKeyLocalError(
        'native background thread jotai bridge is not ready',
      ),
    );

    await expect(
      service.submitStageAirGapScanResult({ result: scanResult, sessionId: 3 }),
    ).resolves.toBeUndefined();

    expect(mockResolveCallback).toHaveBeenCalledTimes(1);
    expect(mockResolveCallback).toHaveBeenCalledWith({
      id: 7,
      data: scanResult,
    });
    expect(mockRejectCallback).not.toHaveBeenCalled();
    expect(sessions.stageAirGapSession).toBeUndefined();
    expect(mockSdkLog).toHaveBeenCalledWith(
      'stage-air-gap-scan-completed-paint',
      'native background thread jotai bridge is not ready',
    );
  });

  it('paints the wait before resolving on the ordinary path', async () => {
    const { service, sessions } = createService();
    sessions.stageAirGapSession = { promiseId: 11, sessionId: 5 };
    const order: string[] = [];
    mockQrNoteScanCompleted.mockImplementation(async () => {
      order.push('paint');
    });
    mockResolveCallback.mockImplementation(async () => {
      order.push('resolve');
    });

    await service.submitStageAirGapScanResult({
      result: scanResult,
      sessionId: 5,
    });

    expect(order).toEqual(['paint', 'resolve']);
    expect(mockResolveCallback).toHaveBeenCalledWith({
      id: 11,
      data: scanResult,
    });
    expect(mockSdkLog).not.toHaveBeenCalled();
  });

  it('drops a frame from a superseded or cancelled session as a no-op', async () => {
    const { service, sessions } = createService();
    sessions.stageAirGapSession = { promiseId: 13, sessionId: 9 };

    await service.submitStageAirGapScanResult({
      result: scanResult,
      sessionId: 8,
    });

    expect(mockQrNoteScanCompleted).not.toHaveBeenCalled();
    expect(mockResolveCallback).not.toHaveBeenCalled();
    expect(sessions.stageAirGapSession).toEqual({
      promiseId: 13,
      sessionId: 9,
    });
  });
});

describe('ServiceQrWallet.startTwoWayAirGapScanUr stage bracket', () => {
  const { appEventBus } = jest.requireMock<{
    appEventBus: { emit: jest.Mock };
  }>('@onekeyhq/shared/src/eventBus/appEventBus');

  const createStageService = ({
    isEnabled,
    begin,
  }: {
    isEnabled: boolean;
    begin: jest.Mock<Promise<boolean>, []>;
  }) => {
    const qrShowCode = jest.fn<Promise<void>, []>().mockResolvedValue();
    const end = jest.fn<Promise<void>, []>().mockResolvedValue();
    // The legacy path parks on its own callback; resolve it at once so the
    // call can finish, and capture the id it handed out.
    const createCallback = jest.fn(
      ({ resolve }: { resolve: (value: unknown) => void }) => {
        resolve({ raw: 'ur:bytes/legacy', data: { fullData: '' } });
        return 42;
      },
    );
    const service = new ServiceQrWallet({
      backgroundApi: {
        serviceHardwareUI: {
          deviceStageBurst: {
            isEnabled: jest.fn(async () => isEnabled),
            begin,
            qrShowCode,
            end,
          },
        },
        servicePromise: {
          createCallback,
          resolveCallback: mockResolveCallback,
          rejectCallback: mockRejectCallback,
        },
      } as unknown as IBackgroundApi,
    });
    const sessions = service as unknown as {
      stageAirGapSession: IStageAirGapSession | undefined;
    };
    return { service, sessions, qrShowCode, end, createCallback };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('falls back to the legacy code toast when the gate closes between its read and begin()', async () => {
    // The firmware workflow raised its flag after isEnabled() answered
    // true: begin() declines. The QR beats paint past the gate, so painting on
    // the stale read would leave a code card no end() could ever close.
    const begin = jest.fn<Promise<boolean>, []>().mockResolvedValue(false);
    const { service, sessions, qrShowCode, end } = createStageService({
      isEnabled: true,
      begin,
    });

    await service.startTwoWayAirGapScanUr({
      requestUr: {} as never,
      allowPlainTextResponse: true,
    });

    expect(begin).toHaveBeenCalledTimes(1);
    expect(qrShowCode).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
    expect(sessions.stageAirGapSession).toBeUndefined();
    expect(appEventBus.emit).toHaveBeenCalledWith(
      'ShowAirGapQrcode',
      expect.objectContaining({ promiseId: 42 }),
    );
  });

  it('registers no session when begin() itself rejects', async () => {
    const begin = jest
      .fn<Promise<boolean>, []>()
      .mockRejectedValue(new OneKeyLocalError('stage bridge not ready'));
    const { service, sessions, createCallback } = createStageService({
      isEnabled: true,
      begin,
    });

    await expect(
      service.startTwoWayAirGapScanUr({ requestUr: {} as never }),
    ).rejects.toThrow('stage bridge not ready');

    expect(createCallback).not.toHaveBeenCalled();
    expect(sessions.stageAirGapSession).toBeUndefined();
  });
});
