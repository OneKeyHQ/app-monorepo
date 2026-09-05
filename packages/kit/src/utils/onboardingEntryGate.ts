import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

type IOpenTravelModeSettings = (params: {
  admissionId: string;
}) => void | Promise<void>;

export function shouldRedirectOnboardingToTravelMode() {
  return (
    platformEnv.isNative &&
    travelModeManager.getRuntimeEnvironmentSync().profile.kind === 'travel-mode'
  );
}

export async function openTravelModeSettingsWithAdmission({
  openTravelModeSettings,
}: {
  openTravelModeSettings: IOpenTravelModeSettings;
}): Promise<boolean> {
  try {
    const { default: backgroundApiProxy } =
      await import('@onekeyhq/kit/src/background/instance/backgroundApiProxy');
    const { admissionId } =
      await backgroundApiProxy.serviceTravelMode.requestPageAdmission();
    await openTravelModeSettings({ admissionId });
    return true;
  } catch (error) {
    errorToastUtils.toastIfError(error);
    errorToastUtils.showToastOfError(error);
    return false;
  }
}

export async function enterOnboardingOrTravelMode({
  enterOnboarding,
  openTravelModeSettings,
}: {
  enterOnboarding: () => void | Promise<void>;
  openTravelModeSettings: IOpenTravelModeSettings;
}): Promise<'onboarding' | 'travel-mode' | 'cancelled'> {
  if (!shouldRedirectOnboardingToTravelMode()) {
    await enterOnboarding();
    return 'onboarding';
  }
  const opened = await openTravelModeSettingsWithAdmission({
    openTravelModeSettings,
  });
  return opened ? 'travel-mode' : 'cancelled';
}
