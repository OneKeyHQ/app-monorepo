import type { IKeyOfIcons } from '@onekeyhq/components';
import type { IHomeRuntimeJsonValue } from '@onekeyhq/shared/src/types/homeRuntime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { ENotificationPushMessageMode } from '@onekeyhq/shared/types/notification';
import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

export type IHomeBannerStoreItem = {
  readonly [key: string]: IHomeRuntimeJsonValue;
  readonly _id: string;
  readonly id: string;
  readonly src: string;
  readonly title: string;
  readonly description: string;
  readonly button: string;
  readonly hrefType: 'internal' | 'external' | null;
  readonly href: string | null;
  readonly mode: number | null;
  readonly payload: string | null;
  readonly rank: number;
  readonly closeable: boolean;
  readonly closeForever: boolean;
  readonly useSystemBrowser: boolean;
  readonly theme: 'light' | 'dark';
  readonly position: 'home' | 'receive' | null;
  readonly networkId: string | null;
  readonly networkIds: readonly string[];
  readonly icon: string | null;
};

export type IHomeBannerReferralEligibility = {
  readonly [key: string]: IHomeRuntimeJsonValue;
  readonly shouldShow: boolean;
  readonly resolvedAccountId: string;
  readonly resolvedAddress: string;
  readonly reason: string | null;
};

export type IHomeBannerStorePayload = {
  readonly [key: string]: IHomeRuntimeJsonValue;
  readonly banners: readonly IHomeBannerStoreItem[];
  readonly referralEligibility: IHomeBannerReferralEligibility | null;
  readonly tronResource: {
    readonly [key: string]: IHomeRuntimeJsonValue;
    readonly accountId: string;
    readonly networkId: string;
  } | null;
  readonly isBotWalletReceiveBlocked: boolean;
};

export const HOME_BANNER_ACTION_IDS = {
  bindReferral: 'home.banner.referralBind',
  dismiss: 'home.banner.dismiss',
  open: 'home.banner.open',
  snoozeReferral: 'home.banner.referralSnooze',
} as const;

export type IHomeBannerActionId =
  (typeof HOME_BANNER_ACTION_IDS)[keyof typeof HOME_BANNER_ACTION_IDS];

export const HOME_PERPS_REFERRAL_BANNER_ID = 'local-perps-referral';

export function buildHomeBannerCoverageFingerprint({
  bannerIds,
  hasTronResource,
}: {
  bannerIds: readonly string[];
  hasTronResource: boolean;
}): string {
  return stringUtils.stableStringify({
    bannerIds,
    hasTronResource,
  });
}

export function toHomeBannerStoreItem(
  banner: IWalletBanner,
): IHomeBannerStoreItem {
  return {
    _id: banner._id ?? banner.id ?? '',
    id: banner.id ?? banner._id ?? '',
    src: banner.src ?? '',
    title: banner.title ?? '',
    description: banner.description ?? '',
    button: banner.button ?? '',
    hrefType: banner.hrefType ?? null,
    href: banner.href ?? null,
    mode: banner.mode ?? null,
    payload: banner.payload ?? null,
    rank: banner.rank ?? 0,
    closeable: banner.closeable ?? false,
    closeForever: banner.closeForever ?? false,
    useSystemBrowser: banner.useSystemBrowser ?? false,
    theme: banner.theme ?? 'light',
    position: banner.position ?? null,
    networkId: banner.networkId ?? null,
    networkIds: banner.networkIds ?? [],
    icon: banner.icon ?? null,
  };
}

export function fromHomeBannerStoreItem(
  banner: IHomeBannerStoreItem,
): IWalletBanner {
  return {
    _id: banner._id,
    id: banner.id,
    src: banner.src,
    title: banner.title,
    description: banner.description,
    button: banner.button,
    rank: banner.rank,
    closeable: banner.closeable,
    closeForever: banner.closeForever,
    useSystemBrowser: banner.useSystemBrowser,
    theme: banner.theme,
    ...(banner.hrefType ? { hrefType: banner.hrefType } : {}),
    ...(banner.href ? { href: banner.href } : {}),
    ...(banner.mode
      ? { mode: banner.mode as ENotificationPushMessageMode }
      : {}),
    ...(banner.payload ? { payload: banner.payload } : {}),
    ...(banner.position ? { position: banner.position } : {}),
    ...(banner.networkId ? { networkId: banner.networkId } : {}),
    ...(banner.networkIds.length > 0
      ? { networkIds: [...banner.networkIds] }
      : {}),
    ...(banner.icon ? { icon: banner.icon as IKeyOfIcons } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isHomeBannerStoreItem(value: unknown): value is IHomeBannerStoreItem {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value._id === 'string' &&
    typeof value.id === 'string' &&
    typeof value.src === 'string' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.button === 'string' &&
    (value.hrefType === null ||
      value.hrefType === 'internal' ||
      value.hrefType === 'external') &&
    isNullableString(value.href) &&
    (value.mode === null || typeof value.mode === 'number') &&
    isNullableString(value.payload) &&
    typeof value.rank === 'number' &&
    typeof value.closeable === 'boolean' &&
    typeof value.closeForever === 'boolean' &&
    typeof value.useSystemBrowser === 'boolean' &&
    (value.theme === 'light' || value.theme === 'dark') &&
    (value.position === null ||
      value.position === 'home' ||
      value.position === 'receive') &&
    isNullableString(value.networkId) &&
    Array.isArray(value.networkIds) &&
    value.networkIds.every((networkId) => typeof networkId === 'string') &&
    isNullableString(value.icon)
  );
}

function isReferralEligibility(
  value: unknown,
): value is IHomeBannerReferralEligibility | null {
  return (
    value === null ||
    (isRecord(value) &&
      typeof value.shouldShow === 'boolean' &&
      typeof value.resolvedAccountId === 'string' &&
      typeof value.resolvedAddress === 'string' &&
      isNullableString(value.reason))
  );
}

function isTronResource(
  value: unknown,
): value is IHomeBannerStorePayload['tronResource'] {
  return (
    value === null ||
    (isRecord(value) &&
      typeof value.accountId === 'string' &&
      typeof value.networkId === 'string')
  );
}

export function readHomeBannerStorePayload(
  value: IHomeRuntimeJsonValue | undefined,
): IHomeBannerStorePayload | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const payload = value as Record<string, unknown>;
  if (
    !Array.isArray(payload.banners) ||
    !payload.banners.every(isHomeBannerStoreItem) ||
    typeof payload.isBotWalletReceiveBlocked !== 'boolean' ||
    !isTronResource(payload.tronResource) ||
    !isReferralEligibility(payload.referralEligibility)
  ) {
    return undefined;
  }
  return payload as IHomeBannerStorePayload;
}
