import platformEnv from '@onekeyhq/shared/src/platformEnv';

export async function reportInstallAttribution(
  utilityEndpoint: string,
  installationId: string,
): Promise<void> {
  if (
    !platformEnv.isNativeIOSStore ||
    !platformEnv.isNativeMainThread ||
    platformEnv.isE2E
  ) {
    return;
  }

  const { reportAppleAdsInstallAttribution } =
    await import('@onekeyhq/shared/src/modules/InstallAttribution/appleAds');
  await reportAppleAdsInstallAttribution(utilityEndpoint, installationId);
}
