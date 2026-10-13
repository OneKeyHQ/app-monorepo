import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';

import type { IPageNavigationProp } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useSwapFromTokenAmountAtom,
  useSwapManualSelectQuoteProvidersAtom,
  useSwapProviderSortAtom,
  useSwapQuoteActionLockAtom,
  useSwapQuoteCurrentEventListAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { buildSwapManualProviderSelectionIntent } from '@onekeyhq/kit/src/states/jotai/contexts/swap/quoteProgress';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

import { SwapProviderSelectContent } from '../../components/SwapProviderSelectContent';
import {
  useSwapQuoteEventFetching,
  useSwapQuoteLoading,
} from '../../hooks/useSwapState';
import { SwapProviderMirror } from '../SwapProviderMirror';

import type { RouteProp } from '@react-navigation/core';

const SwapProviderSelectModal = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const [swapQuoteList] = useSwapQuoteCurrentEventListAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const quoteLoading = useSwapQuoteLoading();
  const quoteEventFetching = useSwapQuoteEventFetching();
  const isQuoteFetching = quoteLoading || quoteEventFetching;
  const [quoteActionLock] = useSwapQuoteActionLockAtom();
  const activeFromTokenAmount =
    quoteActionLock.fromTokenAmount ?? fromTokenAmount.value;
  const activeFromToken = quoteActionLock.fromToken ?? fromToken;
  const activeToToken = quoteActionLock.toToken ?? toToken;
  const [manualSelectQuoteProvider, setSwapManualSelect] =
    useSwapManualSelectQuoteProvidersAtom();
  const [providerSort, setProviderSort] = useSwapProviderSortAtom();
  const [settingsPersist] = useSettingsPersistAtom();
  const [currentSelectQuote] = useSwapQuoteCurrentSelectAtom();
  const selectedProviderInfo =
    currentSelectQuote?.info ?? manualSelectQuoteProvider?.info;
  const selectedProviderKey = selectedProviderInfo
    ? `${selectedProviderInfo.provider}-${selectedProviderInfo.providerName}`
    : undefined;

  const onSelectQuote = useCallback(
    (item: IFetchQuoteResult) => {
      setSwapManualSelect(buildSwapManualProviderSelectionIntent(item));
      defaultLogger.swap.providerChange.providerChange({
        changeFrom: selectedProviderInfo?.provider ?? '-',
        changeTo: item.info.provider,
      });
      navigation.pop();
    },
    [navigation, selectedProviderInfo?.provider, setSwapManualSelect],
  );

  return (
    <SwapProviderSelectContent
      quoteListForDisplay={swapQuoteList}
      activeFromTokenAmount={activeFromTokenAmount}
      activeFromToken={activeFromToken}
      activeToToken={activeToToken}
      selectedProviderInfo={selectedProviderInfo}
      selectedProviderKey={selectedProviderKey}
      manualSelectProviderInfo={manualSelectQuoteProvider?.info}
      manualSelectProviderTrigger={manualSelectQuoteProvider}
      isQuoteFetching={isQuoteFetching}
      currencySymbol={settingsPersist.currencyInfo.symbol}
      providerSort={providerSort}
      onProviderSortChange={setProviderSort}
      onSelectQuote={onSelectQuote}
    />
  );
};

const SwapProviderSelectModalWithProvider = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapProviderSelect>
    >();
  const { storeName, providerSelect } = route.params;

  if (providerSelect) {
    return (
      <SwapProviderSelectContent
        quoteListForDisplay={providerSelect.quotes}
        activeFromTokenAmount={providerSelect.fromTokenAmount}
        activeFromToken={providerSelect.fromToken}
        activeToToken={providerSelect.toToken}
        selectedProviderInfo={providerSelect.selectedQuote?.info}
        selectedProviderKey={
          providerSelect.selectedQuote
            ? `${providerSelect.selectedQuote.info.provider}-${providerSelect.selectedQuote.info.providerName}`
            : undefined
        }
        currencySymbol={providerSelect.currencySymbol}
        onSelectQuote={(quote) => {
          providerSelect.onSelectQuote(quote);
          navigation.pop();
        }}
      />
    );
  }

  return (
    <SwapProviderMirror storeName={storeName}>
      <SwapProviderSelectModal />
    </SwapProviderMirror>
  );
};

export default SwapProviderSelectModalWithProvider;
