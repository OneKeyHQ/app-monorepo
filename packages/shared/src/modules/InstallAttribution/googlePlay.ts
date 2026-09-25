import {
  getInstallReferrerAsync,
  getInstallationTimeAsync,
  getLastUpdateTimeAsync,
} from 'expo-application';

import { defaultLogger } from '../../logger/logger';
import {
  INSTALL_REFERRER_INVITE_CODE_KEY,
  pickInviteCodeFromReferrerValue,
} from '../../referralCode/installReferrerUtils';
import appStorage from '../../storage/appStorage';

const REPORTED_STORAGE_KEY = 'install_attr_v1';
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

function getValidReferrerValue(value: string | null): string | undefined {
  const normalizedValue = value?.trim();
  if (!normalizedValue || normalizedValue.toLowerCase().includes('not set')) {
    return undefined;
  }
  return normalizedValue;
}

export interface IInstallAttributionSource {
  getInstallReferrer: () => Promise<string>;
  getInstallationTime: () => Promise<Date>;
  getLastUpdateTime: () => Promise<Date>;
}

/**
 * Lazily reads, then memoizes, the install facts both attribution consumers
 * need. `getInstallReferrerAsync` binds to the Play Store service over IPC, so
 * sharing one instance across a startup pass keeps it to a single bind even
 * when both consumers run. Each read still only happens if a consumer asks
 * for it, so an analytics report that is already handled keeps skipping the
 * store entirely.
 */
export function createInstallAttributionSource(): IInstallAttributionSource {
  let installReferrer: Promise<string> | undefined;
  let installationTime: Promise<Date> | undefined;
  let lastUpdateTime: Promise<Date> | undefined;
  return {
    getInstallReferrer: () => {
      installReferrer ??= getInstallReferrerAsync();
      return installReferrer;
    },
    getInstallationTime: () => {
      installationTime ??= getInstallationTimeAsync();
      return installationTime;
    },
    getLastUpdateTime: () => {
      lastUpdateTime ??= getLastUpdateTimeAsync();
      return lastUpdateTime;
    },
  };
}

/**
 * Reads a referrer string, retrying once against a decoded copy when the
 * first pass finds nothing and the raw value still looks percent-encoded —
 * some landing pages double-encode the value Play hands back.
 */
function readFromReferrer<T>({
  rawReferrer,
  read,
  isEmpty,
}: {
  rawReferrer: string;
  read: (searchParams: URLSearchParams) => T;
  isEmpty: (value: T) => boolean;
}): T {
  const boundedReferrer = rawReferrer.slice(0, MAX_REFERRER_LENGTH);
  const parsed = read(new URLSearchParams(boundedReferrer));
  if (!isEmpty(parsed) || !/%3D/i.test(boundedReferrer)) {
    return parsed;
  }
  try {
    return read(new URLSearchParams(decodeURIComponent(boundedReferrer)));
  } catch {
    return parsed;
  }
}

export function parseGooglePlayInstallReferrer(
  rawReferrer: string,
): IParsedReferrer {
  return readFromReferrer({
    rawReferrer,
    read: (searchParams) => {
      const parsed: IParsedReferrer = {};
      for (const [referrerField, eventField] of referrerFields) {
        const fieldValue = getValidReferrerValue(
          searchParams.get(referrerField),
        );
        if (fieldValue) {
          parsed[eventField] = fieldValue.slice(0, MAX_VALUE_LENGTH);
        }
      }
      return parsed;
    },
    isEmpty: (parsed) => Object.keys(parsed).length === 0,
  });
}

/**
 * Pulls the referral invite code out of a Play referrer string. Organic
 * installs and ad-tagged installs whose custom params Google Ads replaced
 * both yield undefined, which is an ordinary outcome rather than an error.
 */
export function extractInviteCodeFromInstallReferrer(
  rawReferrer: string,
): string | undefined {
  return readFromReferrer({
    rawReferrer,
    read: (searchParams) =>
      pickInviteCodeFromReferrerValue(
        getValidReferrerValue(
          searchParams.get(INSTALL_REFERRER_INVITE_CODE_KEY),
        ),
      ),
    isEmpty: (code) => code === undefined,
  });
}

async function markAttributionHandled(): Promise<void> {
  await appStorage.setItem(REPORTED_STORAGE_KEY, '1');
}

function isRecentInstall(installationTime: Date): boolean {
  return Date.now() - installationTime.getTime() <= MAX_INSTALL_AGE_MS;
}

/**
 * Reads the invite code carried by this install's referrer, plus the install
 * timestamp the auto-fill TTL is measured from.
 *
 * Only a fresh install is eligible. Android's package info keeps the first
 * install time across updates and moves the last update time, so the two
 * differ exactly when this installation has been upgraded — an existing user
 * reaching this version through an update, who is skipped without binding the
 * Play Store service.
 *
 * Deliberately separate from `reportGooglePlayInstallAttribution`: that one is
 * an analytics one-shot gated on a 7-day install-age window, while an invite
 * code stays useful for much longer and must survive until it is bound or
 * expires.
 */
export async function readGooglePlayInviteCodeAttribution(
  source: IInstallAttributionSource = createInstallAttributionSource(),
): Promise<{
  code: string | undefined;
  installedAt: number;
  hasReferrer: boolean;
  isExistingInstall: boolean;
}> {
  const [installationTime, lastUpdateTime] = await Promise.all([
    source.getInstallationTime(),
    source.getLastUpdateTime(),
  ]);
  if (lastUpdateTime.getTime() > installationTime.getTime()) {
    return {
      code: undefined,
      installedAt: installationTime.getTime(),
      hasReferrer: false,
      isExistingInstall: true,
    };
  }
  const rawReferrer = await source.getInstallReferrer();
  return {
    code: rawReferrer
      ? extractInviteCodeFromInstallReferrer(rawReferrer)
      : undefined,
    installedAt: installationTime.getTime(),
    // Play answered OK but handed back an empty string. Every genuine failure
    // rejects instead, so this is the one ambiguous outcome: it may be a
    // transient store hiccup rather than a definitive "no referrer".
    hasReferrer: Boolean(rawReferrer),
    isExistingInstall: false,
  };
}

export async function reportGooglePlayInstallAttribution(
  source: IInstallAttributionSource = createInstallAttributionSource(),
): Promise<void> {
  if (await appStorage.getItem(REPORTED_STORAGE_KEY)) {
    return;
  }

  if (!isRecentInstall(await source.getInstallationTime())) {
    await markAttributionHandled();
    return;
  }

  const rawReferrer = await source.getInstallReferrer();
  if (!rawReferrer) {
    return;
  }

  const referrer = parseGooglePlayInstallReferrer(rawReferrer);
  if (!referrer.utmSource) {
    return;
  }

  await defaultLogger.app.install.reportGooglePlayInstallAttribution(referrer);
  await markAttributionHandled();
}
