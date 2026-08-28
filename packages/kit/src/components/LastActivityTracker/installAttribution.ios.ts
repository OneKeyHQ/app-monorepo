import { NativeModules } from 'react-native';

import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import { getEndpointByServiceName } from '@onekeyhq/shared/src/config/endpointsMap';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IAppClipInstallAttributionParams } from '@onekeyhq/shared/src/logger/scopes/app/scenes/install';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EServiceEndpointEnum,
  type IApiClientResponse,
} from '@onekeyhq/shared/types/endpoint';

type IAppClipAttributionRecord = IAppClipInstallAttributionParams & {
  schemaVersion: number;
};

type IAppClipAttributionNativeModule = {
  clearPending: () => Promise<void>;
  readPending: () => Promise<unknown>;
};

type IAppClipClaimResponse = {
  alreadyClaimed?: boolean;
  found: boolean;
  attribution?: IAppClipInstallAttributionParams;
  appClip?: {
    campaignId?: string;
    experience?: string;
    firstOpenedAt?: string;
    lastAction?: string;
    route?: string;
    selectedAddress?: string;
    selectedIsNative?: boolean;
    selectedNetwork?: string;
    selectedSymbol?: string;
  };
  shortLink?: {
    path?: string;
    version?: number;
  };
};

const CLICK_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/u;
const nativeModule = NativeModules.AppClipAttribution as
  | IAppClipAttributionNativeModule
  | undefined;
let reportInstallAttributionTask: Promise<void> | undefined;

function getPendingRecord(value: unknown): IAppClipAttributionRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    record.schemaVersion !== 1 ||
    typeof record.clickId !== 'string' ||
    !CLICK_ID_PATTERN.test(record.clickId)
  ) {
    return null;
  }
  const result: IAppClipAttributionRecord = {
    clickId: record.clickId,
    schemaVersion: 1,
  };
  const stringFields = [
    'campaignId',
    'experience',
    'lastAction',
    'route',
    'selectedNetwork',
    'selectedSymbol',
    'utmCampaign',
    'utmContent',
    'utmId',
    'utmMedium',
    'utmSource',
    'utmTerm',
  ] as const;
  for (const field of stringFields) {
    const fieldValue = record[field];
    if (typeof fieldValue === 'string' && fieldValue.length <= 128) {
      result[field] = fieldValue;
    }
  }
  const selectedAddress = record.selectedAddress;
  if (typeof selectedAddress === 'string' && selectedAddress.length <= 256) {
    result.selectedAddress = selectedAddress;
  }
  if (typeof record.selectedIsNative === 'boolean') {
    result.selectedIsNative = record.selectedIsNative;
  }
  return result;
}

async function reportPendingInstallAttribution(): Promise<void> {
  if (!platformEnv.isNativeMainThread || !nativeModule) {
    return;
  }
  const pending = getPendingRecord(await nativeModule.readPending());
  if (!pending?.clickId) {
    return;
  }
  const client = await appApiClient.getClient({
    endpoint: await getEndpointByServiceName(EServiceEndpointEnum.Utility),
    name: EServiceEndpointEnum.Utility,
  });
  const response = await client.post<IApiClientResponse<IAppClipClaimResponse>>(
    '/utility/v1/app-clip-attribution/claim',
    {
      clickId: pending.clickId,
    },
  );
  const claim = response.data.data;
  if (!claim.found) {
    return;
  }
  if (claim.alreadyClaimed) {
    await nativeModule.clearPending();
    return;
  }
  await defaultLogger.app.install.reportAppClipInstallAttribution({
    ...pending,
    ...claim.attribution,
    ...claim.appClip,
    clickId: pending.clickId,
    shortLinkPath: claim.shortLink?.path,
    shortLinkVersion: claim.shortLink?.version,
  });
  await nativeModule.clearPending();
}

export function reportInstallAttribution(): Promise<void> {
  reportInstallAttributionTask ??= reportPendingInstallAttribution().finally(
    () => {
      reportInstallAttributionTask = undefined;
    },
  );
  return reportInstallAttributionTask;
}
