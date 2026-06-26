import { useCallback, useMemo } from 'react';

import { useFocusEffect } from '@react-navigation/core';

import { Page } from '@onekeyhq/components';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type {
  ETabSwapRoutes,
  ITabSwapParamList,
} from '@onekeyhq/shared/src/routes';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { TabletHomeContainer } from '../../../components/TabletHomeContainer';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { useAppRoute } from '../../../hooks/useAppRoute';

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

  const swapInitParams = useMemo(() => {
    if (!tabParam) return undefined;
    const swapTabSwitchType = TAB_PARAM_MAP[tabParam.toLowerCase()];
    if (!swapTabSwitchType) return undefined;
    return { swapTabSwitchType };
  }, [tabParam]);

  // "Visit = read": when the user leaves the Swap tab screen, archive every
  // unread finished item in the history preview. A pushed modal (detail /
  // "view more") does NOT blur this screen on desktop, so opening one does
  // not mark items read; switching the in-page Swap/Stock/Limit tab also does
  // not blur this screen.
  useFocusEffect(
    useCallback(
      () => () => {
        void backgroundApiProxy.serviceSwap.markAllSwapHistoryPreviewRead();
      },
      [],
    ),
  );

  return (
    <Page fullPage>
      <TabletHomeContainer>
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.swap}
          tabRoute={ETabRoutes.Swap}
        />
        <Page.Body>
          <SwapMainLandWithPageType swapInitParams={swapInitParams} />
        </Page.Body>
      </TabletHomeContainer>
    </Page>
  );
};
export default SwapPageContainer;
