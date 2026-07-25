import type { IFirmwareReleasePayload } from '@onekeyhq/shared/types/device';

import { FIRMWARE_ONBOARDING_MAX_VERSIONS_BEHIND } from './firmwareUpdateConsts';
import ServiceFirmwareUpdate from './ServiceFirmwareUpdate';

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
    get: jest.fn(),
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

jest.mock('../ServiceHardware/serviceHardwareUtils', () => ({
  __esModule: true,
  default: {
    hardwareLog: jest.fn(),
  },
}));

function createService() {
  return new ServiceFirmwareUpdate({
    backgroundApi: {
      serviceDevSetting: {
        getFirmwareUpdateDevSettings: jest.fn().mockResolvedValue(false),
      },
    } as unknown as IBackgroundApi,
  });
}

function createReleasePayload(status: 'outdated' | 'required') {
  return {
    status,
    bootloaderMode: false,
    release: {},
    features: undefined,
    connectId: undefined,
  } as unknown as IFirmwareReleasePayload;
}

describe('ServiceFirmwareUpdate force-upgrade policy', () => {
  it('uses a six-version onboarding gap', () => {
    expect(FIRMWARE_ONBOARDING_MAX_VERSIONS_BEHIND).toBe(6);
  });

  it.each([
    {
      name: 'minor gap six',
      fromVersion: '1.0.0',
      toVersion: '1.6.0',
      expected: false,
    },
    {
      name: 'minor gap seven',
      fromVersion: '1.0.0',
      toVersion: '1.7.0',
      expected: true,
    },
    {
      name: 'patch gap six',
      fromVersion: '1.2.0',
      toVersion: '1.2.6',
      expected: false,
    },
    {
      name: 'patch gap seven',
      fromVersion: '1.2.0',
      toVersion: '1.2.7',
      expected: true,
    },
  ])(
    'applies the six-version policy to $name',
    ({ fromVersion, toVersion, expected }) => {
      const service = createService();

      expect(
        service.isVersionTooOld(
          fromVersion,
          toVersion,
          FIRMWARE_ONBOARDING_MAX_VERSIONS_BEHIND,
        ),
      ).toBe(expected);
    },
  );

  it.each([
    {
      name: 'equal versions',
      fromVersion: '1.2.3',
      toVersion: '1.2.3',
    },
    {
      name: 'a version downgrade',
      fromVersion: '1.7.0',
      toVersion: '1.0.0',
    },
    {
      name: 'an invalid current version',
      fromVersion: 'invalid',
      toVersion: '1.7.0',
    },
    {
      name: 'an invalid target version',
      fromVersion: '1.0.0',
      toVersion: 'invalid',
    },
  ])('does not locally force $name', ({ fromVersion, toVersion }) => {
    const service = createService();

    expect(
      service.isVersionTooOld(
        fromVersion,
        toVersion,
        FIRMWARE_ONBOARDING_MAX_VERSIONS_BEHIND,
      ),
    ).toBe(false);
  });

  it('always forces a major-version upgrade', () => {
    const service = createService();

    expect(
      service.isVersionTooOld('2.99.99', '3.0.0', Number.MAX_SAFE_INTEGER),
    ).toBe(true);
  });

  it('keeps a remote required release forced within the local gap', async () => {
    const service = createService();
    const fromVersion = '1.0.0';
    const toVersion = '1.6.0';

    expect(
      service.isVersionTooOld(
        fromVersion,
        toVersion,
        FIRMWARE_ONBOARDING_MAX_VERSIONS_BEHIND,
      ),
    ).toBe(false);
    const status = await service.getFirmwareHasUpgradeStatus({
      releasePayload: createReleasePayload('required'),
      firmwareType: 'firmware',
      fromVersion,
      toVersion,
      fromFirmwareType: undefined,
      toFirmwareType: undefined,
    });

    expect(status).toEqual({
      hasUpgrade: true,
      hasUpgradeForce: true,
    });
  });

  it('keeps an outdated release optional at gap six', async () => {
    const service = createService();
    const fromVersion = '1.0.0';
    const toVersion = '1.6.0';

    const status = await service.getFirmwareHasUpgradeStatus({
      releasePayload: createReleasePayload('outdated'),
      firmwareType: 'firmware',
      fromVersion,
      toVersion,
      fromFirmwareType: undefined,
      toFirmwareType: undefined,
    });

    expect(status).toEqual({
      hasUpgrade: true,
      hasUpgradeForce: false,
    });
  });

  it.each([
    {
      name: 'equal versions',
      fromVersion: '1.0.0',
      toVersion: '1.0.0',
    },
    {
      name: 'a version downgrade',
      fromVersion: '1.6.0',
      toVersion: '1.0.0',
    },
  ])('clears remote required for $name', async ({ fromVersion, toVersion }) => {
    const service = createService();

    await expect(
      service.getFirmwareHasUpgradeStatus({
        releasePayload: createReleasePayload('required'),
        firmwareType: 'firmware',
        fromVersion,
        toVersion,
        fromFirmwareType: undefined,
        toFirmwareType: undefined,
      }),
    ).resolves.toEqual({
      hasUpgrade: false,
      hasUpgradeForce: false,
    });
  });
});
