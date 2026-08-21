import platformEnv from '@onekeyhq/shared/src/platformEnv';

export async function reportInstallAttribution(
  _utilityEndpoint: string,
  _installationId: string,
): Promise<void> {
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
