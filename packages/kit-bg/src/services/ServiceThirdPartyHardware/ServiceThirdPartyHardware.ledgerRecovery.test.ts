import ServiceThirdPartyHardware from '.';

import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

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

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getDevice: jest.fn(),
    getDeviceByQuery: jest.fn(),
    updateDeviceConnectId: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    hardware: {
      sdkLog: {
        log: jest.fn(),
        thirdPartySearchDevicesResponse: jest.fn(),
      },
    },
  },
}));

function createService() {
  return new ServiceThirdPartyHardware({
    backgroundApi: {} as IBackgroundApi,
  });
}

function stubRecoverySteps(
  service: ServiceThirdPartyHardware,
  overrides?: {
    connectDevice?: jest.Mock;
    listInstalledAppNames?: jest.Mock;
    cancel?: jest.Mock;
    reset?: jest.Mock;
  },
) {
  const calls: string[] = [];
  const cancel =
    overrides?.cancel ??
    jest.fn(async () => {
      calls.push('cancel');
    });
  const reset =
    overrides?.reset ??
    jest.fn(async () => {
      calls.push('reset');
    });
  const ensureInit = jest.fn(async () => {
    calls.push('ensureAdaptersInitialized');
  });
  const connectDevice =
    overrides?.connectDevice ??
    jest.fn(async () => {
      calls.push('connectDevice');
      return { success: true as const, payload: { connectId: 'ledger-new' } };
    });
  const listInstalledAppNames =
    overrides?.listInstalledAppNames ??
    jest.fn(async () => {
      calls.push('listInstalledAppNames');
      return { success: true, payload: ['Bitcoin'] };
    });

  jest
    .spyOn(service, 'thirdPartyHardwareCancel')
    .mockImplementation(cancel as never);
  jest
    .spyOn(service, 'resetThirdPartyAdapter')
    .mockImplementation(reset as never);
  jest
    .spyOn(service, 'ensureAdaptersInitialized')
    .mockImplementation(ensureInit as never);
  jest
    .spyOn(service, 'connectDevice')
    .mockImplementation(connectDevice as never);
  jest
    .spyOn(service, 'thirdPartyHardwareListInstalledAppNames')
    .mockImplementation(listInstalledAppNames as never);

  return { calls, cancel, reset, ensureInit, connectDevice };
}

describe('ServiceThirdPartyHardware.recoverLedgerSession', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('cancels, drops the adapter, rebuilds it, reconnects and verifies in that order', async () => {
    const service = createService();
    const { calls, cancel, connectDevice } = stubRecoverySteps(service);

    const result = await service.recoverLedgerSession({
      connectId: 'ledger-old',
    });

    expect(calls).toEqual([
      'cancel',
      'reset',
      'ensureAdaptersInitialized',
      'connectDevice',
      'listInstalledAppNames',
    ]);
    expect(cancel).toHaveBeenCalledWith({
      vendor: EHardwareVendor.ledger,
      connectId: 'ledger-old',
    });
    expect(connectDevice).toHaveBeenCalledWith({
      vendor: EHardwareVendor.ledger,
      searchTargetId: 'ledger-old',
    });
    expect(result).toEqual({
      ok: true,
      connectId: 'ledger-new',
      installedApps: ['Bitcoin'],
    });
  });

  it('accepts an empty connectId, which is normal for USB Ledger', async () => {
    const service = createService();
    const { connectDevice } = stubRecoverySteps(service);

    const result = await service.recoverLedgerSession({});

    expect(connectDevice).toHaveBeenCalledWith({
      vendor: EHardwareVendor.ledger,
      searchTargetId: '',
    });
    expect(result.ok).toBe(true);
  });

  it('keeps going when cancel and reset throw, since the session is already broken', async () => {
    const service = createService();
    const { calls, connectDevice } = stubRecoverySteps(service, {
      cancel: jest.fn(async () => {
        throw new OneKeyLocalError('nothing in flight');
      }),
      reset: jest.fn(async () => {
        throw new OneKeyLocalError('dispose failed');
      }),
    });

    const result = await service.recoverLedgerSession({ connectId: 'ledger' });

    expect(connectDevice).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([
      'ensureAdaptersInitialized',
      'connectDevice',
      'listInstalledAppNames',
    ]);
    expect(result.ok).toBe(true);
  });

  it('reports a serializable failure when the reconnect fails', async () => {
    const service = createService();
    stubRecoverySteps(service, {
      connectDevice: jest.fn(async () => ({
        success: false,
        payload: {
          code: HardwareErrorCode.DeviceNotFound,
          error: 'No Ledger found',
          _tag: 'DeviceNotAdvertisingError',
        },
      })),
    });

    const result = await service.recoverLedgerSession({ connectId: 'ledger' });

    expect(result).toEqual({
      ok: false,
      failure: {
        code: HardwareErrorCode.DeviceNotFound,
        error: 'No Ledger found',
        _tag: 'DeviceNotAdvertisingError',
      },
    });
  });

  it('reports a failure when the post-reconnect probe fails', async () => {
    const service = createService();
    stubRecoverySteps(service, {
      listInstalledAppNames: jest.fn(async () => ({
        success: false,
        payload: {
          code: HardwareErrorCode.DeviceLocked,
          error: 'Unlock the device',
        },
      })),
    });

    const result = await service.recoverLedgerSession({ connectId: 'ledger' });

    expect(result).toEqual({
      ok: false,
      failure: {
        code: HardwareErrorCode.DeviceLocked,
        error: 'Unlock the device',
      },
    });
  });

  it('serializes concurrent recoveries so one reset cannot land inside another connect', async () => {
    const service = createService();
    const calls: string[] = [];
    let releaseFirstConnect: (() => void) | undefined;
    const connectGate = new Promise<void>((resolve) => {
      releaseFirstConnect = resolve;
    });
    let connectCount = 0;
    stubRecoverySteps(service, {
      cancel: jest.fn(async () => {
        calls.push('cancel');
      }),
      reset: jest.fn(async () => {
        calls.push('reset');
      }),
      connectDevice: jest.fn(async () => {
        connectCount += 1;
        calls.push('connectDevice');
        if (connectCount === 1) {
          await connectGate;
        }
        return { success: true, payload: { connectId: 'ledger-new' } };
      }),
      listInstalledAppNames: jest.fn(async () => {
        calls.push('listInstalledAppNames');
        return { success: true, payload: ['Bitcoin'] };
      }),
    });

    const first = service.recoverLedgerSession({ connectId: 'ledger' });
    const second = service.recoverLedgerSession({ connectId: 'ledger' });
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }

    expect(calls).toEqual(['cancel', 'reset', 'connectDevice']);

    releaseFirstConnect?.();
    await Promise.all([first, second]);

    expect(calls).toEqual([
      'cancel',
      'reset',
      'connectDevice',
      'listInstalledAppNames',
      'cancel',
      'reset',
      'connectDevice',
      'listInstalledAppNames',
    ]);
  });
});
