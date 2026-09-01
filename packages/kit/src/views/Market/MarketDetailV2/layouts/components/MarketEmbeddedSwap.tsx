import { useMemo } from 'react';
import type { ComponentProps } from 'react';

import { EPageType, Spinner, Stack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import type SwapMainLand from '@onekeyhq/kit/src/views/Swap/pages/components/SwapMainLand';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  ISwapInitParams,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { MarketTestIDs } from '../../../testIDs';
import { useSpeedSwapInit } from '../../components/SwapPanel/hooks/useSpeedSwapInit';

type IEmbeddedSwapProps = ComponentProps<typeof SwapMainLand>;

const LazyEmbeddedSwap = LazyLoad<IEmbeddedSwapProps>(
  () =>
    import(
      /* webpackChunkName: "market-embedded-swap" */ '@onekeyhq/kit/src/views/Swap/pages/components/SwapMainLand'
    ).then((module) => ({ default: module.default })),
  undefined,
  <Stack height={520} alignItems="center" justifyContent="center">
    <Spinner size="large" />
  </Stack>,
);

export function MarketEmbeddedSwap({ swapToken }: { swapToken: ISwapToken }) {
  const { defaultTokens } = useSpeedSwapInit(swapToken.networkId, true);
  const defaultFromToken = useMemo(
    () =>
      defaultTokens.find(
        (token) =>
          !equalTokenNoCaseSensitive({
            token1: token,
            token2: swapToken,
          }),
      ),
    [defaultTokens, swapToken],
  );
  const swapInitParams = useMemo<ISwapInitParams>(
    () => ({
      importFromToken: defaultFromToken,
      importNetworkId: defaultFromToken?.networkId ?? swapToken.networkId,
      importToToken: swapToken,
      swapSource: ESwapSource.MARKET,
      swapTabSwitchType: ESwapTabSwitchType.SWAP,
    }),
    [defaultFromToken, swapToken],
  );
  const swapTargetKey = [
    swapToken.networkId,
    swapToken.isNative ? 'native' : swapToken.contractAddress,
  ].join(':');

  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.swap }}
      enabledNum={[0, 1]}
    >
      <Stack
        testID={MarketTestIDs.detailEmbeddedSwap}
        width="100%"
        minHeight={520}
        overflow="hidden"
      >
        <LazyEmbeddedSwap
          key={swapTargetKey}
          pageType={EPageType.modal}
          singleSwapBridgeHeader
          swapInitParams={swapInitParams}
        />
      </Stack>
    </AccountSelectorProviderMirror>
  );
}
