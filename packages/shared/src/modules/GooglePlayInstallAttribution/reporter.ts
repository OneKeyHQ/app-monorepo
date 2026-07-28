import { getInstallReferrerAsync } from 'expo-application';

import { defaultLogger } from '../../logger/logger';
import appStorage from '../../storage/appStorage';

const REPORTED_STORAGE_KEY = 'google_play_install_attribution_reported_v1';
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
  const searchParams = new URLSearchParams(rawReferrer.slice(0, 2048));
  const parsed: IParsedReferrer = {};
  for (const [referrerField, eventField] of referrerFields) {
    const value = searchParams.get(referrerField)?.trim();
    if (value) {
      parsed[eventField] = value.slice(0, MAX_VALUE_LENGTH);
    }
  }
  return parsed;
}

export async function reportGooglePlayInstallAttribution(): Promise<void> {
  if (await appStorage.getItem(REPORTED_STORAGE_KEY)) {
    return;
  }

  const referrer = parseGooglePlayInstallReferrer(
    await getInstallReferrerAsync(),
  );
  defaultLogger.app.install.googlePlayInstallAttribution(referrer);
  await appStorage.setItem(REPORTED_STORAGE_KEY, '1');
}
