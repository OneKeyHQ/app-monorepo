import { useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Toast, rootNavigationRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import { useUnifiedNetworkSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useUnifiedNetworkSelectorTrigger';
import { useAccountSelectorCopyAddress } from '@onekeyhq/kit/src/components/AccountSelector/useAccountSelectorCopyAddress';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useWalletBanner } from '@onekeyhq/kit/src/hooks/useWalletBanner';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  settingsValuePersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  HYPERLIQUID_REFERRAL_CODE,
  PERPS_NETWORK_ID,
} from '@onekeyhq/shared/src/consts/perp';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalAssetDetailRoutes,
  EModalRoutes,
  ERootRoutes,
  ETabEarnRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IHomeRuntimeJsonValue } from '@onekeyhq/shared/src/types/homeRuntime';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import { ERookieTaskType } from '@onekeyhq/shared/types/rookieGuide';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { safePushToEarnRoute } from '../../../Earn/earnUtils';
import { useNavigateToMarketTab } from '../../../Market/hooks';
import { EMarketHomeTab } from '../../../Market/MarketHomeV2/types';
import { maybeOpenPrivateSendHistoryDetail } from '../../../Swap/utils/privateSendHistory';
import {
  HOME_PERPS_HOT_CATEGORY_ID,
  HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
} from '../../components/PopularTrading/constants';
import {
  HOME_BANNER_ACTION_IDS,
  fromHomeBannerStoreItem,
  readHomeBannerStorePayload,
} from '../sections/banner/homeBannerStoreModel';
import { HOME_MARKET_ACTION_IDS } from '../sections/market/homeMarketCommands';
import { getHomeMarketTokenRowId } from '../sections/market/homeMarketSourceAdapter';
import { getHomeNFTItemRowId } from '../sections/nft/homeNFTSourceAdapter';
import {
  HOME_SECTION_ACTION_IDS,
  HOME_SHELL_ACTION_IDS,
} from '../store/homeStoreCommandIds';
import { readHomeStoreSectionPayload } from '../store/homeStoreJson';

import {
  executeHomePerpsOpenAsset,
  prepareHomePerpsAccount,
  resolveHomePerpsOpenAssetCommand,
} from './homePerpsActionExecutor';

import type {
  IFavoriteTokenDisplay,
  IHomePopularTradingPayload,
} from '../../components/PopularTrading/types';
import type { HomeStoreRuntime } from '../runtime/homeRuntimeLease';
import type { IHomeDeFiLegacyPayload } from '../sections/defi/homeDeFiSourceAdapter';
import type { IHomeHistoryStorePayload } from '../sections/history/homeHistorySourceAdapter';
import type { IHomeNFTLegacyPayload } from '../sections/nft/homeNFTSourceAdapter';
import type { IHomePerpsLegacyPayload } from '../sections/perps/homePerpsSourceAdapter';
import type { IHomeSpotLegacyPayload } from '../sections/spot/homeSpotSourceAdapter';
import type { IHomeStoreIntent } from '../store/homeStoreTypes';

function ownersMatch(
  current: IHomeStoreIntent['owner'] | undefined,
  expected: IHomeStoreIntent['owner'],
): boolean {
  if (
    !current ||
    current.walletId !== expected.walletId ||
    current.accountId !== expected.accountId ||
    current.network.kind !== expected.network.kind
  ) {
    return false;
  }
  return (
    current.network.kind === 'allNetworks' ||
    (expected.network.kind === 'singleNetwork' &&
      current.network.networkId === expected.network.networkId)
  );
}

function isCommandObject(
  value: unknown,
): value is { readonly [key: string]: IHomeRuntimeJsonValue } {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readPerpsOpenCommand(intent: IHomeStoreIntent) {
  if (
    intent.type !== 'sectionActionInvoked' ||
    !isCommandObject(intent.commandPayload)
  ) {
    return undefined;
  }
  const payload = intent.commandPayload;
  const mode = payload.mode;
  const infoPanelTab = payload.infoPanelTab;
  return {
    coin: typeof payload.coin === 'string' ? payload.coin : undefined,
    infoPanelTab:
      infoPanelTab === 'Positions' || infoPanelTab === 'Balances'
        ? infoPanelTab
        : undefined,
    mode: mode === 'spot' ? 'spot' : 'perp',
    openMarket: payload.openMarket !== false,
  } as const;
}

function readCommandObject(intent: IHomeStoreIntent) {
  return intent.type === 'sectionActionInvoked' &&
    isCommandObject(intent.commandPayload)
    ? intent.commandPayload
    : undefined;
}

function isMarketToken(value: unknown): value is IFavoriteTokenDisplay {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return false;
  }
  const token = value as Partial<IFavoriteTokenDisplay>;
  return (
    typeof token.chainId === 'string' &&
    typeof token.contractAddress === 'string'
  );
}

