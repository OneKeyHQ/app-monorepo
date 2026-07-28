import platformEnv from '@onekeyhq/shared/src/platformEnv';

export async function reportInstallAttribution(): Promise<void> {
  if (
    !platformEnv.isNativeAndroidGooglePlay ||
    !platformEnv.isNativeMainThread
  ) {
    return;
  }

  const {
    reportGooglePlayInstallAttribution: reportAttribution,
  }: {
    reportGooglePlayInstallAttribution: () => Promise<void>;
  } =
    await import('@onekeyhq/shared/src/modules/InstallAttribution/googlePlay');
  await reportAttribution();
}
