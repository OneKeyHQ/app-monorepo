import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Button,
  Icon,
  IconButton,
  LottieView,
  Page,
  Popover,
  SectionList,
  Select,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { sortSwapQuotes } from '@onekeyhq/shared/src/utils/swapQuoteSortUtils';
import { ESwapProviderSort } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IFetchQuoteInfo,
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { SwapTestIDs } from '../testIDs';

import SwapProviderListItem from './SwapProviderListItem';

enum ESwapProviderStatus {
  AVAILABLE = 'Available',
  UNAVAILABLE = 'Unavailable',
}

const InformationItem = ({
  icon,
  content,
}: {
  icon: IKeyOfIcons;
  content: string;
}) => (
  <XStack alignItems="flex-start" gap="$2">
    <Icon flexShrink={0} color="$iconSubdued" size="$5" name={icon} />
    <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
      {content}
    </SizableText>
  </XStack>
);

export interface ISwapProviderSelectContentProps {
  quoteListForDisplay: IFetchQuoteResult[];
  activeFromTokenAmount?: string;
  activeFromToken?: ISwapToken;
  activeToToken?: ISwapToken;
  selectedProviderInfo?: IFetchQuoteInfo;
  selectedProviderKey?: string;
  manualSelectProviderInfo?: IFetchQuoteInfo;
  manualSelectProviderTrigger?: unknown;
  isQuoteFetching?: boolean;
  currencySymbol: string;
  providerSort?: ESwapProviderSort;
  onProviderSortChange?: (value: ESwapProviderSort) => void;
  onSelectQuote: (item: IFetchQuoteResult) => void;
}

