/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */
import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  OneKeyLocalError,
  UserCancelFromOutside,
} from '@onekeyhq/shared/src/errors';
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IFirmwareVerifyResult } from '@onekeyhq/shared/types/device';

import {
  HardwareVerifyManager,
  parseWarrantyTime,
  toWarrantyState,
} from './HardwareVerifyManager';

import type { IFirmwareAuthenticateParams } from './HardwareVerifyManager';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IOneKeyHardwareOperationLease } from '../ServiceHardwareUI/HardwareProcessingManager';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundMethod: () => () => undefined,
  toastIfError: () => () => undefined,
}));
jest.mock('@onekeyhq/shared/src/utils/systemTimeUtils', () => ({
  __esModule: true,
  default: { getHardwareVerificationTime: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/utils/deviceUtils', () => ({
  __esModule: true,
  default: { isFirmwareVerifySupported: () => true },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { hardware: { sdkLog: { log: jest.fn() } } },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { HardwareVerifyAfterDeviceConfirm: 'confirmed' },
  appEventBus: { emit: jest.fn() },
}));
jest.mock('../../dbs/local/localDb', () => ({ __esModule: true, default: {} }));
jest.mock('../../states/jotai/atoms', () => ({
  settingsPersistAtom: { get: async () => ({ instanceId: 'test-instance' }) },
}));

const SERVER_TIME = Date.parse('2030-01-01T00:00:00Z');
const device = {
  connectId: 'mock-device',
  deviceType: EDeviceType.Classic1s,
} as IFirmwareAuthenticateParams['device'];

describe('hardware verification challenge time', () => {
  const getTime = jest.mocked(systemTimeUtils.getHardwareVerificationTime);
  let manager: HardwareVerifyManager;
  let post: jest.Mock<
    Promise<{
      data: { code: number; message?: string; data?: { sno: string } };
    }>,
    [string, IFirmwareVerifyResult['payload']]
  >;
  let sign: jest.SpiedFunction<HardwareVerifyManager['getDeviceCertWithSig']>;
  let controller: AbortController;

  beforeEach(() => {
    jest.clearAllMocks();
    getTime.mockResolvedValue(SERVER_TIME);
    controller = new AbortController();
    post = jest.fn<ReturnType<typeof post>, Parameters<typeof post>>(
      async () => ({ data: { code: 0, data: { sno: 'test' } } }),
    );
    const backgroundApi = {
      serviceHardware: { getClient: async () => ({ post }) },
      serviceHardwareUI: {
        withHardwareProcessing: async (
          callback: (lease: IOneKeyHardwareOperationLease) => Promise<unknown>,
        ) =>
          callback({
            deviceKey: undefined,
            owner: Symbol('test-operation'),
            signal: controller.signal,
          }),
        closeHardwareUiStateDialog: async () => undefined,
      },
    } as unknown as IBackgroundApi;
    manager = new HardwareVerifyManager({ backgroundApi });
    sign = jest.spyOn(manager, 'getDeviceCertWithSig').mockResolvedValue({
      cert: 'mock-cert',
      signature: 'mock-signature',
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('signs the server timestamp and submits exactly the signed bytes', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(SERVER_TIME - 316_000);
    const result = await manager.firmwareAuthenticate({ device });
    expect(result.verified).toBe(true);
    const payload = post.mock.calls[0][1];
    expect(payload.data).toMatch(
      new RegExp(`^test-instance_${SERVER_TIME}_.{12}$`),
    );
    expect(sign.mock.calls[0][0].dataHex).toBe(
      Buffer.from(payload.data).toString('hex'),
    );
    expect(payload.cert).toBe('mock-cert');
    expect(payload.signature).toBe('mock-signature');
  });

  it.each([SERVER_TIME, undefined])(
    'generates a new signed challenge on every retry with sampled time %s',
    async (sampledTime) => {
      getTime.mockResolvedValue(sampledTime);
      await manager.firmwareAuthenticate({ device });
      await manager.firmwareAuthenticate({ device });
      expect(getTime).toHaveBeenCalledTimes(2);
      expect(sign).toHaveBeenCalledTimes(2);
      expect(post.mock.calls[0][1].data).not.toBe(post.mock.calls[1][1].data);
    },
  );

  it('finishes unlocking before sampling time and signing', async () => {
    const events: string[] = [];
    Object.assign(manager.serviceHardware, {
      getDeviceState: async () => ({ status: { unlocked: false } }),
      getDeviceStateWithUnlock: async () => {
        events.push('unlock');
      },
    });
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    getTime.mockImplementation(async () => {
      events.push('time');
      return SERVER_TIME;
    });
    sign.mockImplementation(async () => {
      events.push('sign');
      return { cert: 'mock-cert', signature: 'mock-signature' };
    });
    await manager.firmwareAuthenticate({
      device: { ...device, deviceType: EDeviceType.Pro2 },
    });
    expect(events).toEqual(['unlock', 'time', 'sign']);
  });

  it.each(['unavailable response', 'network failure', 'timeout'])(
    'signs and submits fresh local time after %s',
    async (failure) => {
      let localTime = SERVER_TIME - 316_000;
      jest.spyOn(Date, 'now').mockImplementation(() => localTime);
      getTime.mockImplementation(async () => {
        localTime += 5000;
        if (failure !== 'unavailable response') {
          throw new OneKeyLocalError(failure);
        }
        return undefined;
      });

      const result = await manager.firmwareAuthenticate({ device });

      expect(result.verified).toBe(true);
      expect(sign).toHaveBeenCalledTimes(1);
      expect(post).toHaveBeenCalledTimes(1);
      const payload = post.mock.calls[0][1];
      expect(payload.data).toMatch(
        new RegExp(`^test-instance_${localTime}_.{12}$`),
      );
      expect(sign.mock.calls[0][0].dataHex).toBe(
        Buffer.from(payload.data).toString('hex'),
      );
    },
  );

  it.each([false, true])(
    'does not sign or submit after cancellation during time sampling (request fails: %s)',
    async (requestFails) => {
      getTime.mockImplementation(async () => {
        controller.abort();
        if (requestFails) {
          throw new OneKeyLocalError('timeout');
        }
        return undefined;
      });

      await expect(manager.firmwareAuthenticate({ device })).rejects.toThrow(
        UserCancelFromOutside,
      );
      expect(sign).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
    },
  );

  it.each([SERVER_TIME, undefined])(
    'preserves the server expiry rejection with sampled time %s',
    async (sampledTime) => {
      getTime.mockResolvedValue(sampledTime);
      post.mockResolvedValue({
        data: { code: 10_102, message: 'Timestamp expired' },
      });
      const result = await manager.firmwareAuthenticate({ device });
      expect(result.verified).toBe(false);
      expect(result.result?.code).toBe(10_102);
      expect(post).toHaveBeenCalledTimes(1);
    },
  );
});

describe('device warranty', () => {
  describe('parseWarrantyTime', () => {
    it('reads a date-only string as that calendar day', () => {
      const date = new Date(parseWarrantyTime('2027-09-14') ?? 0);
      expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([
        2027, 8, 14,
      ]);
    });

    it.each([
      [1_789_000_000, 1_789_000_000_000],
      [1_789_000_000_000, 1_789_000_000_000],
      ['1789000000000', 1_789_000_000_000],
      ['2026-09-14T00:00:00+08:00', Date.parse('2026-09-14T00:00:00+08:00')],
      // The format the server sends: the instant of the first check, in UTC.
      ['2026-09-07T06:00:57.703Z', Date.parse('2026-09-07T06:00:57.703Z')],
    ])('reads %p', (value, expected) => {
      expect(parseWarrantyTime(value)).toBe(expected);
    });

    it.each([null, undefined, '', 'soon', '20270914', 0, -1, {}])(
      'rejects %p',
      (value) => {
        expect(parseWarrantyTime(value)).toBeUndefined();
      },
    );
  });

  describe('toWarrantyState', () => {
    const endAt = Date.UTC(2027, 8, 14);
    const recordCheckedAt = (checkedAt: number) => ({
      cert: 'mock-cert',
      checkedAt,
      info: {
        status: 'in_warranty' as const,
        startAt: Date.UTC(2026, 8, 14),
        endAt,
      },
    });

    it('shows a verdict given before the end date as expired once it passes', () => {
      expect(
        toWarrantyState(recordCheckedAt(endAt - 1000), endAt + 1000).info
          ?.status,
      ).toBe('expired');
    });

    it('keeps a verdict the server gave after the end date', () => {
      expect(
        toWarrantyState(recordCheckedAt(endAt + 500), endAt + 1000).info
          ?.status,
      ).toBe('in_warranty');
    });

    it('reports whether a certificate is kept', () => {
      expect(toWarrantyState(undefined).hasCert).toBe(false);
      expect(toWarrantyState(recordCheckedAt(0)).hasCert).toBe(true);
    });
  });

  describe('lookups', () => {
    let manager: HardwareVerifyManager;
    let post: jest.Mock;
    let getRecord: jest.Mock;
    let updateRecord: jest.Mock<
      Promise<unknown>,
      [string, (prev: unknown) => unknown]
    >;
    const warrantyResponse = {
      data: {
        code: 0,
        data: {
          warrantyStatus: 'in_warranty',
          warrantyStartAt: '2026-09-14',
          warrantyEndAt: '2027-09-14',
          warrantyPeriodMonths: 12,
        },
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
      jest
        .mocked(systemTimeUtils.getHardwareVerificationTime)
        .mockResolvedValue(SERVER_TIME);
      getRecord = jest.fn(async () => ({ cert: 'mock-cert' }));
      updateRecord = jest.fn<
        Promise<unknown>,
        [string, (prev: unknown) => unknown]
      >(async (_serialNo, update) => update(undefined));
      post = jest.fn(async (url: string) =>
        url.endsWith('/warranty')
          ? warrantyResponse
          : { data: { code: 0, data: { sno: '  pr123 ' } } },
      );
      const backgroundApi = {
        serviceHardware: { getClient: async () => ({ post }) },
        serviceHardwareUI: {
          withHardwareProcessing: async (
            callback: (
              lease: IOneKeyHardwareOperationLease,
            ) => Promise<unknown>,
          ) =>
            callback({
              deviceKey: undefined,
              owner: Symbol('test-operation'),
              signal: new AbortController().signal,
            }),
          closeHardwareUiStateDialog: async () => undefined,
        },
        simpleDb: { deviceWarranty: { getRecord, updateRecord } },
      } as unknown as IBackgroundApi;
      manager = new HardwareVerifyManager({ backgroundApi });
      jest.spyOn(manager, 'getDeviceCertWithSig').mockResolvedValue({
        cert: 'mock-cert',
        signature: 'mock-signature',
      });
    });

    afterEach(() => jest.restoreAllMocks());

    it('keeps the certificate under the serial the server read', async () => {
      await manager.firmwareAuthenticate({ device });
      expect(updateRecord.mock.calls[0][0]).toBe('PR123');
      expect(updateRecord.mock.calls[0][1](undefined)).toEqual({
        cert: 'mock-cert',
      });
    });

    it.each(['', '   ', 123, undefined])(
      'keeps nothing for the serial %p',
      async (sno) => {
        post.mockResolvedValueOnce({ data: { code: 0, data: { sno } } });
        const result = await manager.firmwareAuthenticate({ device });
        expect(result.verified).toBe(true);
        expect(updateRecord).not.toHaveBeenCalled();
      },
    );

    it('shares one lookup between callers', async () => {
      const [first, second] = await Promise.all([
        manager.refreshDeviceWarranty({ serialNo: 'pr123' }),
        manager.refreshDeviceWarranty({ serialNo: 'PR123 ' }),
      ]);
      expect(
        post.mock.calls.filter(([url]) => String(url).endsWith('/warranty')),
      ).toHaveLength(1);
      expect(first.info?.status).toBe('in_warranty');
      expect(second).toEqual(first);
    });

    it('settles when the kept record cannot be read', async () => {
      getRecord.mockRejectedValue(new Error('storage unavailable'));
      const result = await manager.firmwareAuthenticate({ device });
      expect(result.verified).toBe(true);
      // The check kept the certificate; the lookup it started reads it back.
      expect(updateRecord).toHaveBeenCalledTimes(1);
      await expect(
        manager.refreshDeviceWarranty({ serialNo: 'PR123' }),
      ).resolves.toEqual({ hasCert: false, info: undefined });
    });

    it('keeps the last result when the lookup fails', async () => {
      getRecord.mockResolvedValue({
        cert: 'mock-cert',
        info: { status: 'expired' },
      });
      post.mockRejectedValueOnce(new Error('offline'));
      const state = await manager.refreshDeviceWarranty({ serialNo: 'PR123' });
      expect(state).toEqual({ hasCert: true, info: { status: 'expired' } });
      expect(updateRecord).not.toHaveBeenCalled();
    });
  });
});
