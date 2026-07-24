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

  const [localResult, remoteResult, referralResult, botStatusResult] =
    await Promise.allSettled([
      api.readLocal(),
      api.fetchRemote(),
      api.fetchReferralEligibility(),
      hasBotWallet ? api.fetchBotWalletDeactivated() : Promise.resolve(false),
    ]);

  if (localResult.status === 'rejected' && remoteResult.status === 'rejected') {
    gateway.complete(handle, { kind: 'error', errorKind: 'source' });
    return undefined;
  }

  const local = localResult.status === 'fulfilled' ? localResult.value : null;
  const closedForever = {
    ...local?.closedForever,
    ...Object.fromEntries(sessionDismissedIds.map((id) => [id, true])),
  };
  const remoteBanners =
    remoteResult.status === 'fulfilled'
      ? remoteResult.value
      : (local?.topBanners ?? []);
  const filteredBanners = filterHomeBanners({
    banners: remoteBanners,
    closedForever,
    networkId,
  });

  if (remoteResult.status === 'fulfilled') {
    await api.updateLocalTopBanners(remoteBanners).catch(() => undefined);
  }

  const referralEligibility =
    referralResult.status === 'fulfilled' ? referralResult.value : null;
  const referralBanner = referralEligibility
    ? createReferralBanner(referralEligibility)
    : null;
  const banners = referralBanner
    ? [referralBanner, ...filteredBanners]
    : filteredBanners;
  const payload: IHomeBannerStorePayload = {
    banners: banners.map(toHomeBannerStoreItem),
    referralEligibility,
    tronResource,
    isBotWalletReceiveBlocked:
      hasBotWallet &&
      botStatusResult.status === 'fulfilled' &&
      botStatusResult.value,
  };

  gateway.complete(handle, {
    kind: 'success',
    data: payload,
    coverageFingerprint: buildHomeBannerCoverageFingerprint({
      bannerIds: payload.banners.map((banner) => banner.id),
      hasTronResource: Boolean(payload.tronResource),
    }),
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
