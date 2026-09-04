import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import {
  type IRuntimeEnvironmentBarrier,
  RuntimeEnvironment,
} from '@onekeyhq/shared/src/travelMode/runtimeEnvironment';
import { getTravelModeRuntimeProfile } from '@onekeyhq/shared/src/travelMode/runtimeProfile';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import {
  enterOnboardingOrTravelMode,
  openTravelModeSettingsWithAdmission,
} from './onboardingEntryGate';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {
    showToastOfError: jest.fn(),
    toastIfError: jest.fn(),
  },
}));

jest.mock('../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceTravelMode: {
      requestPageAdmission: jest.fn(),
    },
  },
}));

const mockGetRuntimeEnvironmentSync = jest.spyOn(
  travelModeManager,
  'getRuntimeEnvironmentSync',
);
const mockRequestPageAdmission = jest.spyOn(
  backgroundApiProxy.serviceTravelMode,
  'requestPageAdmission',
);
const runProtectedOperation: IRuntimeEnvironmentBarrier['runProtectedOperation'] =
  async ({ operation }) => operation();
const runtimeBarrier: IRuntimeEnvironmentBarrier = {
  isBlockedSync: () => false,
  runProtectedOperation,
};
const standardRuntimeEnvironment = RuntimeEnvironment.create(
  getTravelModeRuntimeProfile(false),
  runtimeBarrier,
);
const travelModeRuntimeEnvironment = RuntimeEnvironment.create(
  getTravelModeRuntimeProfile(true),
  runtimeBarrier,
);

describe('onboardingEntryGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (platformEnv as { isNative: boolean }).isNative = true;
    mockGetRuntimeEnvironmentSync.mockReturnValue(standardRuntimeEnvironment);
  });

  it('keeps the original onboarding entry outside Travel Mode', async () => {
    const enterOnboarding = jest.fn();
    const openTravelModeSettings = jest.fn();

    await expect(
      enterOnboardingOrTravelMode({
        enterOnboarding,
        openTravelModeSettings,
      }),
    ).resolves.toBe('onboarding');

    expect(enterOnboarding).toHaveBeenCalledTimes(1);
    expect(openTravelModeSettings).not.toHaveBeenCalled();
    expect(mockRequestPageAdmission).not.toHaveBeenCalled();
  });

  it('requires admission and opens Travel Mode settings on native', async () => {
    mockGetRuntimeEnvironmentSync.mockReturnValue(travelModeRuntimeEnvironment);
    mockRequestPageAdmission.mockResolvedValue({ admissionId: 'admission-1' });
    const enterOnboarding = jest.fn();
    const openTravelModeSettings = jest.fn();

    await expect(
      enterOnboardingOrTravelMode({
        enterOnboarding,
        openTravelModeSettings,
      }),
    ).resolves.toBe('travel-mode');

    expect(enterOnboarding).not.toHaveBeenCalled();
    expect(mockRequestPageAdmission).toHaveBeenCalledTimes(1);
    expect(openTravelModeSettings).toHaveBeenCalledWith({
      admissionId: 'admission-1',
    });
  });

  it('does not redirect non-native onboarding', async () => {
    (platformEnv as { isNative: boolean }).isNative = false;
    mockGetRuntimeEnvironmentSync.mockReturnValue(travelModeRuntimeEnvironment);
    const enterOnboarding = jest.fn();

    await enterOnboardingOrTravelMode({
      enterOnboarding,
      openTravelModeSettings: jest.fn(),
    });

    expect(enterOnboarding).toHaveBeenCalledTimes(1);
    expect(mockRequestPageAdmission).not.toHaveBeenCalled();
  });

  it('keeps onboarding closed when admission is cancelled', async () => {
    const error = new Error('cancelled');
    mockRequestPageAdmission.mockRejectedValue(error);

    await expect(
      openTravelModeSettingsWithAdmission({
        openTravelModeSettings: jest.fn(),
      }),
    ).resolves.toBe(false);

    expect(errorToastUtils.toastIfError).toHaveBeenCalledWith(error);
    expect(errorToastUtils.showToastOfError).toHaveBeenCalledWith(error);
  });
});
