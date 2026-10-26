/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */
import { EDeviceType } from '@onekeyfe/hd-shared';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';
import simpleDb from '../../dbs/simple/simpleDb';

import ServiceHardware from './ServiceHardware';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBDevice, IDBDeviceSettings } from '../../dbs/local/types';
import type { ISimpleDBAppStatus } from '../../dbs/simple/entity/SimpleDbEntityAppStatus';

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
  EAppEventBusNames: {},
  appEventBus: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
}));

jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({
    LogLevel: { Debug: 0, Info: 1, Warning: 2, Error: 3 },
    NativeLogger: { write: jest.fn() },
  }),
);

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: true,
    isDev: true,
    isJest: true,
    isNative: false,
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
  default: {
    getAllDevices: jest.fn(),
    updateDeviceDbSettingsInPlace: jest.fn(),
  },
}));

jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {
    appStatus: {
      getRawData: jest.fn(),
      setRawData: jest.fn(),
    },
  },
}));

jest.mock('../../states/jotai/atoms', () => {
  const { EHardwareUiStateAction: HardwareUiStateAction } = jest.requireActual(
    '@onekeyhq/shared/types/hardwareUi',
  );
  return {
    EHardwareUiStateAction: HardwareUiStateAction,
    hardwareForceTransportAtom: {
      get: jest.fn(async () => ({ forceTransportType: undefined })),
    },
    hardwareUiStateAtom: { set: jest.fn(async () => undefined) },
    hardwareUiStateCompletedAtom: { set: jest.fn(async () => undefined) },
    settingsPersistAtom: {
      get: jest.fn(async () => ({ instanceId: 'INSTANCE_ID' })),
    },
  };
});

const buildDevice = ({
  id,
  deviceType = EDeviceType.Classic,
  vendor,
  settings,
}: {
  id: string;
  deviceType?: EDeviceType;
  vendor?: EHardwareVendor;
  settings?: IDBDeviceSettings;
}): IDBDevice =>
  ({
    id,
    deviceType,
    vendor,
    settings,
  }) as IDBDevice;

const createService = () =>
  new ServiceHardware({
    backgroundApi: {} as unknown as IBackgroundApi,
  });

