import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import {
  createFirmwareUpdateSessionActions,
  getFirmwareUpdateSessionStartInput,
} from './useFirmwareUpdateSession';

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceFirmwareUpdate: {},
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useFirmwareUpdateProjectionAtom: () => [undefined],
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: false,
    isNative: false,
  },
}));

const createService = () => ({
  getFirmwareUpdateProjection: jest.fn().mockResolvedValue(undefined),
  startFirmwareUpdateSession: jest.fn(),
  executeFirmwareUpdateTransaction: jest.fn(),
  resumeFirmwareUpdateTransaction: jest.fn(),
  cancelFirmwareUpdateTransaction: jest.fn(),
});

describe('firmware update session actions', () => {
  it('requests a broadcast snapshot when the main runtime attaches late', async () => {
    const service = createService();
    const actions = createFirmwareUpdateSessionActions({
      service,
      isTransactionPlatform: true,
    });

    await actions.refresh();

    expect(service.getFirmwareUpdateProjection).toHaveBeenCalledWith({
      broadcast: true,
    });
  });

  it('passes only the session id and connect id to execution', async () => {
    const service = createService();
    const actions = createFirmwareUpdateSessionActions({
      service,
      isTransactionPlatform: true,
    });

    await actions.execute({
      sessionId: 'firmware-session',
      connectId: 'device-connect-id',
    });

    expect(service.executeFirmwareUpdateTransaction).toHaveBeenCalledWith({
      sessionId: 'firmware-session',
      connectId: 'device-connect-id',
    });
  });

  it('reduces a release result to the bounded session start DTO', () => {
    expect(
      getFirmwareUpdateSessionStartInput({
        originalConnectId: 'device-connect-id',
        updateInfos: {
          firmware: {
            hasUpgrade: true,
            toFirmwareType: 'universal',
          },
          bootloader: undefined,
          ble: undefined,
          bridge: undefined,
        },
      } as unknown as ICheckAllFirmwareReleaseResult),
    ).toEqual({
      connectId: 'device-connect-id',
      updateType: 'firmware',
      firmwareType: 'universal',
      confirmations: {
        backuped: true,
        usbConnected: true,
      },
    });
  });

  it('keeps SDK-managed platforms on the complete legacy flow', async () => {
    const service = createService();
    const actions = createFirmwareUpdateSessionActions({
      service,
      isTransactionPlatform: false,
    });

    await expect(
      actions.start({
        connectId: 'device-connect-id',
        updateType: 'firmware',
        confirmations: {
          backuped: true,
          usbConnected: true,
        },
      }),
    ).resolves.toEqual({
      engine: 'legacy',
      reason: 'sdk_managed_platform',
    });
    expect(service.startFirmwareUpdateSession).not.toHaveBeenCalled();
  });

  it('does not turn view detachment into a hardware cancel', async () => {
    const service = createService();
    const actions = createFirmwareUpdateSessionActions({
      service,
      isTransactionPlatform: true,
    });

    await actions.refresh();

    expect(service.cancelFirmwareUpdateTransaction).not.toHaveBeenCalled();
  });
});
