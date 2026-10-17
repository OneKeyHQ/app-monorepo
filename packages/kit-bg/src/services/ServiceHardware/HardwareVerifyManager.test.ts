/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */
import { EDeviceType } from '@onekeyfe/hd-shared';

import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IFirmwareVerifyResult } from '@onekeyhq/shared/types/device';

import { HardwareVerifyManager } from './HardwareVerifyManager';

import type { IFirmwareAuthenticateParams } from './HardwareVerifyManager';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

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

  beforeEach(() => {
    jest.clearAllMocks();
    getTime.mockResolvedValue(SERVER_TIME);
    post = jest.fn<ReturnType<typeof post>, Parameters<typeof post>>(
      async () => ({ data: { code: 0, data: { sno: 'test' } } }),
    );
    const backgroundApi = {
      serviceHardware: { getClient: async () => ({ post }) },
      serviceHardwareUI: {
        withHardwareProcessing: async (callback: () => Promise<unknown>) =>
          callback(),
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

  it('generates a new signed challenge on every retry', async () => {
    await manager.firmwareAuthenticate({ device });
    await manager.firmwareAuthenticate({ device });
    expect(getTime).toHaveBeenCalledTimes(2);
    expect(sign).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][1].data).not.toBe(post.mock.calls[1][1].data);
  });

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

  it('does not sign or submit when time is unavailable', async () => {
    getTime.mockResolvedValue(undefined);
    await expect(manager.firmwareAuthenticate({ device })).rejects.toThrow();
    expect(sign).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('preserves the server expiry rejection', async () => {
    post.mockResolvedValue({
      data: { code: 10_102, message: 'Timestamp expired' },
    });
    const result = await manager.firmwareAuthenticate({ device });
    expect(result.verified).toBe(false);
    expect(result.result?.code).toBe(10_102);
    expect(post).toHaveBeenCalledTimes(1);
  });
});
