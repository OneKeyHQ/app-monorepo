import platformEnv from '@onekeyhq/shared/src/platformEnv';

export async function reportGooglePlayInstallAttribution(): Promise<void> {
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
    await import('@onekeyhq/shared/src/modules/GooglePlayInstallAttribution/reporter');
  await reportAttribution();
}
