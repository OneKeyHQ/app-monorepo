import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Button,
  Page,
  SectionList,
  Select,
  SizableText,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useSwapFromTokenAmountAtom,
  useSwapManualSelectQuoteProvidersAtom,
  useSwapProviderSortAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSortedQuoteListAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes/swap';
import { ESwapProviderSort } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

import SwapProviderListItem from '../../components/SwapProviderListItem';
import { withSwapProvider } from '../WithSwapProvider';

const SwapProviderSelectModal = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();

  const [swapSortedList] = useSwapSortedQuoteListAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [, setSwapManualSelect] = useSwapManualSelectQuoteProvidersAtom();
  const [providerSort, setProviderSort] = useSwapProviderSortAtom();
  const [settingsPersist] = useSettingsPersistAtom();
  const [currentSelectQuote] = useSwapQuoteCurrentSelectAtom();

  const onSelectSortChange = useCallback(
    (value: ESwapProviderSort) => {
      setProviderSort(value);
      void backgroundApiProxy.simpleDb.swapConfigs.setRawData({
        providerSort: value,
      });
    },
    [setProviderSort],
  );

  // todo i18n
  const swapProviderSortSelectItems = useMemo(
    () => [
      { label: 'Recommend', value: ESwapProviderSort.RECOMMENDED },
      { label: 'Gas fee', value: ESwapProviderSort.GAS_FEE },
      { label: 'Swap Duration', value: ESwapProviderSort.SWAP_DURATION },
      { label: 'Received', value: ESwapProviderSort.RECEIVED },
    ],
    [],
  );
  const sectionData = useMemo(() => {
    const availableList = swapSortedList.filter((item) => item.toAmount);
    const unavailableList = swapSortedList.filter((item) => !item.toAmount);
    return [
      ...(availableList?.length > 0
        ? [
            {
              title: 'Available',
              data: availableList,
            },
          ]
        : []),
      ...(unavailableList?.length > 0
        ? [
            {
              title: 'Unavailable',
              data: unavailableList,
            },
          ]
        : []),
    ];
  }, [swapSortedList]);
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
          selected={item.info.provider === currentSelectQuote?.info.provider}
          fromTokenAmount={fromTokenAmount}
          fromToken={fromToken}
          toToken={toToken}
          providerResult={item}
          currencySymbol={settingsPersist.currencyInfo.symbol}
          disabled={disabled}
        />
      );
    },
    [
      currentSelectQuote?.info.provider,
      fromToken,
      fromTokenAmount,
      onSelectQuote,
      settingsPersist.currencyInfo.symbol,
      toToken,
    ],
  );

  return (
    <Page>
      <SectionList
        px="$5"
        pt="$2"
        pb="$4"
        estimatedItemSize="$10"
        renderItem={renderItem}
        sections={sectionData}
        renderSectionHeader={({ section: { title } }) => {
          if (title === 'Available') {
            return (
              <Select
                title="Sort"
                items={swapProviderSortSelectItems}
                onChange={onSelectSortChange}
                value={providerSort}
                renderTrigger={({ value, label, placeholder }) => (
                  <Button
                    alignSelf="flex-start"
                    variant="tertiary"
                    icon="FilterSortSolid"
                    iconAfter="ChevronDownSmallOutline"
                  >
                    <SizableText size="$bodyMd">
                      {value ? label : placeholder}
                    </SizableText>
                  </Button>
                )}
              />
            );
          }
          return <SectionList.SectionHeader title={title} />;
        }}
      />
    </Page>
  );
};

export default withSwapProvider(SwapProviderSelectModal);
