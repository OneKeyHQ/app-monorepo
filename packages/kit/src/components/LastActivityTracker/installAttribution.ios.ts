import { NativeModules } from 'react-native';

import { analytics } from '@onekeyhq/shared/src/analytics';
import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import { getEndpointByServiceName } from '@onekeyhq/shared/src/config/endpointsMap';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IAppClipInstallAttributionParams } from '@onekeyhq/shared/src/logger/scopes/app/scenes/install';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EInviteCodeAttributionSource,
  pickInviteCodeFromReferrerValue,
} from '@onekeyhq/shared/src/referralCode/installReferrerUtils';
import {
  EServiceEndpointEnum,
  type IApiClientResponse,
} from '@onekeyhq/shared/types/endpoint';

import { captureInstallInviteCode } from './installInviteCodeCapture';

import type { IInstallInviteCodeReadResult } from './installInviteCodeCapture';

type IAppClipAttributionRecord = IAppClipInstallAttributionParams & {
  openedAt?: number;
  reportCompleted?: boolean;
  schemaVersion: number;
};

type IAppClipAttributionNativeModule = {
  clearPending: (clickId: string) => Promise<void>;
  clearPendingHandoff?: (clickId: string, openedAt: number) => Promise<void>;
  readPending: () => Promise<unknown>;
  // Absent on native builds that predate the App Clip invite code handoff.
  readInviteCode?: () => Promise<unknown>;
  savePending: (record: IAppClipAttributionRecord) => Promise<boolean>;
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
let reportInstallAttributionRequested = false;
let captureAppClipInviteCodeTask: Promise<void> | undefined;

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
  if (
    typeof record.openedAt === 'number' &&
    Number.isFinite(record.openedAt) &&
    record.openedAt > 0
  ) {
    result.openedAt = record.openedAt;
  }
  const stringFields = [
    'campaignId',
    'experience',
    'firstOpenedAt',
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
  if (typeof record.reportCompleted === 'boolean') {
    result.reportCompleted = record.reportCompleted;
  }
  const shortLinkPath = record.shortLinkPath;
  if (typeof shortLinkPath === 'string' && shortLinkPath.length <= 256) {
    result.shortLinkPath = shortLinkPath;
  }
  const shortLinkVersion = record.shortLinkVersion;
  if (
    typeof shortLinkVersion === 'number' &&
    Number.isSafeInteger(shortLinkVersion) &&
    shortLinkVersion >= 0
  ) {
    result.shortLinkVersion = shortLinkVersion;
  }
  return result;
}

function isSamePendingHandoff(
  current: IAppClipAttributionRecord | null,
  expected: IAppClipAttributionRecord,
): boolean {
  if (!current || current.clickId !== expected.clickId) {
    return false;
  }
  if (current.openedAt !== undefined || expected.openedAt !== undefined) {
    return current.openedAt === expected.openedAt;
  }
  return true;
}

function clearPendingHandoff(
  clickId: string,
  openedAt?: number,
): Promise<void> {
  if (openedAt && nativeModule?.clearPendingHandoff) {
    return nativeModule.clearPendingHandoff(clickId, openedAt);
  }
  return nativeModule?.clearPending(clickId) ?? Promise.resolve();
}

function mergeClaimWithPending(
  claim: IAppClipClaimResponse,
  pending: IAppClipAttributionRecord,
): IAppClipAttributionRecord {
  const serverSnapshot = getPendingRecord({
    ...claim.attribution,
    ...claim.appClip,
    clickId: pending.clickId,
    schemaVersion: 1,
    shortLinkPath: claim.shortLink?.path,
    shortLinkVersion: claim.shortLink?.version,
  });
  return (
    getPendingRecord({
      ...pending,
      ...serverSnapshot,
      clickId: pending.clickId,
      experience: pending.experience ?? serverSnapshot?.experience,
      lastAction: pending.lastAction ?? serverSnapshot?.lastAction,
      route: pending.route ?? serverSnapshot?.route,
      schemaVersion: 1,
      selectedAddress: pending.selectedAddress,
      selectedIsNative: pending.selectedIsNative,
      selectedNetwork: pending.selectedNetwork,
      selectedSymbol: pending.selectedSymbol,
    }) ?? pending
  );
}

async function reportPendingInstallAttribution(): Promise<void> {
  if (!platformEnv.isNativeMainThread || !nativeModule) {
    return;
  }
  const pending = getPendingRecord(await nativeModule.readPending());
  if (!pending?.clickId) {
    return;
  }
  if (pending.reportCompleted) {
    await clearPendingHandoff(pending.clickId, pending.openedAt);
    return;
  }
  await analytics.whenInitialized();
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
    await clearPendingHandoff(pending.clickId, pending.openedAt);
    return;
  }
  const attribution = mergeClaimWithPending(claim, pending);
  const didSaveAttribution = await nativeModule.savePending(attribution);
  if (!didSaveAttribution) {
    const current = getPendingRecord(await nativeModule.readPending());
    if (!isSamePendingHandoff(current, pending)) {
      return;
    }
    throw new OneKeyLocalError(
      'Failed to persist App Clip attribution snapshot.',
    );
  }
  const { openedAt: _openedAt, ...reportAttribution } = attribution;
  await defaultLogger.app.install.reportAppClipInstallAttribution(
    reportAttribution,
  );
  const didSaveReportCompletion = await nativeModule.savePending({
    ...attribution,
    reportCompleted: true,
  });
  if (!didSaveReportCompletion) {
    const current = getPendingRecord(await nativeModule.readPending());
    if (!isSamePendingHandoff(current, pending)) {
      return;
    }
    throw new OneKeyLocalError(
      'Failed to persist App Clip attribution report completion.',
    );
  }
  await clearPendingHandoff(pending.clickId, pending.openedAt);
}

