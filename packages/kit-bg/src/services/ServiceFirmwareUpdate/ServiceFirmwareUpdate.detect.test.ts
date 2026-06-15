import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';

import ServiceFirmwareUpdate from './ServiceFirmwareUpdate';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
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
    ShowFirmwareUpdateFromBootloaderMode:
      'ShowFirmwareUpdateFromBootloaderMode',
  },
  appEventBus: {
    emit: jest.fn(),
  },
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getDeviceByQuery: jest.fn(),
  },
}));

jest.mock('../../states/jotai/atoms', () => ({
  EFirmwareUpdateSteps: {
    init: 'init',
  },
  EHardwareUiStateAction: {},
  firmwareUpdateResultVerifyAtom: {
    set: jest.fn(),
  },
  firmwareUpdateRetryAtom: {
    set: jest.fn(),
  },
  firmwareUpdateStepInfoAtom: {
    set: jest.fn(),
  },
  firmwareUpdateWorkflowRunningAtom: {
    get: jest.fn(),
    set: jest.fn(),
  },
  firmwareUpdatesDetectStatusPersistAtom: {
    set: jest.fn(),
  },
  hardwareUiStateAtom: {
    set: jest.fn(),
  },
}));

const mockedLocalDb = jest.mocked(localDb);

describe('ServiceFirmwareUpdate.detectActiveAccountFirmwareUpdates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([EHardwareVendor.trezor, EHardwareVendor.ledger])(
    'skips %s devices before touching the OneKey hardware SDK path',
    async (vendor) => {
      mockedLocalDb.getDeviceByQuery.mockResolvedValue({
        id: 'db-device-1',
        connectId: 'THIRD_PARTY_USB_ID',
        usbConnectId: 'THIRD_PARTY_USB_ID',
        deviceId: 'THIRD_PARTY_DEVICE_ID',
        vendor,
        name: 'Third-party device',
        features: '{}',
        settingsRaw: '{}',
        createdAt: 0,
        updatedAt: 0,
      } as IDBDevice);

      const getCompatibleConnectId = jest.fn();
      const service = new ServiceFirmwareUpdate({
        backgroundApi: {
          serviceHardware: {
            getCompatibleConnectId,
          },
        } as unknown as IBackgroundApi,
      });

      await service.detectActiveAccountFirmwareUpdates({
        connectId: 'THIRD_PARTY_USB_ID',
      });

      expect(getCompatibleConnectId).not.toHaveBeenCalled();
    },
  );
});
