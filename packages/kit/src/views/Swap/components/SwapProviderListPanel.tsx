import { memo, useCallback, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { AnimatePresence, MotiView } from 'moti';
import { useIntl } from 'react-intl';

import {
  Button,
  Empty,
  ScrollView,
  Select,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ESwapProviderSort } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

import {
  useSwapQuoteEventFetching,
  useSwapQuoteLoading,
} from '../hooks/useSwapState';

import SwapProviderListItem from './SwapProviderListItem';
import SwapRefreshButton from './SwapRefreshButton';

interface ISwapProviderListPanelProps {
  refreshAction: (manual?: boolean) => void;
}

// Animated wrapper for each provider item
const AnimatedProviderItem = memo(
  ({
    children,
    itemKey,
    isNewItem,
  }: {
    children: React.ReactNode;
    itemKey: string;
    isNewItem: boolean;
  }) => (
    <MotiView
      key={itemKey}
      from={
        isNewItem
          ? {
              opacity: 0,
              translateY: 8,
            }
          : undefined
      }
      animate={{
        opacity: 1,
        translateY: 0,
      }}
      transition={
        {
          type: 'timing',
          duration: 200,
        } as any
      }
    >
      {children}
    </MotiView>
  ),
);

// Animated skeleton item
const AnimatedSkeletonItem = memo(({ index }: { index: number }) => (
  <MotiView
    from={{
      opacity: 0,
      translateY: 8,
    }}
    animate={{
      opacity: 1,
      translateY: 0,
    }}
    transition={
      {
        type: 'timing',
        duration: 200,
        delay: index * 80,
      } as any
    }
  >
    <Stack
      borderRadius="$4"
      borderWidth={1}
      borderColor="$borderSubdued"
      p="$3"
    >
      <XStack alignItems="center" gap="$3">
        <Skeleton width={40} height={40} radius="round" />
        <YStack flex={1} gap="$2">
          <Skeleton width={120} height={16} />
          <Skeleton width={80} height={14} />
        </YStack>
      </XStack>
    </Stack>
  </MotiView>
));

const SwapProviderListPanel = ({
  refreshAction,
}: ISwapProviderListPanelProps) => {
  const intl = useIntl();
  const [swapSortedList] = useSwapSortedQuoteListAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [, setSwapManualSelect] = useSwapManualSelectQuoteProvidersAtom();
  const [providerSort, setProviderSort] = useSwapProviderSortAtom();
  const [settingsPersist] = useSettingsPersistAtom();
  const [currentSelectQuote] = useSwapQuoteCurrentSelectAtom();
  const quoteLoading = useSwapQuoteLoading();
  const quoteEventFetching = useSwapQuoteEventFetching();

  // Cache the previous list to show during refresh (prevents flash to empty)
  const cachedListRef = useRef<IFetchQuoteResult[]>([]);
  // Track if this is first load vs refresh
  const hadPreviousQuotesRef = useRef(false);
  // Track token changes to reset cache
  const prevTokenKeyRef = useRef('');
  const currentTokenKey = `${fromToken?.contractAddress ?? ''}-${
    toToken?.contractAddress ?? ''
  }`;
  // Track if we're in a refresh cycle (list was cleared but we had data)
  const isRefreshingRef = useRef(false);

  // Reset cache when tokens change
  if (prevTokenKeyRef.current !== currentTokenKey) {
    prevTokenKeyRef.current = currentTokenKey;
    cachedListRef.current = [];
    hadPreviousQuotesRef.current = false;
    isRefreshingRef.current = false;
  }

  const isLoading = quoteLoading || quoteEventFetching;

  // Detect refresh: list becomes empty while we had previous data
  if (
    swapSortedList.length === 0 &&
    hadPreviousQuotesRef.current &&
    cachedListRef.current.length > 0
  ) {
    isRefreshingRef.current = true;
  }

  // Update cache when we have new data
  if (swapSortedList.length > 0) {
    cachedListRef.current = swapSortedList;
    hadPreviousQuotesRef.current = true;
    isRefreshingRef.current = false;
  }

  // Use cached list during refresh to prevent flash
  // Show cached data when: loading with empty list but had previous data, OR during refresh
  const displayList =
    (isLoading || isRefreshingRef.current) &&
    swapSortedList.length === 0 &&
    cachedListRef.current.length > 0
      ? cachedListRef.current
      : swapSortedList;

  // Track previous provider keys to determine which items are new
  const prevProviderKeysRef = useRef<Set<string>>(new Set());
  const currentProviderKeys = useMemo(
    () =>
      new Set(
        displayList.map(
          (item) => `${item.info.provider}-${item.info.providerName}`,
        ),
      ),
    [displayList],
  );

  // Determine if an item is new (wasn't in previous list)
  const isNewItemRef = useRef<Set<string>>(new Set());
  if (displayList.length > 0) {
    const newItems = new Set<string>();
    currentProviderKeys.forEach((key) => {
      if (!prevProviderKeysRef.current.has(key)) {
        newItems.add(key);
      }
    });
    isNewItemRef.current = newItems;
    prevProviderKeysRef.current = currentProviderKeys;
  }

  const onSelectSortChange = useCallback(
    (value: ESwapProviderSort) => {
      setProviderSort(value);
    },
    [setProviderSort],
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

  const availableList = useMemo(
    () =>
      displayList.filter(
        (item) => item.toAmount && !item.limit?.min && !item.limit?.max,
      ),
    [displayList],
  );

  const unavailableList = useMemo(
    () =>
      displayList.filter(
        (item) => !item.toAmount || item.limit?.min || item.limit?.max,
      ),
    [displayList],
  );

  const onSelectQuote = useCallback(
    (item: IFetchQuoteResult) => {
      setSwapManualSelect(item);
      defaultLogger.swap.providerChange.providerChange({
        changeFrom: currentSelectQuote?.info.provider ?? '-',
        changeTo: item.info.provider,
      });
    },
    [setSwapManualSelect, currentSelectQuote?.info.provider],
  );

  const renderItem = useCallback(
    (item: IFetchQuoteResult) => {
      let disabled = !item.toAmount;
      const fromTokenAmountBN = new BigNumber(fromTokenAmount.value ?? 0);
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
      const itemKey = `${item.info.provider}-${item.info.providerName}`;
      const isNewItem = isNewItemRef.current.has(itemKey);
      return (
        <AnimatedProviderItem
          key={itemKey}
          itemKey={itemKey}
          isNewItem={isNewItem}
        >
          <SwapProviderListItem
            onPress={
              !disabled
                ? () => {
                    onSelectQuote(item);
                  }
                : undefined
            }
            selected={Boolean(
              item.info.provider === currentSelectQuote?.info.provider &&
                item.info.providerName ===
                  currentSelectQuote?.info.providerName,
            )}
            fromTokenAmount={fromTokenAmount.value}
            fromToken={fromToken}
            toToken={toToken}
            providerResult={item}
            currencySymbol={settingsPersist.currencyInfo.symbol}
            disabled={disabled}
          />
        </AnimatedProviderItem>
      );
    },
    [
      currentSelectQuote?.info.provider,
      currentSelectQuote?.info.providerName,
      fromToken,
      fromTokenAmount,
      onSelectQuote,
      settingsPersist.currencyInfo.symbol,
      toToken,
    ],
  );

  const renderLoadingSkeleton = useCallback(
    () => (
      <YStack gap="$2" px="$3" py="$2">
        {Array.from({ length: 3 }).map((_, index) => (
          <AnimatedSkeletonItem key={index} index={index} />
        ))}
      </YStack>
    ),
    [],
  );

  const renderEmptyState = useCallback(
    () => (
      <MotiView
        from={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'timing', duration: 200 } as any}
      >
        <Stack flex={1} alignItems="center" justifyContent="center" py="$8">
          <Empty
            icon="SearchOutline"
            title={intl.formatMessage({
              id: ETranslations.global_no_results,
            })}
          />
        </Stack>
      </MotiView>
    ),
    [intl],
  );

  const hasFromAndToToken = fromToken && toToken;
  const hasFromAmount =
    fromTokenAmount.value &&
    !new BigNumber(fromTokenAmount.value).isZero() &&
    !new BigNumber(fromTokenAmount.value).isNaN();
  const shouldShowContent = hasFromAndToToken && hasFromAmount;
  const hasQuotes = displayList.length > 0;

  return (
    <YStack
      flex={1}
      borderRadius="$4"
      borderWidth={1}
      borderColor="$borderSubdued"
      bg="$bg"
      minWidth={360}
      maxWidth={440}
    >
      {/* Header */}
      <XStack
        px="$4"
        py="$3"
        alignItems="center"
        justifyContent="space-between"
        borderBottomWidth={1}
        borderBottomColor="$borderSubdued"
      >
        <SizableText size="$headingMd" color="$text">
          {intl.formatMessage({ id: ETranslations.provider_title })}
        </SizableText>
        {quoteLoading && shouldShowContent ? (
          <Skeleton width={18} height={18} radius="round" />
        ) : (
          <SwapRefreshButton
            refreshAction={refreshAction}
            disabled={!hasQuotes}
          />
        )}
      </XStack>

      {/* Sort Selector with animation */}
      <AnimatePresence>
        {shouldShowContent && hasQuotes ? (
          <MotiView
            from={{ opacity: 0, translateY: -8 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateY: -8 }}
            transition={{ type: 'timing', duration: 200 } as any}
          >
            <XStack px="$4" pt="$3">
              <Select
                title={intl.formatMessage({
                  id: ETranslations.provider_sort_title,
                })}
                items={swapProviderSortSelectItems}
                onChange={onSelectSortChange}
                value={providerSort}
                renderTrigger={({ value, label, placeholder }) => (
                  <Button
                    alignSelf="flex-start"
                    variant="tertiary"
                    size="small"
                    icon="FilterSortSolid"
                    iconAfter="ChevronDownSmallOutline"
                  >
                    <SizableText size="$bodySm">
                      {value ? label : placeholder}
                    </SizableText>
                  </Button>
                )}
              />
            </XStack>
          </MotiView>
        ) : null}
      </AnimatePresence>

      {/* Content */}
      <ScrollView flex={1}>
        <AnimatePresence>
          {!shouldShowContent ? (
            <MotiView
              key="empty-input"
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'timing', duration: 200 } as any}
            >
              <Stack
                flex={1}
                alignItems="center"
                justifyContent="center"
                py="$8"
              >
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.swap_page_button_enter_amount,
                  })}
                </SizableText>
              </Stack>
            </MotiView>
          ) : isLoading && !hasQuotes && !hadPreviousQuotesRef.current ? (
            <MotiView
              key="loading"
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'timing', duration: 150 } as any}
            >
              {renderLoadingSkeleton()}
            </MotiView>
          ) : !hasQuotes ? (
            renderEmptyState()
          ) : (
            <MotiView
              key="content"
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 150 } as any}
            >
              <YStack px="$3" pb="$3">
                {/* Available Providers */}
                {availableList.length > 0 ? (
                  <YStack>
                    {availableList.map((item) => renderItem(item))}
                  </YStack>
                ) : null}

                {/* Unavailable Providers */}
                {unavailableList.length > 0 ? (
                  <YStack>
                    <MotiView
                      from={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={
                        {
                          type: 'timing',
                          duration: 200,
                        } as any
                      }
                    >
                      <SizableText
                        size="$bodySmMedium"
                        color="$textSubdued"
                        px="$1"
                        pt="$3"
                        pb="$1"
                      >
                        {intl.formatMessage({
                          id: ETranslations.provider_unavailable,
                        })}
                      </SizableText>
                    </MotiView>
                    {unavailableList.map((item) => renderItem(item))}
                  </YStack>
                ) : null}
              </YStack>
            </MotiView>
          )}
        </AnimatePresence>
      </ScrollView>
    </YStack>
  );
};

export default memo(SwapProviderListPanel);
