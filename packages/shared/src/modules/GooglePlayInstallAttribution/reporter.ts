import {
  getInstallReferrerAsync,
  getInstallationTimeAsync,
  nativeApplicationVersion,
} from 'expo-application';

import { analytics } from '../../analytics';
import platformEnv from '../../platformEnv';
import appStorage from '../../storage/appStorage';

const REPORTED_STORAGE_KEY = 'google_play_install_attribution_reported_v1';
const EVENT_NAME = 'googlePlayInstallAttribution';
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

type IReporterDependencies = {
  eligible: boolean;
  getInstallReferrer: () => Promise<string>;
  getInstallationTime: () => Promise<Date>;
  getReported: () => Promise<string | null>;
  markReported: () => Promise<void>;
  trackEventWithAck: (
    eventName: string,
    eventProps: Record<string, unknown>,
  ) => Promise<void>;
  installVersion: string;
};

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

export async function reportGooglePlayInstallAttribution(
  overrides: Partial<IReporterDependencies> = {},
): Promise<void> {
  const dependencies: IReporterDependencies = {
    eligible:
      platformEnv.isNativeAndroidGooglePlay === true &&
      platformEnv.isNativeMainThread === true,
    getInstallReferrer: getInstallReferrerAsync,
    getInstallationTime: getInstallationTimeAsync,
    getReported: () => appStorage.getItem(REPORTED_STORAGE_KEY),
    markReported: () => appStorage.setItem(REPORTED_STORAGE_KEY, '1'),
    trackEventWithAck: (eventName, eventProps) =>
      analytics.trackEventWithAck(eventName, eventProps),
    installVersion: nativeApplicationVersion ?? '',
    ...overrides,
  };

  if (!dependencies.eligible || (await dependencies.getReported())) {
    return;
  }

  const [rawReferrer, installationTime] = await Promise.all([
    dependencies.getInstallReferrer(),
    dependencies.getInstallationTime(),
  ]);
  const referrer = parseGooglePlayInstallReferrer(rawReferrer);
  await dependencies.trackEventWithAck(EVENT_NAME, {
    ...referrer,
    appChannel: 'googlePlay',
    attributionSource:
      referrer.clickId || referrer.utmCampaign
        ? 'campaign'
        : 'google_play_organic',
    installTimestampMs: installationTime.getTime(),
    installVersion: dependencies.installVersion,
  });
  await dependencies.markReported();
}