describe('ServiceHardware.migrateClassicPinInputDefault', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(simpleDb.appStatus.getRawData).mockResolvedValue({});
    jest.mocked(simpleDb.appStatus.setRawData).mockResolvedValue({});
    jest
      .mocked(localDb.updateDeviceDbSettingsInPlace)
      .mockResolvedValue(undefined);
  });

  /** What the migration would store for a record holding `stored` at
   * write time — undefined when it leaves the record alone. */
  const storedAfterUpdate = (dbDeviceId: string, stored: IDBDeviceSettings) => {
    const call = jest
      .mocked(localDb.updateDeviceDbSettingsInPlace)
      .mock.calls.find(([params]) => params.dbDeviceId === dbDeviceId);
    expect(call).toBeDefined();
    return call?.[0].updater(stored);
  };

  it('flips the legacy creation default on button devices', async () => {
    jest.mocked(localDb.getAllDevices).mockResolvedValue({
      devices: [
        buildDevice({
          id: 'classic-1',
          settings: { inputPinOnSoftware: true },
        }),
        buildDevice({
          id: 'mini-1',
          deviceType: EDeviceType.Mini,
          settings: { inputPinOnSoftware: true, chainFingerprints: {} },
        }),
      ],
    });

    await createService().migrateClassicPinInputDefault();

    expect(localDb.updateDeviceDbSettingsInPlace).toHaveBeenCalledTimes(2);
    expect(
      storedAfterUpdate('classic-1', { inputPinOnSoftware: true }),
    ).toEqual({ inputPinOnSoftware: false });
    // The rest of the settings blob must survive the flip.
    expect(
      storedAfterUpdate('mini-1', {
        inputPinOnSoftware: true,
        chainFingerprints: {},
      }),
    ).toEqual({ inputPinOnSoftware: false, chainFingerprints: {} });
  });

  it('keeps a choice the stage switch wrote between the snapshot and the write', async () => {
    // The snapshot still shows the legacy default, but by the time the
    // record is written the person has turned app entry on from the stage
    // — the choice and its marker are what is stored now, and writing the
    // snapshot back whole would erase both.
    jest.mocked(localDb.getAllDevices).mockResolvedValue({
      devices: [
        buildDevice({
          id: 'classic-1',
          settings: { inputPinOnSoftware: true },
        }),
      ],
    });

    await createService().migrateClassicPinInputDefault();

    expect(
      storedAfterUpdate('classic-1', {
        inputPinOnSoftware: true,
        inputPinOnSoftwareSupport: true,
      }),
    ).toBeUndefined();
    // A record already turned off meanwhile is left alone as well.
    expect(
      storedAfterUpdate('classic-1', { inputPinOnSoftware: false }),
    ).toBeUndefined();
  });

  it('preserves a record carrying the explicit opt-in marker', async () => {
    jest.mocked(localDb.getAllDevices).mockResolvedValue({
      devices: [
        buildDevice({
          id: 'classic-opted-in',
          deviceType: EDeviceType.Classic1s,
          settings: {
            inputPinOnSoftware: true,
            inputPinOnSoftwareSupport: true,
          },
        }),
      ],
    });

    await createService().migrateClassicPinInputDefault();

    expect(localDb.updateDeviceDbSettingsInPlace).not.toHaveBeenCalled();
  });

  it('leaves records that are already off or unset untouched', async () => {
    jest.mocked(localDb.getAllDevices).mockResolvedValue({
      devices: [
        buildDevice({
          id: 'classic-off',
          settings: { inputPinOnSoftware: false },
        }),
        buildDevice({
          id: 'classic-unset',
          deviceType: EDeviceType.ClassicPure,
          settings: {},
        }),
        buildDevice({ id: 'classic-no-settings' }),
      ],
    });

    await createService().migrateClassicPinInputDefault();

    expect(localDb.updateDeviceDbSettingsInPlace).not.toHaveBeenCalled();
  });

  it('skips non-OneKey vendors and touchscreen models', async () => {
    jest.mocked(localDb.getAllDevices).mockResolvedValue({
      devices: [
        buildDevice({
          id: 'trezor-classic',
          vendor: EHardwareVendor.trezor,
          settings: { inputPinOnSoftware: true },
        }),
        buildDevice({
          id: 'touch',
          deviceType: EDeviceType.Touch,
          settings: { inputPinOnSoftware: true },
        }),
        buildDevice({
          id: 'pro',
          deviceType: EDeviceType.Pro,
          settings: { inputPinOnSoftware: true },
        }),
      ],
    });

    await createService().migrateClassicPinInputDefault();

    expect(localDb.updateDeviceDbSettingsInPlace).not.toHaveBeenCalled();
  });

  it('marks the migration done and is a no-op on the next run', async () => {
    jest.mocked(localDb.getAllDevices).mockResolvedValue({
      devices: [
        buildDevice({
          id: 'classic-1',
          settings: { inputPinOnSoftware: true },
        }),
      ],
    });

    const service = createService();
    await service.migrateClassicPinInputDefault();

    expect(localDb.updateDeviceDbSettingsInPlace).toHaveBeenCalledTimes(1);
    const updater = jest.mocked(simpleDb.appStatus.setRawData).mock
      .calls[0][0] as (
      v: ISimpleDBAppStatus | null | undefined,
    ) => ISimpleDBAppStatus;
    expect(updater({ removeDeviceHomeScreenMigrated: true })).toEqual({
      removeDeviceHomeScreenMigrated: true,
      classicPinInputDefaultMigrated: true,
    });

    jest
      .mocked(simpleDb.appStatus.getRawData)
      .mockResolvedValue({ classicPinInputDefaultMigrated: true });
    jest.mocked(localDb.updateDeviceDbSettingsInPlace).mockClear();
    jest.mocked(localDb.getAllDevices).mockClear();

    await service.migrateClassicPinInputDefault();

    expect(localDb.getAllDevices).not.toHaveBeenCalled();
    expect(localDb.updateDeviceDbSettingsInPlace).not.toHaveBeenCalled();
  });
});