export function useHomeCommandExecutor(runtime: HomeStoreRuntime) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const navigateToMarketTab = useNavigateToMarketTab();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount, network, vaultSettings, wallet } =
    activeAccount;
  const { showAccountSelector } = useAccountSelectorTrigger({
    num: 0,
    showConnectWalletModalInDappMode: true,
    linkNetwork: !network?.isAllNetworks,
    linkNetworkId: !network?.isAllNetworks ? network?.id : undefined,
    hideAddress: vaultSettings?.mergeDeriveAssetsEnabled,
    keepAllOtherAccounts: true,
    allowSelectEmptyAccount: true,
  });
  const { showUnifiedNetworkSelector } = useUnifiedNetworkSelectorTrigger({
    num: 0,
  });
  const { copyAddress } = useAccountSelectorCopyAddress({ activeAccount });
  const [settings] = useSettingsPersistAtom();
  const { handleBannerOnPress } = useWalletBanner({ account, network, wallet });
  const deferredTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(
    () => () => {
      deferredTimersRef.current.forEach(clearTimeout);
      deferredTimersRef.current.clear();
    },
    [account?.id, network?.id, wallet?.id],
  );

  return useCallback(
    async (intent: IHomeStoreIntent): Promise<unknown> => {
      const readSnapshot = () => runtime.getState();
      const isCurrent = () => {
        const session = readSnapshot().session;
        return (
          session.ownerToken?.sessionId === intent.sessionId &&
          ownersMatch(session.owner, intent.owner)
        );
      };
      if (!isCurrent()) {
        return;
      }
      const scheduleDeferred = (callback: () => void, delayMs: number) => {
        const timer = setTimeout(() => {
          deferredTimersRef.current.delete(timer);
          if (isCurrent()) {
            callback();
          }
        }, delayMs);
        deferredTimersRef.current.add(timer);
      };
      const state = readSnapshot();
      const payload = <T>(sourceId: keyof typeof state.resources) => {
        const resource = state.resources[sourceId];
        return resource.kind === 'ready' || resource.kind === 'partial'
          ? readHomeStoreSectionPayload<T>(resource.data)
          : undefined;
      };

      if (
        intent.type === 'headerActionInvoked' &&
        intent.actionId === HOME_SHELL_ACTION_IDS.accountSelector
      ) {
        showAccountSelector();
        return;
      }
      if (
        intent.type === 'headerActionInvoked' &&
        intent.actionId === HOME_SHELL_ACTION_IDS.copyAddress
      ) {
        await copyAddress();
        return;
      }
      if (
        intent.type === 'headerActionInvoked' &&
        intent.actionId === HOME_SHELL_ACTION_IDS.networkSelector
      ) {
        showUnifiedNetworkSelector({
          recordNetworkHistoryEnabled: true,
          defaultTab: network?.isAllNetworks ? 'portfolio' : undefined,
        });
        return;
      }
      if (
        intent.type === 'headerActionInvoked' &&
        intent.actionId === HOME_SHELL_ACTION_IDS.balance
      ) {
        const value = await settingsValuePersistAtom.get();
        await settingsValuePersistAtom.set({ hideValue: !value.hideValue });
        return;
      }
      if (
        intent.type === 'headerActionInvoked' &&
        intent.actionId === HOME_BANNER_ACTION_IDS.open
      ) {
        const resource = state.resources.banner;
        const bannerPayload =
          resource.kind === 'ready' || resource.kind === 'partial'
            ? readHomeBannerStorePayload(resource.data)
            : undefined;
        const item = bannerPayload?.banners.find(
          (candidate) => candidate.id === intent.itemId,
        );
        if (item) {
          const href = (item.href ?? '').toLowerCase();
          const looksLikeDepositTarget =
            href.includes('receive') ||
            href.includes('deposit') ||
            href.includes('/buy') ||
            href.includes('fund');
          if (
            bannerPayload?.isBotWalletReceiveBlocked &&
            looksLikeDepositTarget
          ) {
            Toast.error({ title: '该钱包已停用，无法接收资产' });
            return;
          }
          await handleBannerOnPress(fromHomeBannerStoreItem(item));
        }
        return;
      }
      if (
        intent.type === 'headerActionInvoked' &&
        (intent.actionId === HOME_BANNER_ACTION_IDS.dismiss ||
          intent.actionId === HOME_BANNER_ACTION_IDS.snoozeReferral ||
          intent.actionId === HOME_BANNER_ACTION_IDS.bindReferral)
      ) {
        const resource = state.resources.banner;
        const bannerPayload =
          resource.kind === 'ready' || resource.kind === 'partial'
            ? readHomeBannerStorePayload(resource.data)
            : undefined;
        const item = bannerPayload?.banners.find(
          (candidate) => candidate.id === intent.itemId,
        );
        if (!item) {
          return false;
        }
        if (intent.actionId === HOME_BANNER_ACTION_IDS.dismiss) {
          defaultLogger.wallet.walletBanner.walletBannerClicked({
            bannerId: item.id,
            type: 'close',
          });
          if (item.closeForever) {
            await backgroundApiProxy.serviceWalletBanner.updateClosedForeverBanners(
              { bannerId: item.id, closedForever: true },
            );
          }
          if (isCurrent()) {
            runtime.sources.refreshSource('banner');
          }
          return isCurrent();
        }
        const eligibility = bannerPayload?.referralEligibility;
        if (!eligibility?.resolvedAddress) {
          return false;
        }
        if (intent.actionId === HOME_BANNER_ACTION_IDS.snoozeReferral) {
          await backgroundApiProxy.serviceHyperliquidReferral.snoozeReferralBanner(
            { userAddress: eligibility.resolvedAddress },
          );
          if (isCurrent()) {
            runtime.sources.refreshSource('banner');
          }
          return isCurrent();
        }
        if (!eligibility.shouldShow || !eligibility.resolvedAccountId) {
          return false;
        }
        try {
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
          if (isCurrent()) {
            Toast.success({
              title: intl.formatMessage({
                id: ETranslations.perps__fee_discount_activated__msg,
              }),
            });
            runtime.sources.refreshSource('banner');
          }
          return isCurrent();
        } catch (error) {
          if (isCurrent()) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.perps__claim_failed__msg,
              }),
            });
          }
          throw error;
        }
      }
      if (
        intent.type !== 'sectionActionInvoked' &&
        intent.type !== 'tabHandoffInvoked'
      ) {
        return;
      }
      const actionId = intent.actionId;
      const itemId = 'itemId' in intent ? intent.itemId : undefined;
      if (
        actionId === HOME_SECTION_ACTION_IDS.openAsset &&
        account &&
        network &&
        wallet
      ) {
        const portfolio = payload<IHomeSpotLegacyPayload>('portfolio');
        const token = portfolio?.tokens.find(
          (candidate) => candidate.$key === itemId,
        );
        if (token) {
          navigation.pushModal(EModalRoutes.MainModal, {
            screen: EModalAssetDetailRoutes.TokenDetails,
            params: {
              accountId: token.accountId ?? account.id,
              networkId: token.networkId ?? network.id,
              accountAddress: account.address ?? '',
              walletId: wallet.id,
              isAllNetworks: network.isAllNetworks,
              indexedAccountId: indexedAccount?.id ?? '',
              tokenInfo: token,
              aggregateTokens:
                portfolio?.aggregateTokenListMap[token.$key]?.tokens ?? [],
              tokenMap: portfolio?.tapTokenMap ?? {},
            },
          });
        }
        return;
      }
      if (
        actionId === HOME_SECTION_ACTION_IDS.openNFT &&
        account &&
        network &&
        wallet
      ) {
        const nft = payload<IHomeNFTLegacyPayload>('nft')?.data.find(
          (candidate) => getHomeNFTItemRowId(candidate) === itemId,
        );
        if (nft) {
          navigation.pushModal(EModalRoutes.MainModal, {
            screen: EModalAssetDetailRoutes.NFTDetails,
            params: {
              networkId: nft.networkId ?? network.id,
              accountId: nft.accountId ?? account.id,
              walletId: wallet.id,
              collectionAddress: nft.collectionAddress,
              itemId: nft.itemId,
            },
          });
        }
        return;
      }
      if (actionId === HOME_SECTION_ACTION_IDS.openDeFiProtocol && account) {
        const defi = payload<IHomeDeFiLegacyPayload>('defi');
        const protocol = defi?.protocols.find(
          (candidate) =>
            defiUtils.buildProtocolMapKey({
              networkId: candidate.networkId,
              protocol: candidate.protocol,
            }) === itemId,
        );
        if (protocol) {
          const protocolKey = defiUtils.buildProtocolMapKey({
            networkId: protocol.networkId,
            protocol: protocol.protocol,
          });
          navigation.pushModal(EModalRoutes.MainModal, {
            screen: EModalAssetDetailRoutes.DeFiProtocolDetails,
            params: {
              protocol,
              protocolInfo: defi?.protocolMap[protocolKey],
              accountId: protocol.accountId ?? account.id,
              indexedAccountId: protocol.indexedAccountId ?? indexedAccount?.id,
              supportedActions: defi?.supportedActions ?? [],
            },
          });
        }
        return;
      }
      if (actionId === 'home.perps.prepareDeposit') {
        return prepareHomePerpsAccount({
          accountIdentity: {
            accountId: account?.id,
            indexedAccountId: indexedAccount?.id,
            walletId: wallet?.id,
          },
          isCurrent,
        });
      }
      if (
        actionId === HOME_SECTION_ACTION_IDS.openPerps ||
        intent.type === 'tabHandoffInvoked'
      ) {
        const command =
          readPerpsOpenCommand(intent) ??
          resolveHomePerpsOpenAssetCommand({
            itemId: 'itemId' in intent ? intent.itemId : undefined,
            payload: payload<IHomePerpsLegacyPayload>('perps'),
          });
        if (command) {
          return executeHomePerpsOpenAsset({
            accountIdentity: {
              accountId: account?.id,
              indexedAccountId: indexedAccount?.id,
              walletId: wallet?.id,
            },
            ...command,
            isCurrent,
            scheduleDeferred,
            switchToPerps: () => navigation.switchTab(ETabRoutes.Perp),
          });
        }
        return;
      }
      if (
        actionId === HOME_SECTION_ACTION_IDS.openHistory &&
        account &&
        network
      ) {
        const history = payload<IHomeHistoryStorePayload>('history')?.data.find(
          (candidate) => candidate.id === itemId,
        );
        if (!history) {
          return;
        }
        if (
          history.decodedTx.status === EDecodedTxStatus.Pending &&
          history.isLocalCreated
        ) {
          const localTx =
            await backgroundApiProxy.serviceHistory.getLocalHistoryTxById({
              accountId: history.decodedTx.accountId,
              historyId: history.id,
              networkId: history.decodedTx.networkId,
            });
          if (!isCurrent() || !localTx || localTx.replacedNextId) {
            return;
          }
        }
        const openedPrivateSend = await maybeOpenPrivateSendHistoryDetail({
          accountAddress: account.address,
          accountId: history.decodedTx.accountId,
          currencySymbol: settings.currencyInfo.symbol,
          historyTx: history,
          navigation,
          network,
        });
        if (isCurrent() && !openedPrivateSend) {
          navigation.pushModal(EModalRoutes.MainModal, {
            screen: EModalAssetDetailRoutes.HistoryDetails,
            params: {
              accountId: history.decodedTx.accountId,
              historyTx: history,
              isAllNetworks: network.isAllNetworks,
              networkId: history.decodedTx.networkId,
            },
          });
        }
        return;
      }
      if (actionId === HOME_SECTION_ACTION_IDS.openEarn) {
        await safePushToEarnRoute(navigation, ETabEarnRoutes.EarnHome);
        return;
      }
      if (actionId === HOME_MARKET_ACTION_IDS.addRecommended) {
        const command = readCommandObject(intent);
        const tokens = Array.isArray(command?.tokens)
          ? command.tokens.filter(isMarketToken)
          : [];
        if (tokens.length === 0) {
          return false;
        }
        await backgroundApiProxy.serviceMarketV2.addMarketWatchListV2({
          watchList: tokens.map((token, index) => ({
            chainId: token.chainId,
            contractAddress: token.contractAddress,
            isNative: token.isNative,
            sortIndex: 1000 - (index + 1),
          })),
          callerName: 'PopularTrading',
        });
        if (!isCurrent()) {
          return false;
        }
        tokens.forEach((token) => {
          defaultLogger.dex.watchlist.dexAddToWatchlist({
            network: token.chainId,
            tokenSymbol: token.symbol || '',
            tokenContract: token.contractAddress,
            addFrom: EWatchlistFrom.Recommend,
          });
        });
        runtime.sources.refreshSource('market');
        return true;
      }
      if (
        actionId === HOME_MARKET_ACTION_IDS.removeFavorite ||
        actionId === HOME_MARKET_ACTION_IDS.toggleFavorite
      ) {
        const command = readCommandObject(intent);
        const record = isMarketToken(command?.record)
          ? command.record
          : undefined;
        if (!record) {
          return false;
        }
        const checked = command?.checked === true;
        const firstSortIndex =
          typeof command?.firstSortIndex === 'number'
            ? command.firstSortIndex
            : 1000;
        const remove =
          actionId === HOME_MARKET_ACTION_IDS.removeFavorite || checked;
        if (remove) {
          await backgroundApiProxy.serviceMarketV2.removeMarketWatchListV2({
            items: [
              record.perpsCoin
                ? {
                    chainId: '',
                    contractAddress: '',
                    perpsCoin: record.perpsCoin,
                  }
                : {
                    chainId: record.chainId,
                    contractAddress: record.contractAddress,
                  },
            ],
            callerName: 'PopularTrading',
          });
        } else {
          await backgroundApiProxy.serviceMarketV2.addMarketWatchListV2({
            watchList: [
              record.perpsCoin
                ? {
                    chainId: '',
                    contractAddress: '',
                    perpsCoin: record.perpsCoin,
                    sortIndex: firstSortIndex - 1,
                  }
                : {
                    chainId: record.chainId,
                    contractAddress: record.contractAddress,
                    isNative: record.isNative,
                    sortIndex: firstSortIndex - 1,
                  },
            ],
            callerName: 'PopularTrading',
          });
        }
        if (!isCurrent()) {
          return false;
        }
        if (record.perpsCoin) {
          void backgroundApiProxy.serviceMarketV2.syncToPerpsAtom({
            coin: record.perpsCoin,
            action: remove ? 'remove' : 'add',
          });
        } else if (remove) {
          defaultLogger.dex.watchlist.dexRemoveFromWatchlist({
            network: record.chainId,
            tokenSymbol: record.symbol || '',
            tokenContract: record.contractAddress,
            removeFrom: EWatchlistFrom.Homepage,
          });
        } else {
          defaultLogger.dex.watchlist.dexAddToWatchlist({
            network: record.chainId,
            tokenSymbol: record.symbol || '',
            tokenContract: record.contractAddress,
            addFrom: EWatchlistFrom.Homepage,
          });
        }
        runtime.sources.refreshSource('market');
        return true;
      }
      if (actionId === HOME_MARKET_ACTION_IDS.viewMore) {
        if (itemId === HOME_PERPS_HOT_CATEGORY_ID) {
          navigateToMarketTab({
            tabToSelect: EMarketHomeTab.Perps,
            perpsCategoryToSelect: HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
          });
        } else if (itemId) {
          navigateToMarketTab({ spotCategoryToSelect: itemId });
        } else {
          navigateToMarketTab({ tabToSelect: EMarketHomeTab.Watchlist });
        }
        return;
      }
      if (actionId === HOME_SECTION_ACTION_IDS.openMarket) {
        const market = payload<IHomePopularTradingPayload>('market');
        const token = [
          ...(market?.rows ?? []),
          ...(market?.perpsHotRows ?? []),
        ].find((candidate) => getHomeMarketTokenRowId(candidate) === itemId);
        if (!token) {
          return;
        }
        if (token.perpsCoin) {
          await executeHomePerpsOpenAsset({
            accountIdentity: {
              accountId: account?.id,
              indexedAccountId: indexedAccount?.id,
              walletId: wallet?.id,
            },
            coin: token.perpsCoin,
            isCurrent,
            mode: 'perp',
            openMarket: false,
            scheduleDeferred,
            switchToPerps: () => navigation.switchTab(ETabRoutes.Perp),
          });
          return;
        }
        const shortCode = networkUtils.getNetworkShortCode({
          networkId: token.chainId,
        });
        const marketTab = platformEnv.isNative
          ? ETabRoutes.Discovery
          : ETabRoutes.Market;
        if (
          platformEnv.isExtensionUiPopup ||
          platformEnv.isExtensionUiSidePanel
        ) {
          await backgroundApiProxy.serviceApp.openExtensionMarketTokenDetail({
            tokenAddress: token.contractAddress,
            network: shortCode || token.chainId,
            isNative: token.isNative,
          });
          return;
        }
        navigation.switchTab(marketTab);
        scheduleDeferred(() => {
          rootNavigationRef.current?.navigate(ERootRoutes.Main, {
            screen: marketTab,
            params: {
              screen: ETabMarketRoutes.MarketDetailV2,
              params: {
                tokenAddress: token.contractAddress,
                network: shortCode || token.chainId,
                isNative: token.isNative,
              },
            },
          });
        }, 300);
      }
    },
    [
      account,
      copyAddress,
      handleBannerOnPress,
      indexedAccount?.id,
      intl,
      navigateToMarketTab,
      navigation,
      network,
      runtime,
      settings.currencyInfo.symbol,
      showAccountSelector,
      showUnifiedNetworkSelector,
      wallet,
    ],
  );
}
