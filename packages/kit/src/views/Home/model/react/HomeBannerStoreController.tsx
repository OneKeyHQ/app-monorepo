import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useHomeInteraction,
  useHomeResource,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import {
  HYPERLIQUID_REFERRAL_CODE,
  PERPS_NETWORK_ID,
} from '@onekeyhq/shared/src/consts/perp';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import { ERookieTaskType } from '@onekeyhq/shared/types/rookieGuide';
import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

import {
  EHomeBackgroundRecoveryRefreshDomain,
  useRegisterHomeBackgroundRecoveryRefresh,
} from '../../pages/HomeBackgroundRecoveryRefreshProvider';
import {
  HOME_BANNER_ACTION_IDS,
  HOME_PERPS_REFERRAL_BANNER_ID,
  readHomeBannerStorePayload,
} from '../sections/banner/homeBannerStoreModel';

import {
  removeHomeBannerFromPayload,
  runHomeBannerStoreRequest,
} from './homeBannerStoreControllerSource';
import { useStableHomeFactsOwner } from './homeStoreHooks';
import { useHomeStoreControllerActions } from './useHomeStoreControllerActions';
import { useHomeStoreSourcePublisher } from './useHomeStoreSourcePublisher';

import type {
  IHomeStoreSourceRequest,
  IHomeStoreSourceRequestHandle,
} from './useHomeStoreSourcePublisher';
import type { IHomeBannerStorePayload } from '../sections/banner/homeBannerStoreModel';
import type { IHomeStorePendingShellCommand } from '../store/homeStoreTypes';

function buildReferralBanner({
  description,
  eligibility,
  title,
}: {
  description: string;
  eligibility: IHomeBannerStorePayload['referralEligibility'];
  title: string;
}): IWalletBanner | null {
  if (!eligibility?.shouldShow) {
    return null;
  }
  return {
    _id: HOME_PERPS_REFERRAL_BANNER_ID,
    id: HOME_PERPS_REFERRAL_BANNER_ID,
    title,
    description,
    src: '',
    button: '',
    rank: 0,
    closeable: false,
    closeForever: false,
    useSystemBrowser: false,
    theme: 'light',
    position: 'home',
    icon: 'GiftSolid',
  };
}

