import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { AnimatePresence, MotiView } from 'moti';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Empty,
  Icon,
  LottieView,
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
  useSwapQuoteEventTotalCountAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSortedQuoteListAtom,
  useSwapTypeSwitchAtom,
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
AnimatedProviderItem.displayName = 'AnimatedProviderItem';

// Animated skeleton item - matches real card dimensions
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
    exit={{
      opacity: 0,
      translateY: -8,
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
      my="$2"
      overflow="hidden"
      borderCurve="continuous"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
    >
      <Skeleton height={102} radius="square" />
    </Stack>
  </MotiView>
));
AnimatedSkeletonItem.displayName = 'AnimatedSkeletonItem';

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
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const [quoteEventTotalCount] = useSwapQuoteEventTotalCountAtom();

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
  // Track swap type switch changes to reset cache (OK-49718)
  const prevSwapTypeSwitchRef = useRef(swapTypeSwitch);
  // Track quote event id changes to reset cache when new quote starts (OK-49718)
  const prevQuoteEventIdRef = useRef(quoteEventTotalCount.eventId);
  // Track if waiting for new quote to prevent flash to empty state (OK-49718)
  const isWaitingForNewQuoteRef = useRef(false);

  // ScrollView ref for auto-scrolling to selected provider (OK-49778)
  const scrollViewRef = useRef<{
    scrollTo: (options: { y: number; animated?: boolean }) => void;
  } | null>(null);
  // Track previous loading state for detecting when loading completes
  const prevIsLoadingRef = useRef(false);

  // Reset cache when tokens change
  if (prevTokenKeyRef.current !== currentTokenKey) {
    prevTokenKeyRef.current = currentTokenKey;
    cachedListRef.current = [];
    hadPreviousQuotesRef.current = false;
    isRefreshingRef.current = false;
    isWaitingForNewQuoteRef.current = true;
  }

  // Reset cache when swap type switch changes (Swap/Limit/Bridge) (OK-49718)
  if (prevSwapTypeSwitchRef.current !== swapTypeSwitch) {
    prevSwapTypeSwitchRef.current = swapTypeSwitch;
    cachedListRef.current = [];
    hadPreviousQuotesRef.current = false;
    isRefreshingRef.current = false;
    isWaitingForNewQuoteRef.current = true;
  }

  // Reset cache when a new quote event starts (different eventId means new quote request) (OK-49718)
  // Also reset when quote is cleared (eventId becomes undefined or count becomes 0)
  if (
    prevQuoteEventIdRef.current !== quoteEventTotalCount.eventId ||
    (quoteEventTotalCount.count === 0 && prevQuoteEventIdRef.current)
  ) {
    prevQuoteEventIdRef.current = quoteEventTotalCount.eventId;
    cachedListRef.current = [];
    hadPreviousQuotesRef.current = false;
    isRefreshingRef.current = false;
    isWaitingForNewQuoteRef.current = true;
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

  // Check if we should skip animation before updating the waiting state
  const wasWaitingForNewQuote = isWaitingForNewQuoteRef.current;

  // Update cache when we have new data
  if (swapSortedList.length > 0) {
    cachedListRef.current = swapSortedList;
    hadPreviousQuotesRef.current = true;
    isRefreshingRef.current = false;
    isWaitingForNewQuoteRef.current = false;
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
  // Skip animation when transitioning from loading/waiting state (OK-49718)
  const isNewItemRef = useRef<Set<string>>(new Set());
  if (displayList.length > 0) {
    // If we were waiting for new quote, skip animation for the first batch
    if (wasWaitingForNewQuote || prevProviderKeysRef.current.size === 0) {
      isNewItemRef.current = new Set();
    } else {
      const newItems = new Set<string>();
      currentProviderKeys.forEach((key) => {
        if (!prevProviderKeysRef.current.has(key)) {
          newItems.add(key);
        }
      });
      isNewItemRef.current = newItems;
    }
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

  // Auto-scroll to selected provider when loading completes (OK-49778)
  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoading;

    // Only scroll when loading just completed (transition from loading to not loading)
    if (
      wasLoading &&
      !isLoading &&
      currentSelectQuote &&
      availableList.length > 0
    ) {
      const selectedIndex = availableList.findIndex(
        (item) =>
          item.info.provider === currentSelectQuote.info.provider &&
          item.info.providerName === currentSelectQuote.info.providerName,
      );

      if (selectedIndex > 0 && scrollViewRef.current) {
        // Estimate item height: ~120px per item (including padding and margins)
        const estimatedItemHeight = 120;
        const scrollY = selectedIndex * estimatedItemHeight;
        // Add a small delay to ensure the list is rendered
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
        }, 100);
      }
    }
  }, [isLoading, currentSelectQuote, availableList]);

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
              item.info.providerName === currentSelectQuote?.info.providerName,
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

  const renderEmptyState = useCallback(
    () => (
      <Stack alignItems="center" justifyContent="center" py="$8">
        <Empty
          illustration="QuestionMark"
          title={intl.formatMessage({
            id: ETranslations.global_no_results,
          })}
        />
      </Stack>
    ),
    [intl],
  );

  const renderInitialState = useCallback(
    () => (
      <XStack
        overflow="hidden"
        px="$10"
        py="$12"
        gap="$4"
        justifyContent="space-between"
      >
        {/* Left Column */}
        <YStack width="40%" justifyContent="space-between">
          {/* Top Content */}
          <YStack gap="$5" mt="$2" justifyContent="space-between">
            {/* Title */}
            <YStack>
              <SizableText
                color="$text"
                style={{
                  fontSize: 32,
                  fontWeight: '900',
                  lineHeight: 38,
                  letterSpacing: -0.5,
                }}
                $platform-web={{
                  // @ts-ignore
                  WebkitTextStroke: '0.3px currentColor',
                }}
              >
                {intl.formatMessage({
                  id: ETranslations.swap_provider_panel_title_line1,
                })}
              </SizableText>
              <SizableText
                color="$text"
                style={{
                  fontSize: 32,
                  fontWeight: '900',
                  lineHeight: 38,
                  letterSpacing: -0.5,
                }}
                $platform-web={{
                  // @ts-ignore
                  WebkitTextStroke: '0.3px currentColor',
                }}
              >
                {intl.formatMessage({
                  id: ETranslations.swap_provider_panel_title_line2,
                })}
              </SizableText>
            </YStack>

            {/* Description */}
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              style={{ lineHeight: 20 }}
            >
              {intl.formatMessage({
                id: ETranslations.swap_provider_panel_desc,
              })}
            </SizableText>

            {/* Badges */}
            <XStack gap="$2" mt={60} flexWrap="wrap">
              <XStack
                alignSelf="flex-start"
                px="$2.5"
                py="$1"
                borderRadius="$full"
                borderWidth={1}
                borderColor="$borderSuccessSubdued"
                bg="$bgSuccessSubdued"
                alignItems="center"
                gap="$2"
              >
                <Stack
                  width={8}
                  height={8}
                  borderRadius="$full"
                  bg="$iconSuccess"
                />
                <SizableText
                  color="$textSuccess"
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                  }}
                >
                  {intl.formatMessage({
                    id: ETranslations.swap_provider_panel_badge_dexs,
                  })}
                </SizableText>
              </XStack>

              <XStack
                alignSelf="flex-start"
                px="$2.5"
                py="$1"
                borderRadius="$full"
                borderWidth={1}
                borderColor="$borderSubdued"
                alignItems="center"
              >
                <SizableText
                  color="$textSubdued"
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                  }}
                >
                  {intl.formatMessage({
                    id: ETranslations.swap_provider_panel_badge_chains,
                  })}
                </SizableText>
              </XStack>

              <XStack
                alignSelf="flex-start"
                px="$2.5"
                py="$1"
                borderRadius="$full"
                borderWidth={1}
                borderColor="$borderSubdued"
                alignItems="center"
              >
                <SizableText
                  color="$textSubdued"
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                  }}
                >
                  {intl.formatMessage({
                    id: ETranslations.swap_provider_panel_badge_availability,
                  })}
                </SizableText>
              </XStack>
            </XStack>
          </YStack>
        </YStack>

        {/* Right Column - Feature List */}
        <YStack width="50%" justifyContent="center" gap="$6">
          <XStack alignItems="flex-start" gap="$3">
            <Icon
              name="DollarSolid"
              size="$7"
              color="$iconSuccess"
              flexShrink={0}
            />
            <YStack flex={1} gap="$1">
              <SizableText size="$bodyMdMedium" color="$text" fontWeight="600">
                {intl.formatMessage({
                  id: ETranslations.swap_provider_panel_feature_zero_fee,
                })}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.swap_provider_panel_feature_zero_fee_desc,
                })}
              </SizableText>
            </YStack>
          </XStack>

          <Stack ml="$10" height={0.5} bg="$borderSubdued" opacity={0.5} />

          {/* MEV Shield */}
          <XStack alignItems="flex-start" gap="$3">
            <Icon
              name="Shield2CheckSolid"
              size="$7"
              color="$iconSuccess"
              flexShrink={0}
            />
            <YStack flex={1} gap="$1">
              <SizableText size="$bodyMdMedium" color="$text" fontWeight="600">
                {intl.formatMessage({
                  id: ETranslations.swap_provider_panel_feature_mev,
                })}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.swap_provider_panel_feature_mev_desc,
                })}
              </SizableText>
            </YStack>
          </XStack>

          <Stack ml="$10" height={0.5} bg="$borderSubdued" opacity={0.5} />

          {/* Smart Routing */}
          <XStack alignItems="flex-start" gap="$3">
            <Icon
              name="SplitSolid"
              size="$7"
              color="$iconSuccess"
              flexShrink={0}
            />
            <YStack flex={1} gap="$1">
              <SizableText size="$bodyMdMedium" color="$text" fontWeight="600">
                {intl.formatMessage({
                  id: ETranslations.swap_provider_panel_feature_routing,
                })}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.swap_provider_panel_feature_routing_desc,
                })}
              </SizableText>
            </YStack>
          </XStack>

          <Stack ml="$10" height={0.5} bg="$borderSubdued" opacity={0.5} />

          {/* High Liquidity */}
          <XStack alignItems="flex-start" gap="$3">
            <Icon
              name="HandCoinsSolid"
              size="$7"
              color="$iconSuccess"
              flexShrink={0}
            />
            <YStack flex={1} gap="$1">
              <SizableText size="$bodyMdMedium" color="$text" fontWeight="600">
                {intl.formatMessage({
                  id: ETranslations.swap_provider_panel_feature_liquidity,
                })}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.swap_provider_panel_feature_liquidity_desc,
                })}
              </SizableText>
            </YStack>
          </XStack>
        </YStack>
      </XStack>
    ),
    [intl],
  );

  const hasFromAndToToken = fromToken && toToken;
  const hasFromAmount =
    fromTokenAmount.value &&
    !new BigNumber(fromTokenAmount.value).isZero() &&
    !new BigNumber(fromTokenAmount.value).isNaN();
  const shouldShowContent = hasFromAndToToken && hasFromAmount;

  // Clear cache immediately when content should not be displayed (e.g., amount cleared)
  // This prevents stale list data from persisting during AnimatePresence exit
  if (!shouldShowContent) {
    cachedListRef.current = [];
    hadPreviousQuotesRef.current = false;
    isRefreshingRef.current = false;
  }

  const hasQuotes = displayList.length > 0;

  // Whether the SSE total event has been received
  const hasReceivedTotal = quoteEventTotalCount.count > 0;
  // Number of skeleton placeholders for providers not yet received
  const remainingSkeletonCount =
    hasReceivedTotal && quoteEventFetching
      ? Math.max(0, quoteEventTotalCount.count - displayList.length)
      : 0;

  const contentArea = (
    <AnimatePresence>
      {/* Phase 1: Spinner - no total event received yet (covers gap before loading starts) */}
      {shouldShowContent && !hasQuotes && !hasReceivedTotal ? (
        <MotiView
          key="spinner"
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'timing', duration: 150 } as any}
          exitTransition={{ type: 'timing', duration: 0 } as any}
        >
          <YStack alignItems="center" justifyContent="center" py="$16" gap="$3">
            <LottieView
              source={require('@onekeyhq/kit/assets/animations/swap_loading.json')}
              autoPlay
              loop
              style={{
                width: 48,
                height: 20,
              }}
            />
            <SizableText size="$bodyLgMedium" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.swap_page_button_fetching_quotes,
              })}
            </SizableText>
          </YStack>
        </MotiView>
      ) : null}

      {/* Phase 2+3: Data cards + skeleton placeholders for remaining */}
      {shouldShowContent &&
      (hasQuotes || (hasReceivedTotal && quoteEventFetching)) ? (
        <MotiView
          key="content"
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'timing', duration: 150 } as any}
          exitTransition={{ type: 'timing', duration: 0 } as any}
        >
          <YStack px="$5" pb="$5">
            {/* Available Providers */}
            {availableList.length > 0 ? (
              <YStack>{availableList.map((item) => renderItem(item))}</YStack>
            ) : null}

            {/* Skeleton placeholders for providers not yet received */}
            {remainingSkeletonCount > 0 ? (
              <YStack>
                {Array.from({ length: remainingSkeletonCount }).map(
                  (_, index) => (
                    <AnimatedSkeletonItem
                      key={`skeleton-${index}`}
                      index={index}
                    />
                  ),
                )}
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
      ) : null}

      {/* Empty state - total received, all providers responded, no results */}
      {shouldShowContent &&
      !hasQuotes &&
      hasReceivedTotal &&
      !quoteEventFetching
        ? renderEmptyState()
        : null}
    </AnimatePresence>
  );

  return (
    <YStack
      minHeight={480}
      maxHeight={820}
      borderRadius="$6"
      borderWidth={1}
      borderColor="$borderSubdued"
      elevationAndroid="$1"
      $platform-web={{
        boxShadow: '0px 0px 24px 0px rgba(0, 0, 0, 0.06)',
        // Limit max height to viewport height minus some spacing
        maxHeight: 'calc(100vh - 200px)',
      }}
      style={{
        shadowColor: 'rgba(0, 0, 0, 0.08)',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 24,
      }}
    >
      {shouldShowContent ? (
        <XStack
          px="$6"
          pt="$6"
          pb="$3"
          alignItems="center"
          justifyContent="space-between"
        >
          <SizableText size="$headingLg" color="$text">
            {intl.formatMessage({ id: ETranslations.Limit_info_provider })}
          </SizableText>
          {quoteLoading ? (
            <Skeleton width={18} height={18} radius="round" />
          ) : (
            <SwapRefreshButton
              refreshAction={refreshAction}
              disabled={!hasQuotes}
            />
          )}
        </XStack>
      ) : null}

      {/* Sort Selector */}
      {shouldShowContent && hasQuotes ? (
        <XStack px="$5" pt="$3">
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
      ) : null}

      {/* Initial state - no tokens/amount selected - rendered outside ScrollView */}
      {!shouldShowContent ? (
        <Stack flex={1} justifyContent="center">
          {renderInitialState()}
        </Stack>
      ) : null}

      {/* ScrollView only shown when content is available */}
      {shouldShowContent ? (
        <ScrollView flex={1} ref={scrollViewRef as any} nestedScrollEnabled>
          {contentArea}
        </ScrollView>
      ) : null}
    </YStack>
  );
};

export default memo(SwapProviderListPanel);
