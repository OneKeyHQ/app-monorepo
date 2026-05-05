import { useMemo } from 'react';

import { Page } from '@onekeyhq/components';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type {
  ETabSwapRoutes,
  ITabSwapParamList,
} from '@onekeyhq/shared/src/routes';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { TabletHomeContainer } from '../../../components/TabletHomeContainer';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { useAppRoute } from '../../../hooks/useAppRoute';

import SwapMainLandWithPageType from './components/SwapMainLand';

const TAB_PARAM_MAP: Record<string, ESwapTabSwitchType> = {
  swap: ESwapTabSwitchType.SWAP,
  bridge: ESwapTabSwitchType.BRIDGE,
  crosschain: ESwapTabSwitchType.BRIDGE,
  limit: ESwapTabSwitchType.LIMIT,
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
