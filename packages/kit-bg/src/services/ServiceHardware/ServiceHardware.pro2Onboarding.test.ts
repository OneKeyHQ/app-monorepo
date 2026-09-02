import {
  OnboardingPhase,
  OnboardingSetupKind,
  OnboardingSetupMethod,
  OnboardingStep,
} from '@onekeyfe/hd-transport';

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
  // The real enum: the service builds its skipped/dialog event sets at
  // module scope, so an empty stub collapses both into Set{undefined}
  // and every event-routing assertion below stops proving anything.
  EHardwareUiStateAction: jest.requireActual(
    '@onekeyhq/shared/types/hardwareUi',
  ).EHardwareUiStateAction,
  hardwareForceTransportAtom: {
    get: jest.fn(async () => ({ forceTransportType: undefined })),
  },
  hardwareUiStateAtom: {},
  hardwareUiStateCompletedAtom: {},
  settingsPersistAtom: {},
}));

describe('ServiceHardware.getPro2OnboardingStatus', () => {
  it('uses the current Pro 2 onboarding protobuf contract', () => {
    expect(OnboardingStep.ONBOARDING_STEP_DONE).toBe(5);
    expect(OnboardingPhase.ONBOARDING_PHASE_SEEDCARD_BACKUP).toBe(13);
    expect(OnboardingSetupKind.ONBOARDING_SETUP_KIND_RESTORE).toBe(3);
  });

  it('uses the compatible connect ID and forces Protocol V2', async () => {
    const deviceGetOnboardingStatus = jest.fn().mockResolvedValue({
      success: true,
      payload: {
        step: OnboardingStep.ONBOARDING_STEP_SETUP,
        phase: OnboardingPhase.ONBOARDING_PHASE_SETUP_CHOICE,
        setup: {
          kind: OnboardingSetupKind.ONBOARDING_SETUP_KIND_CHOICE,
          method: OnboardingSetupMethod.ONBOARDING_SETUP_METHOD_UNKNOWN,
        },
        pin_set: true,
        wallet_initialized: false,
      },
    });
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    service.getCompatibleConnectId = jest.fn().mockResolvedValue('PRO2_USB');
    service.getSDKInstance = jest.fn().mockResolvedValue({
      deviceGetOnboardingStatus,
    } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);

    await expect(
      service.getPro2OnboardingStatus({ connectId: 'ORIGINAL_ID' }),
    ).resolves.toEqual({
      step: OnboardingStep.ONBOARDING_STEP_SETUP,
      phase: OnboardingPhase.ONBOARDING_PHASE_SETUP_CHOICE,
      setup: {
        kind: OnboardingSetupKind.ONBOARDING_SETUP_KIND_CHOICE,
        method: OnboardingSetupMethod.ONBOARDING_SETUP_METHOD_UNKNOWN,
      },
      pin_set: true,
      wallet_initialized: false,
    });

    expect(deviceGetOnboardingStatus).toHaveBeenCalledWith('PRO2_USB', {
      connectProtocol: 'V2',
    });
  });
});
