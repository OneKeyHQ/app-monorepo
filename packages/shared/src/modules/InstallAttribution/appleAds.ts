import { getInstallationTimeAsync } from 'expo-application';
import { NativeModules } from 'react-native';

import { EServiceEndpointEnum } from '../../../types/endpoint';
import { appApiClient } from '../../appApiClient/appApiClient';
import { OneKeyLocalError } from '../../errors';
import appStorage from '../../storage/appStorage';

const REPORTED_STORAGE_KEY = 'install_attr_apple_ads_v1';
const MAX_INSTALL_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const APPLE_ADS_ATTRIBUTION_PATH = '/utility/v1/install-attribution/apple-ads';
const INSTANCE_ID_HEADER = 'x-onekey-instance-id';

type IOneKeyAdServicesAttributionNativeModule = {
  getAttributionToken: () => Promise<string>;
};

function getNativeModule(): IOneKeyAdServicesAttributionNativeModule {
  const nativeModule = NativeModules.OneKeyAdServicesAttribution as
    | IOneKeyAdServicesAttributionNativeModule
    | undefined;
  if (!nativeModule) {
    throw new OneKeyLocalError(
      'Apple Ads attribution native module is unavailable',
    );
  }
  return nativeModule;
}

async function markAttributionHandled(): Promise<void> {
  await appStorage.setItem(REPORTED_STORAGE_KEY, '1');
}

function isRecentInstall(installationTime: Date): boolean {
  return Date.now() - installationTime.getTime() <= MAX_INSTALL_AGE_MS;
}

export async function reportAppleAdsInstallAttribution(
  utilityEndpoint: string,
  installationId: string,
): Promise<void> {
  if (await appStorage.getItem(REPORTED_STORAGE_KEY)) {
    return;
  }

  if (!isRecentInstall(await getInstallationTimeAsync())) {
    await markAttributionHandled();
    return;
  }

  const attributionToken = await getNativeModule().getAttributionToken();
  if (!attributionToken) {
    throw new OneKeyLocalError('Apple Ads attribution token is empty');
  }

  const client = await appApiClient.getClient({
    endpoint: utilityEndpoint,
    name: EServiceEndpointEnum.Utility,
  });
  await client.post(
    APPLE_ADS_ATTRIBUTION_PATH,
    { attributionToken },
    { headers: { [INSTANCE_ID_HEADER]: installationId } },
  );
  await markAttributionHandled();
}
