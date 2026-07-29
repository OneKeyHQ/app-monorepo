import {
  getInstallationTimeAsync,
  getInstallReferrerAsync,
} from 'expo-application';

import { defaultLogger } from '../../logger/logger';
import appStorage from '../../storage/appStorage';

const REPORTED_STORAGE_KEY = 'google_play_install_attribution_reported_v1';
const MAX_INSTALL_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_REFERRER_LENGTH = 2048;
const MAX_VALUE_LENGTH = 128;

const referrerFields = [
  ['click_id', 'clickId'],
  ['utm_campaign', 'utmCampaign'],
  ['utm_content', 'utmContent'],
  ['utm_id', 'utmId'],
  ['utm_medium', 'utmMedium'],
  ['utm_source', 'utmSource'],
  ['utm_term', 'utmTerm'],
] as const;

type IParsedReferrer = Partial<
  Record<(typeof referrerFields)[number][1], string>
>;

export function parseGooglePlayInstallReferrer(
  rawReferrer: string,
): IParsedReferrer {
  const parseSearchParams = (value: string) => {
    const searchParams = new URLSearchParams(value);
    const parsed: IParsedReferrer = {};
    for (const [referrerField, eventField] of referrerFields) {
      const fieldValue = searchParams.get(referrerField)?.trim();
      if (fieldValue) {
        parsed[eventField] = fieldValue.slice(0, MAX_VALUE_LENGTH);
      }
    }
    return parsed;
  };

  const boundedReferrer = rawReferrer.slice(0, MAX_REFERRER_LENGTH);
  let parsed = parseSearchParams(boundedReferrer);
  if (Object.keys(parsed).length === 0 && /%3D/i.test(boundedReferrer)) {
    try {
      parsed = parseSearchParams(decodeURIComponent(boundedReferrer));
    } catch {
      return parsed;
    }
  }
  return parsed;
}

async function markAttributionHandled(): Promise<void> {
  await appStorage.setItem(REPORTED_STORAGE_KEY, '1');
}

function isRecentInstall(installationTime: Date): boolean {
  return Date.now() - installationTime.getTime() <= MAX_INSTALL_AGE_MS;
}

export async function reportGooglePlayInstallAttribution(): Promise<void> {
  if (await appStorage.getItem(REPORTED_STORAGE_KEY)) {
    return;
  }

  if (!isRecentInstall(await getInstallationTimeAsync())) {
    await markAttributionHandled();
    return;
  }

  const rawReferrer = await getInstallReferrerAsync();
  defaultLogger.app.install.installReferrer(rawReferrer);
  if (!rawReferrer) {
    return;
  }

  const referrer = parseGooglePlayInstallReferrer(rawReferrer);
  if (Object.keys(referrer).length === 0) {
    return;
  }

  await defaultLogger.app.install.googlePlayInstallAttribution(referrer);
  await markAttributionHandled();
}