export function parseAppClipInviteCodeRecord(
  value: unknown,
): IInstallInviteCodeReadResult {
  // No explicit fresh-install check is needed here, unlike Android: only the
  // App Clip writes this record, and it cannot run once the full app is
  // installed, so an upgraded install never has one. That guarantee is the
  // iOS half of the FIRST-LAUNCH CONTRACT (`installInviteCodeCapture.ts`).
  if (!value || typeof value !== 'object') {
    // Nothing handed off: an App Store install that never went through the
    // App Clip, or an existing user updating. The App Group container is
    // migrated from the App Clip on install, so its contents at first launch
    // are final. Settled silently, like an Android upgrade, so the capture
    // event only counts installs that actually had an App Clip handoff.
    return {
      code: undefined,
      attributedAt: Date.now(),
      hasReferrer: true,
      isExistingInstall: true,
    };
  }
  const record = value as Record<string, unknown>;
  const capturedAt =
    typeof record.capturedAt === 'number' &&
    Number.isFinite(record.capturedAt) &&
    record.capturedAt > 0
      ? record.capturedAt
      : Date.now();
  return {
    code:
      record.schemaVersion === 1 && typeof record.code === 'string'
        ? pickInviteCodeFromReferrerValue(record.code)
        : undefined,
    attributedAt: capturedAt,
    hasReferrer: true,
  };
}

/**
 * Captures the invite code the App Clip stored from its invocation URL
 * (`ref_code`) into the same slot the Android Play referrer fills, so the bind
 * dialogs treat both identically.
 */
function captureAppClipInviteCode(): Promise<void> {
  const readInviteCode = nativeModule?.readInviteCode;
  return captureInstallInviteCode({
    source: EInviteCodeAttributionSource.iosAppClip,
    read: async () => {
      if (!readInviteCode) {
        // Stay pending so a later native build can still read the handoff.
        return undefined;
      }
      return parseAppClipInviteCodeRecord(await readInviteCode());
    },
  });
}

async function drainPendingInstallAttribution(): Promise<void> {
  do {
    reportInstallAttributionRequested = false;
    await reportPendingInstallAttribution();
  } while (reportInstallAttributionRequested);
}

/**
 * Starts the App Clip invite-code capture as early as the app can, ahead of
 * the analytics bootstrap, so a fresh install's code is already stored by the
 * time onboarding asks for it. Concurrent callers share the run in flight;
 * once a launch has resolved the capture, later ones stop at the persisted
 * flag.
 */
export function prefetchInstallInviteCode(): Promise<void> {
  if (!platformEnv.isNativeMainThread) {
    return Promise.resolve();
  }
  captureAppClipInviteCodeTask ??= captureAppClipInviteCode().finally(() => {
    captureAppClipInviteCodeTask = undefined;
  });
  return captureAppClipInviteCodeTask;
}

export function reportInstallAttribution(): Promise<void> {
  // Independent of the click-id report below, which needs the network and
  // clears its record once done; the invite code has no such dependency.
  void prefetchInstallInviteCode();
  reportInstallAttributionRequested = true;
  reportInstallAttributionTask ??= drainPendingInstallAttribution().finally(
    () => {
      reportInstallAttributionTask = undefined;
    },
  );
  return reportInstallAttributionTask;
}
