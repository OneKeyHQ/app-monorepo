import ServiceHardware from './ServiceHardware';

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
  EAppEventBusNames: {},
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
    getDeviceByQuery: jest.fn(),
  },
}));

jest.mock('../../states/jotai/atoms', () => ({
  EHardwareUiStateAction: {},
  hardwareForceTransportAtom: {
    get: jest.fn(async () => ({ forceTransportType: undefined })),
  },
  hardwareUiStateAtom: {},
  hardwareUiStateCompletedAtom: {},
  settingsPersistAtom: {},
}));

const createService = ({ unlocked }: { unlocked: boolean }) => {
  const deviceInfoGet = jest.fn().mockResolvedValue({
    success: true,
    payload: {
      device_id: 'PRO2_DEVICE_ID',
      serial_number: 'PRO2_SERIAL',
    },
  });
  const deviceStatusGet = jest.fn().mockResolvedValue({
    success: true,
    payload: {
      device_id: 'PRO2_DEVICE_ID',
      unlocked,
      init_states: true,
      backup_required: false,
    },
  });
  const deviceSettingsGet = jest.fn().mockResolvedValue({
    success: true,
    payload: {
      label: 'OneKey Pro 2',
      language: 'en-US',
    },
  });
  const deviceSettingsSet = jest.fn().mockResolvedValue({
    success: true,
    payload: { message: 'Success' },
  });
  const deviceSettingsPageShow = jest.fn().mockResolvedValue({
    success: true,
    payload: { message: 'Success' },
  });
  const service = new ServiceHardware({
    backgroundApi: {} as unknown as IBackgroundApi,
  });
  service.getCompatibleConnectId = jest.fn().mockResolvedValue('PRO2_USB');
  service.getSDKInstance = jest.fn().mockResolvedValue({
    deviceInfoGet,
    deviceStatusGet,
    deviceSettingsGet,
    deviceSettingsSet,
    deviceSettingsPageShow,
  } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);

  return {
    service,
    deviceInfoGet,
    deviceStatusGet,
    deviceSettingsGet,
    deviceSettingsSet,
    deviceSettingsPageShow,
  };
};

