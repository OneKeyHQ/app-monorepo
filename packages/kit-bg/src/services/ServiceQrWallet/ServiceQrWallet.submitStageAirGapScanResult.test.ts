/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */
import {
  OneKeyErrorScanQrCodeCancel,
  OneKeyLocalError,
  SecureQRCodeDialogCancel,
} from '@onekeyhq/shared/src/errors';
import { logSolanaTxDiagnostic } from '@onekeyhq/shared/src/logger/solanaTxDiagnostics';

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
    jsonToUr: jest.fn(() => ({ type: 'bytes' })),
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
jest.mock('@onekeyhq/shared/src/logger/solanaTxDiagnostics', () => ({
  logSolanaTxDiagnostic: jest.fn(),
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

  it.each([false, true])(
    'reports an invalid response as failed only, stage enabled: %s',
    async (isEnabled) => {
      const sdk = jest.requireMock<{
        airGapUrUtils: { qrcodeToUr: jest.Mock };
      }>('@onekeyhq/qr-wallet-sdk');
      sdk.airGapUrUtils.qrcodeToUr.mockRejectedValueOnce(
        new Error('synthetic-private-QR-value'),
      );
      const diagnostic = {
        correlationId: '11111111-2222-4333-8444-555555555555',
        startedAt: 1000,
      };
      const { service } = createStageService({
        isEnabled,
        begin: jest.fn<Promise<boolean>, []>().mockResolvedValue(true),
      });
      await expect(
        service.startTwoWayAirGapScanUr({ requestUr: {} as never, diagnostic }),
      ).rejects.toThrow();
      const responses = jest
        .mocked(logSolanaTxDiagnostic)
        .mock.calls.filter(([, details]) => details.stage === 'qrResponse');
      expect(responses).toEqual([
        [
          diagnostic,
          {
            stage: 'qrResponse',
            status: 'failed',
            reason: isEnabled ? 'stage' : 'legacy',
            errorCategory: 'invalidQrOrSignature',
          },
        ],
      ]);
      expect(JSON.stringify(responses)).not.toContain('synthetic-private');
    },
  );
});

describe('ServiceQrWallet stage session owner', () => {
  const createStageSessionService = () => {
    const callbacks = new Map<
      number,
      { resolve: (value: unknown) => void; reject: (error: unknown) => void }
    >();
    let nextCallbackId = 0;
    const deviceStageBurst = {
      isEnabled: jest.fn(async () => true),
      begin: jest.fn(async () => true),
      qrShowCode: jest.fn<Promise<void>, [{ sessionId: number }]>(
        async () => undefined,
      ),
      qrNoteScanCompleted: jest.fn(async () => undefined),
      end: jest.fn<Promise<void>, [{ error?: unknown }]>(async () => undefined),
    };
    const service = new ServiceQrWallet({
      backgroundApi: {
        serviceHardwareUI: { deviceStageBurst },
        servicePromise: {
          createCallback: (handlers: {
            resolve: (value: unknown) => void;
            reject: (error: unknown) => void;
          }) => {
            nextCallbackId += 1;
            callbacks.set(nextCallbackId, handlers);
            return nextCallbackId;
          },
          resolveCallback: async ({
            id,
            data,
          }: {
            id: number;
            data: unknown;
          }) => callbacks.get(id)?.resolve(data),
          rejectCallback: async ({
            id,
            error,
          }: {
            id: number;
            error: unknown;
          }) => callbacks.get(id)?.reject(error),
        },
      } as unknown as IBackgroundApi,
    });
    const codeShown = () =>
      new Promise<number>((resolve) => {
        deviceStageBurst.qrShowCode.mockImplementation(
          async ({ sessionId }) => {
            resolve(sessionId);
          },
        );
      });
    return { service, deviceStageBurst, codeShown };
  };

  // Settles to 'pending' when the call is still waiting on its session.
  const settledState = async (call: Promise<unknown>) =>
    Promise.race([
      call.then(
        () => 'resolved',
        () => 'rejected',
      ),
      new Promise((resolve) => {
        setTimeout(() => resolve('pending'), 0);
      }),
    ]);

  it('still lets a stage close end a session that names no owner', async () => {
    // The OneKey QR wallet passes no owner; the stage's own close is unchanged.
    const { service, deviceStageBurst, codeShown } =
      createStageSessionService();
    const shown = codeShown();

    const exchange = service.startTwoWayAirGapScan({
      type: 'bytes',
      cbor: 'a0',
    });
    await shown;
    await service.cancelStageAirGapScan({ scanning: true });

    await expect(exchange).rejects.toBeInstanceOf(OneKeyErrorScanQrCodeCancel);
    expect(deviceStageBurst.end).toHaveBeenCalledWith({
      error: expect.any(OneKeyErrorScanQrCodeCancel),
    });
  });

  it("ends a shown code when its owner's request ends, and only its owner's", async () => {
    const { service, deviceStageBurst, codeShown } =
      createStageSessionService();
    const shown = codeShown();

    const exchange = service.startTwoWayAirGapScan(
      { type: 'bytes', cbor: 'a0' },
      { owner: 'request-a' },
    );
    await shown;
    await service.cancelStageAirGapScan({ owner: 'request-b' });
    await expect(settledState(exchange)).resolves.toBe('pending');
    expect(deviceStageBurst.end).not.toHaveBeenCalled();

    await service.cancelStageAirGapScan({ owner: 'request-a' });

    await expect(exchange).rejects.toBeInstanceOf(SecureQRCodeDialogCancel);
    expect(deviceStageBurst.end).toHaveBeenCalledWith({
      error: expect.any(SecureQRCodeDialogCancel),
    });
  });

  it('keeps a code off the stage when its owner cancelled before it started', async () => {
    // The request ended while its start was still crossing the bridge.
    const { service, deviceStageBurst } = createStageSessionService();
    await service.cancelStageAirGapScan({ owner: 'request-a' });

    await expect(
      service.startTwoWayAirGapScan(
        { type: 'bytes', cbor: 'a0' },
        { owner: 'request-a' },
      ),
    ).rejects.toBeInstanceOf(SecureQRCodeDialogCancel);
    expect(deviceStageBurst.begin).not.toHaveBeenCalled();
    expect(deviceStageBurst.qrShowCode).not.toHaveBeenCalled();
  });

  it('closes the stage it opened when its owner cancels while it opens', async () => {
    const { service, deviceStageBurst } = createStageSessionService();
    let openStage: (opened: boolean) => void = () => undefined;
    const opening = new Promise<void>((resolve) => {
      deviceStageBurst.begin.mockImplementationOnce(
        () =>
          new Promise<boolean>((resolveBegin) => {
            openStage = resolveBegin;
            resolve();
          }),
      );
    });

    const exchange = service.startTwoWayAirGapScan(
      { type: 'bytes', cbor: 'a0' },
      { owner: 'request-a' },
    );
    await opening;
    await service.cancelStageAirGapScan({ owner: 'request-a' });
    openStage(true);

    await expect(exchange).rejects.toBeInstanceOf(SecureQRCodeDialogCancel);
    expect(deviceStageBurst.end).toHaveBeenCalledTimes(1);
    expect(deviceStageBurst.qrShowCode).not.toHaveBeenCalled();
  });

  it("does not let one owner's early cancel stop another owner's code", async () => {
    const { service, deviceStageBurst, codeShown } =
      createStageSessionService();
    const shown = codeShown();
    await service.cancelStageAirGapScan({ owner: 'request-a' });

    const exchange = service.startTwoWayAirGapScan(
      { type: 'bytes', cbor: 'a0' },
      { owner: 'request-b' },
    );
    await shown;
    expect(deviceStageBurst.qrShowCode).toHaveBeenCalledTimes(1);

    await service.cancelStageAirGapScan({ owner: 'request-b' });
    await expect(exchange).rejects.toBeInstanceOf(SecureQRCodeDialogCancel);
  });
});
