import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { ListView, Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useSwapFromTokenAmountAtom,
  useSwapManualSelectQuoteProvidersAtom,
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes/swap';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

import SwapProviderListItem from '../../components/SwapProviderListItem';
import { withSwapProvider } from '../WithSwapProvider';

const SwapProviderSelectModal = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();

  const [swapQuoteList] = useSwapQuoteListAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [, setSwapManualSelect] = useSwapManualSelectQuoteProvidersAtom();
  const [settingsPersist] = useSettingsPersistAtom();
  const onSelectQuote = useCallback(
    (item: IFetchQuoteResult) => {
      setSwapManualSelect(item);
      navigation.pop();
    },
    [navigation, setSwapManualSelect],
  );
  const renderItem = useCallback(
    ({ item }: { item: IFetchQuoteResult; index: number }) => {
      let disabled = !item.toAmount;
      const fromTokenAmountBN = new BigNumber(fromTokenAmount ?? 0);
      if (item.limit) {
        if (item.limit.min) {
          const minBN = new BigNumber(item.limit.min);
          if (fromTokenAmountBN.lt(minBN)) {
            disabled = false;
          }
        }
        if (item.limit.max) {
          const maxBN = new BigNumber(item.limit.max);
          if (fromTokenAmountBN.gt(maxBN)) {
            disabled = false;
          }
        }
      }
      return (
        <SwapProviderListItem
          onPress={
            !disabled
              ? () => {
                  onSelectQuote(item);
                }
              : undefined
          }
          fromTokenAmount={fromTokenAmount}
          fromTokenSymbol={fromToken?.symbol}
          providerResult={item}
          currencySymbol={settingsPersist.currencyInfo.symbol}
          toAmountSymbol={toToken?.symbol ?? ''}
          disabled={disabled}
        />
      );
    },
    [
      fromToken?.symbol,
      fromTokenAmount,
      onSelectQuote,
      settingsPersist.currencyInfo.symbol,
      toToken?.symbol,
    ],
  );

  return (
    <Page>
      <ListView
        estimatedItemSize="$10"
        renderItem={renderItem}
        data={swapQuoteList}
      />
    </Page>
  );
};

export default withSwapProvider(SwapProviderSelectModal);
