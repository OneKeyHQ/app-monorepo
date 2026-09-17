import platformEnv from '@onekeyhq/shared/src/platformEnv';

export async function reportInstallAttribution(): Promise<void> {
  if (
    !platformEnv.isNativeAndroidGooglePlay ||
    !platformEnv.isNativeMainThread
  ) {
    return;
  }

  const { reportGooglePlayInstallAttribution } =
    await import('@onekeyhq/shared/src/modules/InstallAttribution/googlePlay');
  await reportGooglePlayInstallAttribution();
}