describe('ServiceHardware.getPro2DeviceManagementSnapshot', () => {
  it('caches DeviceInfo and only reads DeviceSettings after unlock', async () => {
    const { service, deviceInfoGet, deviceStatusGet, deviceSettingsGet } =
      createService({ unlocked: false });

    await expect(
      service.getPro2DeviceManagementSnapshot({ connectId: 'ORIGINAL_ID' }),
    ).resolves.toEqual({
      info: {
        device_id: 'PRO2_DEVICE_ID',
        serial_number: 'PRO2_SERIAL',
      },
      status: {
        device_id: 'PRO2_DEVICE_ID',
        unlocked: false,
        init_states: true,
        backup_required: false,
      },
    });

    expect(deviceInfoGet).toHaveBeenCalledTimes(1);
    expect(deviceStatusGet).toHaveBeenCalledTimes(1);
    expect(deviceSettingsGet).not.toHaveBeenCalled();
    expect(deviceInfoGet).toHaveBeenCalledWith('PRO2_USB', {
      connectProtocol: 'V2',
      targets: {
        hw: true,
        fw: true,
        coprocessor: true,
        se1: true,
        se2: true,
        se3: true,
        se4: true,
      },
      types: {
        version: true,
        build_id: true,
        hash: true,
        specific: true,
      },
    });

    deviceStatusGet.mockResolvedValueOnce({
      success: true,
      payload: {
        device_id: 'PRO2_DEVICE_ID',
        unlocked: true,
        init_states: true,
        backup_required: false,
      },
    });

    await expect(
      service.getPro2DeviceManagementSnapshot({ connectId: 'ORIGINAL_ID' }),
    ).resolves.toEqual({
      info: {
        device_id: 'PRO2_DEVICE_ID',
        serial_number: 'PRO2_SERIAL',
      },
      status: {
        device_id: 'PRO2_DEVICE_ID',
        unlocked: true,
        init_states: true,
        backup_required: false,
      },
      settings: {
        label: 'OneKey Pro 2',
        language: 'en-US',
      },
    });

    expect(deviceInfoGet).toHaveBeenCalledTimes(1);
    expect(deviceStatusGet).toHaveBeenCalledTimes(2);
    expect(deviceSettingsGet).toHaveBeenCalledTimes(1);
  });

  it('supports explicit DeviceInfo refresh', async () => {
    const { service, deviceInfoGet } = createService({ unlocked: false });

    await service.getPro2DeviceManagementSnapshot({ connectId: 'PRO2' });
    await service.getPro2DeviceManagementSnapshot({
      connectId: 'PRO2',
      refreshInfo: true,
    });

    expect(deviceInfoGet).toHaveBeenCalledTimes(2);
  });

  it('refreshes DeviceInfo when DeviceStatus reports a different device ID', async () => {
    const { service, deviceInfoGet, deviceStatusGet } = createService({
      unlocked: false,
    });

    await service.getPro2DeviceManagementSnapshot({ connectId: 'PRO2' });
    deviceStatusGet.mockResolvedValueOnce({
      success: true,
      payload: {
        device_id: 'ANOTHER_DEVICE_ID',
        unlocked: false,
      },
    });
    await service.getPro2DeviceManagementSnapshot({ connectId: 'PRO2' });

    expect(deviceInfoGet).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent snapshot requests for one connection', async () => {
    const { service, deviceStatusGet } = createService({ unlocked: false });

    await Promise.all([
      service.getPro2DeviceManagementSnapshot({ connectId: 'PRO2' }),
      service.getPro2DeviceManagementSnapshot({ connectId: 'PRO2' }),
    ]);

    expect(deviceStatusGet).toHaveBeenCalledTimes(1);
  });
});

describe('ServiceHardware Pro 2 settings API', () => {
  it('gets and sets raw Protocol V2 settings', async () => {
    const { service, deviceSettingsGet, deviceSettingsSet } = createService({
      unlocked: true,
    });

    await expect(
      service.getPro2DeviceSettings({ connectId: 'ORIGINAL_ID' }),
    ).resolves.toEqual({
      label: 'OneKey Pro 2',
      language: 'en-US',
    });
    await service.setPro2DeviceSettings({
      connectId: 'ORIGINAL_ID',
      settings: {
        bt_enable: true,
        animation_enable: false,
        tap_to_wake: true,
        device_name_display_enabled: true,
        fido_enabled: true,
        experimental_features: false,
        usb_lock_enable: true,
        random_keypad: true,
      },
    });

    expect(deviceSettingsGet).toHaveBeenCalledWith('PRO2_USB', {
      connectProtocol: 'V2',
    });
    expect(deviceSettingsSet).toHaveBeenCalledWith('PRO2_USB', {
      connectProtocol: 'V2',
      settings: {
        bt_enable: true,
        animation_enable: false,
        tap_to_wake: true,
        device_name_display_enabled: true,
        fido_enabled: true,
        experimental_features: false,
        usb_lock_enable: true,
        random_keypad: true,
      },
    });
  });

  it('opens every firmware-supported settings page', async () => {
    const { service, deviceSettingsPageShow } = createService({
      unlocked: true,
    });

    for (const page of [
      'DeviceReset',
      'DevicePinChange',
      'DevicePassphrase',
      'DeviceAirgap',
    ] as const) {
      await service.showPro2DeviceSettingsPage({
        connectId: 'ORIGINAL_ID',
        page,
      });
    }

    expect(deviceSettingsPageShow.mock.calls).toEqual(
      [
        'DeviceReset',
        'DevicePinChange',
        'DevicePassphrase',
        'DeviceAirgap',
      ].map((page) => ['PRO2_USB', { connectProtocol: 'V2', page }]),
    );
  });
});
