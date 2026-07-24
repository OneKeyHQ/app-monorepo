import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

import {
  HOME_PERPS_REFERRAL_BANNER_ID,
  buildHomeBannerCoverageFingerprint,
  toHomeBannerStoreItem,
} from '../sections/banner/homeBannerStoreModel';

import type {
  IHomeStoreSourceRequest,
  IHomeStoreSourceRequestHandle,
} from './useHomeStoreSourcePublisher';
import type {
  IHomeBannerReferralEligibility,
  IHomeBannerStorePayload,
} from '../sections/banner/homeBannerStoreModel';

export type IHomeBannerSourceGateway = {
  begin: (
    request: IHomeStoreSourceRequest<'banner'>,
  ) => IHomeStoreSourceRequestHandle<'banner'>;
  complete: (
    handle: IHomeStoreSourceRequestHandle<'banner'>,
    result:
      | {
          kind: 'success';
          data: IHomeBannerStorePayload;
          coverageFingerprint: string;
        }
      | {
          kind: 'partial';
          data: IHomeBannerStorePayload;
          coverageFingerprint: string;
        }
      | { kind: 'error'; errorKind: 'source' },
  ) => void;
};

export type IHomeBannerSourceApi = {
  readLocal: () => Promise<{
    topBanners?: IWalletBanner[];
    closedForever?: Record<string, boolean>;
  } | null>;
  fetchRemote: () => Promise<IWalletBanner[]>;
  fetchReferralEligibility: () => Promise<IHomeBannerReferralEligibility>;
  fetchBotWalletDeactivated: () => Promise<boolean>;
  updateLocalTopBanners: (banners: IWalletBanner[]) => Promise<unknown>;
};

export type IRunHomeBannerStoreRequestParams = {
  api: IHomeBannerSourceApi;
  createReferralBanner: (
    eligibility: IHomeBannerReferralEligibility,
  ) => IWalletBanner | null;
  gateway: IHomeBannerSourceGateway;
  hasBotWallet: boolean;
  networkId: string;
  ownerToken: { scopeKey: string; sessionId: string };
  paramsFingerprint: string;
  sessionDismissedIds: readonly string[];
  tronResource: IHomeBannerStorePayload['tronResource'];
};

function filterHomeBanners({
  banners,
  closedForever,
  networkId,
}: {
  banners: IWalletBanner[];
  closedForever: Record<string, boolean>;
  networkId: string;
}) {
  return banners.filter((banner) => {
    if (banner.position && banner.position !== 'home') {
      return false;
    }
    if (banner.networkIds?.length && !banner.networkIds.includes(networkId)) {
      return false;
    }
    return !closedForever[banner.id];
  });
}

function buildHomeBannerPayload({
  banners,
  botWalletReceiveBlocked,
  closedForever,
  createReferralBanner,
  networkId,
  referralEligibility,
  tronResource,
}: {
  banners: IWalletBanner[];
  botWalletReceiveBlocked: boolean;
  closedForever: Record<string, boolean>;
  createReferralBanner: (
    eligibility: IHomeBannerReferralEligibility,
  ) => IWalletBanner | null;
  networkId: string;
  referralEligibility: IHomeBannerReferralEligibility | null;
  tronResource: IHomeBannerStorePayload['tronResource'];
}): IHomeBannerStorePayload {
  const filteredBanners = filterHomeBanners({
    banners,
    closedForever,
    networkId,
  });
  const referralBanner = referralEligibility
    ? createReferralBanner(referralEligibility)
    : null;
  const visibleBanners = referralBanner
    ? [referralBanner, ...filteredBanners]
    : filteredBanners;
  return {
    banners: visibleBanners.map(toHomeBannerStoreItem),
    referralEligibility,
    tronResource,
    isBotWalletReceiveBlocked: botWalletReceiveBlocked,
  };
}

function getHomeBannerCoverageFingerprint(payload: IHomeBannerStorePayload) {
  return buildHomeBannerCoverageFingerprint({
    bannerIds: payload.banners.map((banner) => banner.id),
    hasTronResource: Boolean(payload.tronResource),
  });
}

export async function runHomeBannerStoreRequest({
  api,
  createReferralBanner,
  gateway,
  hasBotWallet,
  networkId,
  ownerToken,
  paramsFingerprint,
  sessionDismissedIds,
  tronResource,
}: IRunHomeBannerStoreRequestParams): Promise<
  IHomeBannerStorePayload | undefined
> {
  const handle = gateway.begin({
    ownerToken,
    paramsFingerprint,
    sourceId: 'banner',
  });

  const [localResult] = await Promise.allSettled([api.readLocal()]);
  const local = localResult.status === 'fulfilled' ? localResult.value : null;
  const closedForever = {
    ...local?.closedForever,
    ...Object.fromEntries(sessionDismissedIds.map((id) => [id, true])),
  };

  // The shared wallet-banner cache is sufficient for a safe early paint on
  // normal wallets. Bot wallets still wait for their receive-block status.
  if (!hasBotWallet && Array.isArray(local?.topBanners)) {
    const localPayload = buildHomeBannerPayload({
      banners: local.topBanners,
      botWalletReceiveBlocked: false,
      closedForever,
      createReferralBanner,
      networkId,
      referralEligibility: null,
      tronResource,
    });
    gateway.complete(handle, {
      kind: 'partial',
      data: localPayload,
      coverageFingerprint: getHomeBannerCoverageFingerprint(localPayload),
    });
  }

  const [remoteResult, referralResult, botStatusResult] =
    await Promise.allSettled([
      api.fetchRemote(),
      api.fetchReferralEligibility(),
      hasBotWallet ? api.fetchBotWalletDeactivated() : Promise.resolve(false),
    ]);

  if (localResult.status === 'rejected' && remoteResult.status === 'rejected') {
    gateway.complete(handle, { kind: 'error', errorKind: 'source' });
    return undefined;
  }

  const remoteBanners =
    remoteResult.status === 'fulfilled'
      ? remoteResult.value
      : (local?.topBanners ?? []);

  if (remoteResult.status === 'fulfilled') {
    await api.updateLocalTopBanners(remoteBanners).catch(() => undefined);
  }

  const referralEligibility =
    referralResult.status === 'fulfilled' ? referralResult.value : null;
  const payload = buildHomeBannerPayload({
    banners: remoteBanners,
    botWalletReceiveBlocked:
      hasBotWallet &&
      botStatusResult.status === 'fulfilled' &&
      botStatusResult.value,
    closedForever,
    createReferralBanner,
    networkId,
    referralEligibility,
    tronResource,
  });

  gateway.complete(handle, {
    kind: 'success',
    data: payload,
    coverageFingerprint: getHomeBannerCoverageFingerprint(payload),
  });
  return payload;
}

export function removeHomeBannerFromPayload({
  itemId,
  payload,
}: {
  itemId: string;
  payload: IHomeBannerStorePayload;
}): IHomeBannerStorePayload {
  return {
    ...payload,
    banners: payload.banners.filter((banner) => banner.id !== itemId),
    referralEligibility:
      itemId === HOME_PERPS_REFERRAL_BANNER_ID
        ? payload.referralEligibility && {
            ...payload.referralEligibility,
            shouldShow: false,
          }
        : payload.referralEligibility,
  };
}