export const SwapProviderSelectContent = ({
  quoteListForDisplay,
  activeFromTokenAmount,
  activeFromToken,
  activeToToken,
  selectedProviderInfo,
  selectedProviderKey,
  manualSelectProviderInfo,
  manualSelectProviderTrigger,
  isQuoteFetching,
  currencySymbol,
  providerSort,
  onProviderSortChange,
  onSelectQuote,
}: ISwapProviderSelectContentProps) => {
  const intl = useIntl();
  const [localProviderSort, setLocalProviderSort] = useState(
    ESwapProviderSort.RECOMMENDED,
  );
  const activeProviderSort = providerSort ?? localProviderSort;
  const handleProviderSortChange = onProviderSortChange ?? setLocalProviderSort;
  const sortedQuoteList = useMemo(
    () =>
      sortSwapQuotes(quoteListForDisplay, {
        sort: activeProviderSort,
        fromTokenAmount: activeFromTokenAmount,
      }),
    [activeFromTokenAmount, activeProviderSort, quoteListForDisplay],
  );

  const swapProviderSortSelectItems = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.provider_recommend }),
        value: ESwapProviderSort.RECOMMENDED,
      },
      {
        label: intl.formatMessage({ id: ETranslations.provider_sort_item_gas }),
        value: ESwapProviderSort.GAS_FEE,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.provider_sort_item_swap_duration,
        }),
        value: ESwapProviderSort.SWAP_DURATION,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.provider_sort_item_received,
        }),
        value: ESwapProviderSort.RECEIVED,
      },
    ],
    [intl],
  );

  const sectionData = useMemo(() => {
    const availableList = sortedQuoteList.filter(
      (item) => item.toAmount && !item.limit?.min && !item.limit?.max,
    );
    const unavailableList = sortedQuoteList.filter(
      (item) => !item.toAmount || item.limit?.min || item.limit?.max,
    );
    return [
      ...(availableList.length > 0
        ? [
            {
              title: 'Available',
              type: ESwapProviderStatus.AVAILABLE,
              data: availableList,
            },
          ]
        : []),
      ...(unavailableList.length > 0
        ? [
            {
              title: intl.formatMessage({
                id: ETranslations.provider_unavailable,
              }),
              type: ESwapProviderStatus.UNAVAILABLE,
              data: unavailableList,
            },
          ]
        : []),
    ];
  }, [intl, sortedQuoteList]);

  const renderItem = useCallback(
    ({ item }: { item: IFetchQuoteResult; index: number }) => {
      let disabled = !item.toAmount;
      const fromTokenAmountBN = new BigNumber(activeFromTokenAmount || 0);
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
      const selected = Boolean(
        item.info.provider === selectedProviderInfo?.provider &&
        item.info.providerName === selectedProviderInfo?.providerName,
      );
      const selectedByManual = Boolean(
        item.info.provider === manualSelectProviderInfo?.provider &&
        item.info.providerName === manualSelectProviderInfo?.providerName,
      );
      const autoOpenRoute = Boolean(selected && item.openRouterInfo);
      const autoOpenRouteTrigger = selectedByManual
        ? manualSelectProviderTrigger
        : selectedProviderKey;
      return (
        <SwapProviderListItem
          testID={SwapTestIDs.providerItem(item.info.providerName)}
          onPress={!disabled ? () => onSelectQuote(item) : undefined}
          selected={selected}
          autoOpenRoute={autoOpenRoute}
          autoOpenRouteTrigger={autoOpenRouteTrigger}
          routeCollapseTrigger={selectedProviderKey}
          fromTokenAmount={activeFromTokenAmount}
          fromToken={activeFromToken}
          toToken={activeToToken}
          providerResult={item}
          currencySymbol={currencySymbol}
          disabled={disabled}
        />
      );
    },
    [
      activeFromToken,
      activeFromTokenAmount,
      activeToToken,
      currencySymbol,
      manualSelectProviderInfo?.provider,
      manualSelectProviderInfo?.providerName,
      manualSelectProviderTrigger,
      onSelectQuote,
      selectedProviderInfo?.provider,
      selectedProviderInfo?.providerName,
      selectedProviderKey,
    ],
  );

  const rightInfoComponent = useCallback(
    () => (
      <Popover
        title={intl.formatMessage({
          id: ETranslations.provider_ios_popover_title,
        })}
        renderTrigger={
          <IconButton
            testID="swap-right-info-component-icon-btn"
            variant="tertiary"
            size="medium"
            icon="InfoCircleOutline"
          />
        }
        renderContent={
          <Stack p="$5" gap="$6">
            <Stack gap="$3">
              <Stack gap="$1">
                <SizableText size="$headingMd" color="$text">
                  {intl.formatMessage({
                    id: ETranslations.provider_ios_popover_order_info_title,
                  })}
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.provider_popover_order_info_content,
                  })}
                </SizableText>
              </Stack>
              <InformationItem
                icon="LockOutline"
                content={intl.formatMessage({
                  id: ETranslations.provider_ios_popover_approval_require_msg,
                })}
              />
              <InformationItem
                icon="GasOutline"
                content={intl.formatMessage({
                  id: ETranslations.provider_network_fee,
                })}
              />
              <InformationItem
                icon="ClockTimeHistoryOutline"
                content={intl.formatMessage({
                  id: ETranslations.provider_swap_duration,
                })}
              />
            </Stack>
          </Stack>
        }
      />
    ),
    [intl],
  );

  return (
    <Page>
      <Page.Header headerRight={rightInfoComponent} />
      <SectionList
        px="$5"
        pt="$2"
        pb="$4"
        estimatedItemSize="$10"
        renderItem={renderItem}
        sections={sectionData}
        ListHeaderComponent={
          sectionData.length === 0 && isQuoteFetching ? (
            <YStack
              testID="swap-provider-list-loading"
              alignItems="center"
              justifyContent="center"
              py="$16"
            >
              <LottieView
                source={require('@onekeyhq/kit/assets/animations/swap_loading.json')}
                autoPlay
                loop
                style={{ width: 48, height: 20 }}
              />
            </YStack>
          ) : null
        }
        renderSectionHeader={({ section: { type, title } }) => {
          if (type === ESwapProviderStatus.AVAILABLE) {
            return (
              <Select
                testID="swap-select"
                title={intl.formatMessage({
                  id: ETranslations.provider_sort_title,
                })}
                items={swapProviderSortSelectItems}
                onChange={handleProviderSortChange}
                value={activeProviderSort}
                renderTrigger={({ value, label, placeholder }) => (
                  <Button
                    testID="swap-btn"
                    mt="$1"
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
          return <SectionList.SectionHeader title={title} px="$0" />;
        }}
      />
    </Page>
  );
};
