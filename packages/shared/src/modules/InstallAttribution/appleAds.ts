/* cspell:ignore adservices */
import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';
import { getInstallationTimeAsync } from 'expo-application';

import {
  EServiceEndpointEnum,
  type IApiClientResponse,
} from '../../../types/endpoint';
import { appApiClient } from '../../appApiClient/appApiClient';
import { OneKeyLocalError } from '../../errors';
import { defaultLogger } from '../../logger/logger';
import appStorage from '../../storage/appStorage';

import type { IAppleAdsInstallAttributionParams } from '../../logger/scopes/app/scenes/install';

const REPORTED_STORAGE_KEY = 'install_attr_apple_ads_v1';
const MAX_INSTALL_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const APPLE_ADS_ATTRIBUTION_PATH = '/utility/v1/install-attribution/apple-ads';
const INSTANCE_ID_HEADER = 'x-onekey-instance-id';
const MAX_FIELD_LENGTH = 128;

export type IAppleAdsAttributionData = {
  adGroupId?: string;
  adId?: string;
  campaignId?: string;
  claimType?: string;
  clickDate?: string;
  conversionType?: string;
  countryOrRegion?: string;
  impressionDate?: string;
  keywordId?: string;
  orgId?: string;
  supplyPlacement?: string;
};

type IAppleAdsAttributionResponse = {
  attribution: boolean;
  attributionData?: IAppleAdsAttributionData;
  duplicate?: boolean;
  handled: boolean;
};

async function markAttributionHandled(): Promise<void> {
  await appStorage.setItem(REPORTED_STORAGE_KEY, '1');
}

function isRecentInstall(installationTime: Date): boolean {
  return Date.now() - installationTime.getTime() <= MAX_INSTALL_AGE_MS;
}

function sanitizeField(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_FIELD_LENGTH) : undefined;
}

export function buildAppleAdsInstallAttributionParams(
  installationId: string,
  installationTimestamp: number,
  attributionData?: IAppleAdsAttributionData,
): IAppleAdsInstallAttributionParams {
  const adGroupId = sanitizeField(attributionData?.adGroupId);
  const adId = sanitizeField(attributionData?.adId);
  const campaignId = sanitizeField(attributionData?.campaignId);
  const claimType = sanitizeField(attributionData?.claimType);
  const clickDate = sanitizeField(attributionData?.clickDate);
  const conversionType = sanitizeField(attributionData?.conversionType);
  const countryOrRegion = sanitizeField(attributionData?.countryOrRegion);
  const impressionDate = sanitizeField(attributionData?.impressionDate);
  const keywordId = sanitizeField(attributionData?.keywordId);
  const orgId = sanitizeField(attributionData?.orgId);
  const supplyPlacement = sanitizeField(attributionData?.supplyPlacement);

  return {
    $insertId: `apple_ads_install_attr:${installationId}`,
    $timestamp: installationTimestamp,
    attributionSource: 'apple_ads_adservices',
    utmSource: 'apple_ads',
    utmMedium: supplyPlacement ?? claimType ?? 'asa',
    ...(campaignId ? { campaignId, utmCampaign: campaignId } : {}),
    ...(adGroupId ? { adGroupId } : {}),
    ...(keywordId ? { keywordId, utmTerm: keywordId } : {}),
    ...(adId ? { adId, utmContent: adId } : {}),
    ...(orgId ? { orgId } : {}),
    ...(conversionType ? { conversionType } : {}),
    ...(claimType ? { claimType } : {}),
    ...(countryOrRegion ? { countryOrRegion } : {}),
    ...(supplyPlacement ? { supplyPlacement } : {}),
    ...(clickDate ? { clickDate } : {}),
    ...(impressionDate ? { impressionDate } : {}),
  };
}

export async function reportAppleAdsInstallAttribution(
  utilityEndpoint: string,
  installationId: string,
): Promise<void> {
  if (await appStorage.getItem(REPORTED_STORAGE_KEY)) {
    return;
  }

  if (ReactNativeDeviceUtils.getInstallerPackageName() !== 'appStore') {
    return;
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
    { attributionToken },
    { headers: { [INSTANCE_ID_HEADER]: installationId } },
  );
  const result = response.data?.data;
  if (result?.handled !== true || typeof result.attribution !== 'boolean') {
    throw new OneKeyLocalError('Apple Ads attribution exchange is incomplete');
  }
  if (result.attribution) {
    await defaultLogger.app.install.reportAppleAdsInstallAttribution(
      buildAppleAdsInstallAttributionParams(
        installationId,
        installationTime.getTime(),
        result.attributionData,
      ),
    );
  }
  await markAttributionHandled();
}
