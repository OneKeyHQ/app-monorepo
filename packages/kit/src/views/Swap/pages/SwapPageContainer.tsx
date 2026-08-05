import { useCallback, useMemo } from 'react';

import { useFocusEffect } from '@react-navigation/core';

import { Page, useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type {
  ETabSwapRoutes,
  ITabSwapParamList,
} from '@onekeyhq/shared/src/routes';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { TabletHomeContainer } from '../../../components/TabletHomeContainer';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { useAppRoute } from '../../../hooks/useAppRoute';
import { getRootRoutersLength } from '../../../hooks/useRouteIsFocused';
import {
  SwapInviteeRewardHeaderAction,
  useSwapInviteeRewardActionPlacement,
} from '../components/InviteeReward/SwapInviteeRewardHeaderAction';

import SwapMainLandWithPageType from './components/SwapMainLand';

const TAB_PARAM_MAP: Record<string, ESwapTabSwitchType> = {
  swap: ESwapTabSwitchType.SWAP,
  bridge: ESwapTabSwitchType.BRIDGE,
  crosschain: ESwapTabSwitchType.BRIDGE,
  limit: ESwapTabSwitchType.LIMIT,
  stock: ESwapTabSwitchType.STOCK,
};

const SwapPageContainer = () => {
  useDebugComponentRemountLog({ name: 'SwapPageContainer' });

  const route = useAppRoute<ITabSwapParamList, ETabSwapRoutes.TabSwap>();
  const tabParam = route.params?.tab;
  const { md } = useMedia();

  const swapInitParams = useMemo(() => {
    if (!tabParam) return undefined;
    const swapTabSwitchType = TAB_PARAM_MAP[tabParam.toLowerCase()];
    if (!swapTabSwitchType) return undefined;
    return { swapTabSwitchType };
  }, [tabParam]);

  const swapInviteeRewardActionPlacement = useSwapInviteeRewardActionPlacement({
    isDesktop: Boolean(platformEnv.isDesktop),
    isMediumLayout: md,
    isNative: Boolean(platformEnv.isNative),
    routeSwapType: swapInitParams?.swapTabSwitchType,
  });

  // "Visit = read": archive every unread finished item in the history preview
  // when the user LEAVES the Swap surface (e.g. switches bottom tabs) — but NOT
  // when a modal (detail / "view more") is pushed on top, and not when switching
  // the in-page Swap/Stock/Limit tab. A pushed modal grows the root navigation
  // stack while a tab switch does not, so we skip the archive whenever the stack
  // is deeper at blur time than it was at focus time (i.e. a modal caused it).
  useFocusEffect(
    useCallback(() => {
      const rootRoutersLengthOnFocus = getRootRoutersLength();
      return () => {
        if (getRootRoutersLength() > rootRoutersLengthOnFocus) {
          return;
        }
        void backgroundApiProxy.serviceSwap.markAllSwapHistoryPreviewRead();
      };
    }, []),
  );

  return (
    <Page fullPage>
      <TabletHomeContainer>
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.swap}
          tabRoute={ETabRoutes.Swap}
          customHeaderRightItems={
            swapInviteeRewardActionPlacement === 'desktopHeader' ? (
              // headerRight mounts in the navigator's header tree, outside this
              // page's providers, so it must bring its own account-selector
              // mirror (same as Perp's customHeaderRightItems).
              <AccountSelectorProviderMirror
                config={{
                  sceneName: EAccountSelectorSceneName.swap,
                  sceneUrl: '',
                }}
                enabledNum={[0]}
              >
                <SwapInviteeRewardHeaderAction />
              </AccountSelectorProviderMirror>
            ) : undefined
          }
        />
        <Page.Body>
          <SwapMainLandWithPageType swapInitParams={swapInitParams} />
        </Page.Body>
      </TabletHomeContainer>
    </Page>
  );
};
export default SwapPageContainer;