export function HomeBannerStoreController() {
  const {
    activeAccount: { account, indexedAccount, network, vaultSettings, wallet },
  } = useActiveAccount({ num: 0 });
  const intl = useIntl();
  const stableOwner = useStableHomeFactsOwner();
  const interaction = useHomeInteraction();
  const bannerResource = useHomeResource('banner');
  const { beginHomeSourceRequest, completeHomeSourceRequest } =
    useHomeStoreSourcePublisher();
  const { markHomeSectionCommandHandled } = useHomeStoreControllerActions();
  const payloadRef = useRef<IHomeBannerStorePayload | undefined>(undefined);
  const dismissedIdsRef = useRef(new Set<string>());
  const requestGenerationRef = useRef(0);
  const processingCommandIdsRef = useRef(new Set<string>());

  const resourcePayload =
    bannerResource.kind === 'ready'
      ? readHomeBannerStorePayload(bannerResource.data)
      : undefined;
  useEffect(() => {
    if (resourcePayload) {
      payloadRef.current = resourcePayload;
    }
  }, [resourcePayload]);
  useEffect(() => {
    dismissedIdsRef.current = new Set(interaction.dismissedBannerIds);
  }, [interaction.dismissedBannerIds]);

  const accountId = account?.id;
  const indexedAccountId = indexedAccount?.id;
  const networkId = network?.id;
  const walletId = wallet?.id;
  const ownerMatches = Boolean(
    stableOwner &&
    stableOwner.owner.accountId === accountId &&
    stableOwner.owner.walletId === walletId &&
    (network?.isAllNetworks
      ? stableOwner.owner.network.kind === 'allNetworks'
      : stableOwner.owner.network.kind === 'singleNetwork' &&
        stableOwner.owner.network.networkId === networkId),
  );
  const enabled = Boolean(
    ownerMatches && stableOwner && accountId && networkId && walletId,
  );
  const hasBotWallet = accountUtils.isBotWallet({ walletId });
  const tronResource = useMemo(
    () =>
      vaultSettings?.hasResource && accountId && networkId
        ? { accountId, networkId }
        : null,
    [accountId, networkId, vaultSettings?.hasResource],
  );
  const referralTitle = intl.formatMessage({
    id: ETranslations.perps__claim_fee_discount__title,
  });
  const referralDescription = intl.formatMessage({
    id: ETranslations.perps__claim_fee_discount_short__desc,
  });
  const identityKey = useMemo(
    () =>
      enabled
        ? stringUtils.stableStringify({
            accountId,
            indexedAccountId,
            locale: intl.locale,
            networkId,
            tronResource,
            walletId,
          })
        : undefined,
    [
      accountId,
      enabled,
      indexedAccountId,
      intl.locale,
      networkId,
      tronResource,
      walletId,
    ],
  );

  const gateway = useMemo(
    () => ({
      begin: (request: IHomeStoreSourceRequest<'banner'>) =>
        beginHomeSourceRequest(request),
      complete: (
        handle: IHomeStoreSourceRequestHandle<'banner'>,
        result: Parameters<typeof completeHomeSourceRequest<'banner'>>[1],
      ) => completeHomeSourceRequest(handle, result),
    }),
    [beginHomeSourceRequest, completeHomeSourceRequest],
  );

  const refresh = useCallback(async () => {
    if (!enabled || !identityKey || !stableOwner || !accountId || !networkId) {
      return;
    }
    requestGenerationRef.current += 1;
    const generation = requestGenerationRef.current;
    const payload = await runHomeBannerStoreRequest({
      api: {
        readLocal: async () =>
          (await backgroundApiProxy.simpleDb.walletBanner.getRawData()) ?? null,
        fetchRemote: () =>
          backgroundApiProxy.serviceWalletBanner.fetchWalletBanner({
            accountId,
          }),
        fetchReferralEligibility: async () => {
          const deriveType =
            await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
              { networkId: PERPS_NETWORK_ID },
            );
          const result =
            await backgroundApiProxy.serviceHyperliquidReferral.checkBannerReferralEligibility(
              {
                accountId,
                indexedAccountId: indexedAccountId || undefined,
                deriveType,
              },
            );
          return {
            shouldShow: result.shouldShow,
            resolvedAccountId: result.resolvedAccountId,
            resolvedAddress: result.resolvedAddress,
            reason: result.reason ?? null,
          };
        },
        fetchBotWalletDeactivated: () =>
          backgroundApiProxy.serviceAccount.isBotWalletDeactivated({
            walletId: walletId ?? '',
          }),
        updateLocalTopBanners: (banners) =>
          backgroundApiProxy.serviceWalletBanner.updateLocalTopBanners({
            topBanners: banners,
          }),
      },
      createReferralBanner: (eligibility) =>
        buildReferralBanner({
          eligibility,
          title: referralTitle,
          description: referralDescription,
        }),
      gateway,
      hasBotWallet,
      networkId,
      ownerToken: stableOwner.ownerToken,
      paramsFingerprint: identityKey,
      sessionDismissedIds: [...dismissedIdsRef.current],
      tronResource,
    });
    if (payload && generation === requestGenerationRef.current) {
      payloadRef.current = payload;
    }
  }, [
    accountId,
    enabled,
    gateway,
    hasBotWallet,
    identityKey,
    indexedAccountId,
    networkId,
    referralDescription,
    referralTitle,
    stableOwner,
    tronResource,
    walletId,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!hasBotWallet) {
      return;
    }
    appEventBus.on(EAppEventBusNames.WalletUpdate, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, refresh);
    };
  }, [hasBotWallet, refresh]);

  useRegisterHomeBackgroundRecoveryRefresh({
    callback: refresh,
    domain: EHomeBackgroundRecoveryRefreshDomain.banner,
    enabled,
    operationKey: 'home-banner-store-source',
    owner: { accountId, networkId, walletId },
  });

  const completePayloadMutation = useCallback(
    async ({
      command,
      mutate,
    }: {
      command: IHomeStorePendingShellCommand;
      mutate: () => Promise<void>;
    }) => {
      if (!stableOwner || !identityKey || !payloadRef.current) {
        return;
      }
      const handle = beginHomeSourceRequest({
        ownerToken: stableOwner.ownerToken,
        paramsFingerprint: identityKey,
        sourceId: 'banner',
      });
      try {
        await mutate();
        const nextPayload = removeHomeBannerFromPayload({
          itemId: command.itemId ?? '',
          payload: payloadRef.current,
        });
        payloadRef.current = nextPayload;
        completeHomeSourceRequest(handle, {
          kind: 'success',
          data: nextPayload,
          coverageFingerprint: stringUtils.stableStringify(
            nextPayload.banners.map((banner) => banner.id),
          ),
        });
      } catch (error) {
        completeHomeSourceRequest(handle, {
          kind: 'error',
          errorKind: 'source',
        });
        throw error;
      }
    },
    [
      beginHomeSourceRequest,
      completeHomeSourceRequest,
      identityKey,
      stableOwner,
    ],
  );

  const runCommand = useCallback(
    async (command: IHomeStorePendingShellCommand) => {
      const payload = payloadRef.current;
      const item = payload?.banners.find(
        (candidate) => candidate.id === command.itemId,
      );
      if (!payload || !item) {
        return;
      }
      if (command.actionId === HOME_BANNER_ACTION_IDS.dismiss) {
        await completePayloadMutation({
          command,
          mutate: async () => {
            defaultLogger.wallet.walletBanner.walletBannerClicked({
              bannerId: item.id,
              type: 'close',
            });
            if (item.closeForever) {
              await backgroundApiProxy.serviceWalletBanner.updateClosedForeverBanners(
                { bannerId: item.id, closedForever: true },
              );
            }
          },
        });
        return;
      }

      const eligibility = payload.referralEligibility;
      if (!eligibility?.resolvedAddress) {
        return;
      }
      if (command.actionId === HOME_BANNER_ACTION_IDS.snoozeReferral) {
        await completePayloadMutation({
          command,
          mutate: () =>
            backgroundApiProxy.serviceHyperliquidReferral.snoozeReferralBanner({
              userAddress: eligibility.resolvedAddress,
            }),
        });
        return;
      }
      if (
        command.actionId !== HOME_BANNER_ACTION_IDS.bindReferral ||
        !eligibility.shouldShow ||
        !eligibility.resolvedAccountId
      ) {
        return;
      }
      await completePayloadMutation({
        command,
        mutate: async () => {
          const { typedData, action, nonce } =
            await backgroundApiProxy.serviceHyperliquidReferral.buildSetReferrerTypedData(
              { code: HYPERLIQUID_REFERRAL_CODE },
            );
          const typedDataMessage = stringUtils.stableStringify(typedData);
          const signatureHex = await backgroundApiProxy.serviceSend.signMessage(
            {
              unsignedMessage: {
                type: EMessageTypesEth.TYPED_DATA_V4,
                message: typedDataMessage,
                payload: [eligibility.resolvedAddress, typedDataMessage],
              },
              accountId: eligibility.resolvedAccountId,
              networkId: PERPS_NETWORK_ID,
            },
          );
          if (!signatureHex || typeof signatureHex !== 'string') {
            throw new OneKeyLocalError(
              'Home referral signature is unavailable',
            );
          }
          const result =
            await backgroundApiProxy.serviceHyperliquidReferral.submitSetReferrerWithSignature(
              { action, nonce, signatureHex },
            );
          if (result.status !== 'ok') {
            throw new OneKeyLocalError('Home referral binding failed');
          }
          await Promise.allSettled([
            backgroundApiProxy.serviceHyperliquidReferral.invalidateBannerCache(
              { userAddress: eligibility.resolvedAddress },
            ),
            backgroundApiProxy.serviceRookieGuide.recordTaskCompleted(
              ERookieTaskType.HYPERLIQUID_REFERRAL,
            ),
          ]);
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.perps__fee_discount_activated__msg,
            }),
          });
        },
      });
    },
    [completePayloadMutation, intl],
  );

  useEffect(() => {
    const command = interaction.pendingShellCommands.find(
      (candidate) =>
        candidate.actionId !== HOME_BANNER_ACTION_IDS.open &&
        (candidate.actionId === HOME_BANNER_ACTION_IDS.dismiss ||
          candidate.actionId === HOME_BANNER_ACTION_IDS.bindReferral ||
          candidate.actionId === HOME_BANNER_ACTION_IDS.snoozeReferral) &&
        !processingCommandIdsRef.current.has(candidate.intentId),
    );
    if (!command || !stableOwner) {
      return;
    }
    processingCommandIdsRef.current.add(command.intentId);
    void runCommand(command)
      .catch(() => {
        if (command.actionId === HOME_BANNER_ACTION_IDS.bindReferral) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.perps__claim_failed__msg,
            }),
          });
        }
      })
      .finally(() => {
        processingCommandIdsRef.current.delete(command.intentId);
        markHomeSectionCommandHandled({
          ownerToken: stableOwner.ownerToken,
          intentId: command.intentId,
        });
      });
  }, [
    interaction.pendingShellCommands,
    intl,
    markHomeSectionCommandHandled,
    runCommand,
    stableOwner,
  ]);

  return null;
}
