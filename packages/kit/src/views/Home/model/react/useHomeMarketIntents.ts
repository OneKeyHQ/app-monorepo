import { useCallback } from 'react';

import { rootNavigationRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useHomeFacts,
  useHomeSection,
  useHomeStoreIntentActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import { EPerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import {
  useNavigateToMarketTab,
  usePerpsNavigation,
} from '../../../Market/hooks';
import { EMarketHomeTab } from '../../../Market/MarketHomeV2/types';
import {
  HOME_PERPS_HOT_CATEGORY_ID,
  HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
} from '../../components/PopularTrading/constants';
import { getTokenKey } from '../../components/PopularTrading/utils';
import { createHomeAuthorityId } from '../core/homeIdentity';
import { HOME_MARKET_SELECTED_CATEGORY_CONTROL_ID } from '../sections/market/homeMarketControls';
import { getHomeMarketTokenRowId } from '../sections/market/homeMarketSourceAdapter';

import type {
  IFavoriteTokenDisplay,
  IHomePopularTradingPayload,
} from '../../components/PopularTrading/types';
import type {
  IHomeStoreEffect,
  IHomeStoreIntent,
} from '../store/homeStoreTypes';

const HOME_MARKET_ACTION_IDS = {
  addRecommended: 'home.market.addRecommended',
  openToken: 'home.market.openToken',
  removeFavorite: 'home.market.removeFavorite',
  toggleFavorite: 'home.market.toggleFavorite',
  viewMore: 'home.market.viewMore',
} as const;

function didAcceptHomeMarketCommand({
  effects,
  intentId,
}: {
  effects: readonly IHomeStoreEffect[];
  intentId: string;
}): boolean {
  return effects.some(
    (effect) =>
      effect.kind === 'executeCommand' && effect.intent.intentId === intentId,
  );
}

export function useHomeMarketIntents() {
  const facts = useHomeFacts();
  const marketSection = useHomeSection('market');
  const { dispatchHomeIntent } = useHomeStoreIntentActions().current;
  const navigation = useAppNavigation();
  const navigateToMarketTab = useNavigateToMarketTab();
  const { navigateToPerps } = usePerpsNavigation(
    EPerpPageEnterSource.PopularTrading,
  );
  const marketTab = platformEnv.isNative
    ? ETabRoutes.Discovery
    : ETabRoutes.Market;

  const dispatchSectionAction = useCallback(
    ({
      actionId,
      itemId,
    }: {
      actionId: (typeof HOME_MARKET_ACTION_IDS)[keyof typeof HOME_MARKET_ACTION_IDS];
      itemId?: string;
    }) => {
      if (!facts) {
        return false;
      }
      const intentId = createHomeAuthorityId('intent');
      const intent: IHomeStoreIntent = {
        type: 'sectionActionInvoked',
        intentId,
        owner: facts.owner,
        sessionId: facts.ownerToken.sessionId,
        sectionId: 'market',
        actionId,
        itemId,
        authority: {
          kind: 'sectionCommands',
          sectionId: 'market',
          revision: marketSection.sectionCommandRevision,
        },
      };
      const effects = dispatchHomeIntent(intent);
      return didAcceptHomeMarketCommand({ effects, intentId });
    },
    [dispatchHomeIntent, facts, marketSection.sectionCommandRevision],
  );

  const selectCategory = useCallback(
    (categoryId: string) => {
      if (!facts) {
        return false;
      }
      const effects = dispatchHomeIntent({
        type: 'sectionControlChanged',
        intentId: createHomeAuthorityId('intent'),
        owner: facts.owner,
        sessionId: facts.ownerToken.sessionId,
        sectionId: 'market',
        controlId: HOME_MARKET_SELECTED_CATEGORY_CONTROL_ID,
        value: categoryId,
        authority: {
          kind: 'sectionCommands',
          sectionId: 'market',
          revision: marketSection.sectionCommandRevision,
        },
      });
      return !effects.some((effect) => effect.kind === 'traceReject');
    },
    [dispatchHomeIntent, facts, marketSection.sectionCommandRevision],
  );

  const addRecommended = useCallback(
    async (tokens: IFavoriteTokenDisplay[]) => {
      if (
        tokens.length === 0 ||
        !dispatchSectionAction({
          actionId: HOME_MARKET_ACTION_IDS.addRecommended,
          itemId: tokens.map(getTokenKey).join('|'),
        })
      ) {
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
      tokens.forEach((token) => {
        defaultLogger.dex.watchlist.dexAddToWatchlist({
          network: token.chainId,
          tokenSymbol: token.symbol || '',
          tokenContract: token.contractAddress,
          addFrom: EWatchlistFrom.Recommend,
        });
      });
      appEventBus.emit(EAppEventBusNames.RefreshMarketWatchList, undefined);
      return true;
    },
    [dispatchSectionAction],
  );

  const removeFavorite = useCallback(
    async (record: IFavoriteTokenDisplay) => {
      if (
        !dispatchSectionAction({
          actionId: HOME_MARKET_ACTION_IDS.removeFavorite,
          itemId: getHomeMarketTokenRowId(record),
        })
      ) {
        return false;
      }
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
      if (record.perpsCoin) {
        void backgroundApiProxy.serviceMarketV2.syncToPerpsAtom({
          coin: record.perpsCoin,
          action: 'remove',
        });
      }
      appEventBus.emit(EAppEventBusNames.RefreshMarketWatchList, undefined);
      return true;
    },
    [dispatchSectionAction],
  );

  const toggleFavorite = useCallback(
    async ({
      checked,
      record,
      watchListItems,
    }: {
      checked: boolean;
      record: IFavoriteTokenDisplay;
      watchListItems: IHomePopularTradingPayload['watchListItems'];
    }) => {
      if (
        !dispatchSectionAction({
          actionId: HOME_MARKET_ACTION_IDS.toggleFavorite,
          itemId: getHomeMarketTokenRowId(record),
        })
      ) {
        return false;
      }
      const firstSortIndex = watchListItems[0]?.sortIndex ?? 1000;
      if (record.perpsCoin) {
        if (checked) {
          await backgroundApiProxy.serviceMarketV2.removeMarketWatchListV2({
            items: [
              {
                chainId: '',
                contractAddress: '',
                perpsCoin: record.perpsCoin,
              },
            ],
            callerName: 'PopularTrading',
          });
        } else {
          await backgroundApiProxy.serviceMarketV2.addMarketWatchListV2({
            watchList: [
              {
                chainId: '',
                contractAddress: '',
                perpsCoin: record.perpsCoin,
                sortIndex: firstSortIndex - 1,
              },
            ],
            callerName: 'PopularTrading',
          });
        }
        void backgroundApiProxy.serviceMarketV2.syncToPerpsAtom({
          coin: record.perpsCoin,
          action: checked ? 'remove' : 'add',
        });
      } else if (checked) {
        await backgroundApiProxy.serviceMarketV2.removeMarketWatchListV2({
          items: [
            {
              chainId: record.chainId,
              contractAddress: record.contractAddress,
            },
          ],
          callerName: 'PopularTrading',
        });
        defaultLogger.dex.watchlist.dexRemoveFromWatchlist({
          network: record.chainId,
          tokenSymbol: record.symbol || '',
          tokenContract: record.contractAddress,
          removeFrom: EWatchlistFrom.Homepage,
        });
      } else {
        await backgroundApiProxy.serviceMarketV2.addMarketWatchListV2({
          watchList: [
            {
              chainId: record.chainId,
              contractAddress: record.contractAddress,
              isNative: record.isNative,
              sortIndex: firstSortIndex - 1,
            },
          ],
          callerName: 'PopularTrading',
        });
        defaultLogger.dex.watchlist.dexAddToWatchlist({
          network: record.chainId,
          tokenSymbol: record.symbol || '',
          tokenContract: record.contractAddress,
          addFrom: EWatchlistFrom.Homepage,
        });
      }
      appEventBus.emit(EAppEventBusNames.RefreshMarketWatchList, undefined);
      return true;
    },
    [dispatchSectionAction],
  );

  const openToken = useCallback(
    (record: IFavoriteTokenDisplay) => {
      if (
        !dispatchSectionAction({
          actionId: HOME_MARKET_ACTION_IDS.openToken,
          itemId: getHomeMarketTokenRowId(record),
        })
      ) {
        return;
      }
      if (record.perpsCoin) {
        navigateToPerps(record.perpsCoin);
        return;
      }
      const shortCode = networkUtils.getNetworkShortCode({
        networkId: record.chainId,
      });
      if (
        platformEnv.isExtensionUiPopup ||
        platformEnv.isExtensionUiSidePanel
      ) {
        void backgroundApiProxy.serviceApp.openExtensionMarketTokenDetail({
          tokenAddress: record.contractAddress,
          network: shortCode || record.chainId,
          isNative: record.isNative,
        });
        return;
      }
      navigation.switchTab(marketTab);
      setTimeout(() => {
        rootNavigationRef.current?.navigate(ERootRoutes.Main, {
          screen: marketTab,
          params: {
            screen: ETabMarketRoutes.MarketDetailV2,
            params: {
              tokenAddress: record.contractAddress,
              network: shortCode || record.chainId,
              isNative: record.isNative,
            },
          },
        });
      }, 300);
    },
    [dispatchSectionAction, marketTab, navigateToPerps, navigation],
  );

  const viewMore = useCallback(
    (selectedMarketCategoryId?: string) => {
      if (
        !dispatchSectionAction({
          actionId: HOME_MARKET_ACTION_IDS.viewMore,
          itemId: selectedMarketCategoryId,
        })
      ) {
        return;
      }
      if (selectedMarketCategoryId === HOME_PERPS_HOT_CATEGORY_ID) {
        navigateToMarketTab({
          tabToSelect: EMarketHomeTab.Perps,
          perpsCategoryToSelect: HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
        });
        return;
      }
      if (selectedMarketCategoryId) {
        navigateToMarketTab({
          spotCategoryToSelect: selectedMarketCategoryId,
        });
        return;
      }
      navigateToMarketTab({ tabToSelect: EMarketHomeTab.Watchlist });
    },
    [dispatchSectionAction, navigateToMarketTab],
  );

  return {
    addRecommended,
    openToken,
    removeFavorite,
    selectCategory,
    toggleFavorite,
    viewMore,
  };
}

export { HOME_MARKET_ACTION_IDS, didAcceptHomeMarketCommand };
