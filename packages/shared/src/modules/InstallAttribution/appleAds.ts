import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';
import {
  getAppleStoreEnvironmentAsync,
  getInstallationTimeAsync,
} from 'expo-application';

import {
  EServiceEndpointEnum,
  type IApiClientResponse,
} from '../../../types/endpoint';
import { appApiClient } from '../../appApiClient/appApiClient';
import { OneKeyLocalError } from '../../errors';
import appStorage from '../../storage/appStorage';

const REPORTED_STORAGE_KEY = 'install_attr_apple_ads_v1';
const MAX_INSTALL_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const APPLE_ADS_ATTRIBUTION_PATH = '/utility/v1/install-attribution/apple-ads';
const INSTANCE_ID_HEADER = 'x-onekey-instance-id';
type IAppleAdsAttributionResponse = {
  handled: true;
  delivery: 'server';
};

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

  const installer = ReactNativeDeviceUtils.getInstallerPackageName();
  if (installer !== 'appStore') {
    if (installer !== 'unknown') return;
    const environment = await getAppleStoreEnvironmentAsync().catch(
      () => undefined,
    );
    if (environment !== 'production') return;
  }

  const installationTime = await getInstallationTimeAsync();
  if (!isRecentInstall(installationTime)) {
    await markAttributionHandled();
    return;
  }

  const attributionToken =
    await ReactNativeDeviceUtils.getAppleAdsAttributionToken();
  if (!attributionToken) {
    throw new OneKeyLocalError('Apple Ads attribution token is empty');
  }

  const client = await appApiClient.getClient({
    endpoint: utilityEndpoint,
    name: EServiceEndpointEnum.Utility,
  });
  const response = await client.post<
    IApiClientResponse<IAppleAdsAttributionResponse>
  >(
    APPLE_ADS_ATTRIBUTION_PATH,
    { attributionToken, installedAt: installationTime.getTime() },
    { headers: { [INSTANCE_ID_HEADER]: installationId } },
  );
  const result = response.data?.data;
  // Legacy responses do not confirm that Utility has taken over event delivery.
  if (result?.handled !== true || result.delivery !== 'server') {
    throw new OneKeyLocalError('Apple Ads attribution exchange is incomplete');
  }
  await markAttributionHandled();
}
