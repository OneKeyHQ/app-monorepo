import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { isNumber } from 'lodash';
import { useIntl } from 'react-intl';

import {
  ActionList,
  Badge,
  Button,
  Dialog,
  Divider,
  Icon,
  Page,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  EProtocolOfExchange,
  ESwapCleanHistorySource,
  ESwapLimitOrderStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapMarketHistoryList } from '../../hooks/useSwapMarketHistoryList';
import {
  SWAP_CLEAN_EXCLUDE_PROTOCOLS,
  SWAP_HISTORY_PENDING_STATUSES,
  filterSwapMarketHistoryItems,
  getSwapHistoryListTitleId,
  getSwapMarketPendingHistoryList,
  isStockSwapHistoryItem,
} from '../../utils/swapMarketHistory';
import SwapHistoryClearButton from '../components/SwapHistoryClearButton';
import SwapMarketHistoryList from '../components/SwapMarketHistoryList';
import { SwapProviderMirror } from '../SwapProviderMirror';

import LimitOrderListModalWithAllProvider from './LimitOrderListModal';

import type { RouteProp } from '@react-navigation/core';

const SwapHistoryListModal = ({
  storeName,
}: {
  storeName: EJotaiContextStoreNames;
}) => {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapHistoryList>
    >();
  const { type } = route.params;
  const initialHistoryType =
    type === EProtocolOfExchange.LIMIT || type === EProtocolOfExchange.STOCK
      ? type
      : EProtocolOfExchange.SWAP;
  const [historyType, setHistoryType] =
    useState<EProtocolOfExchange>(initialHistoryType);
  const [{ swapHistoryPendingList, swapLimitOrders }] =
    useInAppNotificationAtom();
  useEffect(() => {
    void backgroundApiProxy.serviceSwap.refreshSwapHistoryPendingStatusOnce();
  }, []);

  // Shares the list view's hook so the savings total and clear-button guards
  // below re-fetch on the RefreshSwapHistoryList signal too — otherwise they
  // would go stale after a finished-order clear while the rendered list updates.
  const { swapTxHistoryList } = useSwapMarketHistoryList(
    EProtocolOfExchange.SWAP,
  );
  // Non-stock Swap & Bridge history only: the SWAP bucket also carries stock
  // orders, but the visible Swap & Bridge list hides them and the clear uses
  // excludeStock. Drive savings and the clear guards off the same scoped set so
  // an all-stock state doesn't show savings or pop a clear that deletes nothing.
  const swapMarketTxHistoryList = useMemo(
    () =>
      filterSwapMarketHistoryItems({
        items: swapTxHistoryList ?? [],
        protocol: EProtocolOfExchange.SWAP,
      }).filter((item) => !isStockSwapHistoryItem(item)),
    [swapTxHistoryList],
  );

  // Default fee percentage for savings calculation (0.3%)
  const DEFAULT_FEE_PERCENTAGE = 0.3;

  // Calculate cumulative savings from all completed successful orders
  const cumulativeSavings = useMemo(() => {
    if (
      historyType !== EProtocolOfExchange.SWAP ||
      !swapMarketTxHistoryList.length
    ) {
      return '$0';
    }

    let total = new BigNumber(0);

    for (const history of swapMarketTxHistoryList) {
      // Only count completed successful orders
      // eslint-disable-next-line no-continue
      if (history.status !== ESwapTxHistoryStatus.SUCCESS) continue;

      const historyOneKeyFeeUsd =
        history.swapInfo?.oneKeyFeeExtraInfo?.oneKeyFeeUsd;
      const historyOneKeyFee = history.swapInfo?.oneKeyFee;

      // Check if this order qualifies for savings (oneKeyFee is 0 or oneKeyFeeUsd is 0)
      const isSavingsOrder =
        (isNumber(historyOneKeyFee) && historyOneKeyFee === 0) ||
        (historyOneKeyFeeUsd && new BigNumber(historyOneKeyFeeUsd).eq(0));

      if (isSavingsOrder) {
        const fromAmount = history.baseInfo.fromAmount ?? '0';
        const fromPrice = history.baseInfo.fromToken?.price ?? '0';
        const fromValueUsd = new BigNumber(fromAmount).times(fromPrice);
        const savedAmount = fromValueUsd.times(DEFAULT_FEE_PERCENTAGE).div(100);
        total = total.plus(savedAmount);
      }
    }

    return numberFormat(total.toFixed(), {
      formatter: 'value',
      formatterOptions: { currency: '$' },
    });
  }, [historyType, swapMarketTxHistoryList]);

  const marketPendingHistoryItems = useMemo(
    () =>
      getSwapMarketPendingHistoryList(
        swapHistoryPendingList,
        EProtocolOfExchange.SWAP,
      ),
    [swapHistoryPendingList],
  );
  const swapMarketPendingHistoryCount = useMemo(
    () =>
      marketPendingHistoryItems.filter((item) => !isStockSwapHistoryItem(item))
        .length,
    [marketPendingHistoryItems],
  );
  const stockPendingHistoryCount = useMemo(
    () => marketPendingHistoryItems.filter(isStockSwapHistoryItem).length,
    [marketPendingHistoryItems],
  );
  const limitPendingHistoryCount = useMemo(
    () =>
      swapLimitOrders.filter(
        (item) =>
          item.status === ESwapLimitOrderStatus.OPEN ||
          item.status === ESwapLimitOrderStatus.PRESIGNATURE_PENDING,
      ).length,
    [swapLimitOrders],
  );

  const showHistoryInfoDot =
    swapMarketPendingHistoryCount +
      stockPendingHistoryCount +
      limitPendingHistoryCount >
    0;

  // Same key the route uses as its default header title, so opening the modal
  // from the Swap & Bridge entry shows an identical title and does not flash
  // from the route default to the dropdown title.
  const swapBridgeLabel = useMemo(
    () => intl.formatMessage({ id: ETranslations.swap_history_title }),
    [intl],
  );

  const historyTypeTitle = useMemo(
    () => intl.formatMessage({ id: getSwapHistoryListTitleId(historyType) }),
    [historyType, intl],
  );

  const renderHistoryTypeBadge = useCallback((count: number) => {
    if (count <= 0) {
      return null;
    }

    return (
      <Stack
        w="$5"
        h="$5"
        userSelect="none"
        borderRadius="$full"
        borderColor="$icon"
        borderWidth={1.2}
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        <SizableText color="$text" size="$bodySm">
          {count}
        </SizableText>
      </Stack>
    );
  }, []);

  const handleSelectSwapHistoryType = useCallback(() => {
    setHistoryType(EProtocolOfExchange.SWAP);
  }, []);

  const handleSelectStockHistoryType = useCallback(() => {
    setHistoryType(EProtocolOfExchange.STOCK);
  }, []);

  const handleSelectLimitHistoryType = useCallback(() => {
    setHistoryType(EProtocolOfExchange.LIMIT);
  }, []);

  const renderSwapHistoryTypeLabel = useCallback(
    () => (
      <XStack alignItems="center" gap="$2" flex={1}>
        <SizableText size="$bodyMd" $gtMd={{ size: '$bodyLg' }}>
          {swapBridgeLabel}
        </SizableText>
        {renderHistoryTypeBadge(swapMarketPendingHistoryCount)}
      </XStack>
    ),
    [renderHistoryTypeBadge, swapBridgeLabel, swapMarketPendingHistoryCount],
  );

  const renderStockHistoryTypeLabel = useCallback(
    () => (
      <XStack alignItems="center" gap="$2" flex={1}>
        <SizableText size="$bodyMd" $gtMd={{ size: '$bodyLg' }}>
          {intl.formatMessage({
            id: ETranslations.perps_token_selector_stocks,
          })}
        </SizableText>
        {renderHistoryTypeBadge(stockPendingHistoryCount)}
      </XStack>
    ),
    [intl, renderHistoryTypeBadge, stockPendingHistoryCount],
  );

  const renderLimitHistoryTypeLabel = useCallback(
    () => (
      <XStack alignItems="center" gap="$2" flex={1}>
        <SizableText size="$bodyMd" $gtMd={{ size: '$bodyLg' }}>
          {intl.formatMessage({
            id: ETranslations.swap_page_limit_dialog_title,
          })}
        </SizableText>
        {renderHistoryTypeBadge(limitPendingHistoryCount)}
      </XStack>
    ),
    [intl, limitPendingHistoryCount, renderHistoryTypeBadge],
  );

  const historyTypeItems = useMemo(
    () => [
      {
        label: swapBridgeLabel,
        renderLabel: renderSwapHistoryTypeLabel,
        extra:
          historyType === EProtocolOfExchange.SWAP ? (
            <Icon name="CheckLargeOutline" size="$4" color="$iconActive" />
          ) : undefined,
        onPress: handleSelectSwapHistoryType,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.perps_token_selector_stocks,
        }),
        renderLabel: renderStockHistoryTypeLabel,
        extra:
          historyType === EProtocolOfExchange.STOCK ? (
            <Icon name="CheckLargeOutline" size="$4" color="$iconActive" />
          ) : undefined,
        onPress: handleSelectStockHistoryType,
      },
      // Limit is not a history category on mobile (it lives in the Pro flow);
      // only offer the Limit tab in the dropdown on desktop/web.
      ...(platformEnv.isNative
        ? []
        : [
            {
              label: intl.formatMessage({
                id: ETranslations.swap_page_limit_dialog_title,
              }),
              renderLabel: renderLimitHistoryTypeLabel,
              extra:
                historyType === EProtocolOfExchange.LIMIT ? (
                  <Icon
                    name="CheckLargeOutline"
                    size="$4"
                    color="$iconActive"
                  />
                ) : undefined,
              onPress: handleSelectLimitHistoryType,
            },
          ]),
    ],
    [
      handleSelectLimitHistoryType,
      handleSelectStockHistoryType,
      handleSelectSwapHistoryType,
      historyType,
      intl,
      renderLimitHistoryTypeLabel,
      renderStockHistoryTypeLabel,
      renderSwapHistoryTypeLabel,
      swapBridgeLabel,
    ],
  );

  const historyTypeTrigger = useMemo(
    () => (
      <XStack
        testID="swap-render-header-title-select"
        alignItems="center"
        gap="$1"
        cursor="pointer"
      >
        <SizableText size="$headingLg">{historyTypeTitle}</SizableText>
        {showHistoryInfoDot ? (
          <Stack
            w="$2"
            h="$2"
            borderRadius="$full"
            backgroundColor="$textInfo"
            pointerEvents="none"
          />
        ) : null}
        <Icon name="ChevronDownSmallSolid" size="$5" />
      </XStack>
    ),
    [historyTypeTitle, showHistoryInfoDot],
  );

  const onDeleteHistory = useCallback(() => {
    // dialog
    if (!swapMarketTxHistoryList.length) return;
    Dialog.show({
      icon: 'BroomOutline',
      // description: intl.formatMessage({
      //   id: ETranslations.swap_history_all_history_content,
      // }),
      title: intl.formatMessage({
        id: ETranslations.swap_history_all_history_title,
      }),
      onConfirm: async () => {
        await backgroundApiProxy.serviceSwap.cleanSwapHistoryItems(undefined, {
          excludeProtocols: SWAP_CLEAN_EXCLUDE_PROTOCOLS,
          // The Swap & Bridge tab hides stock trades, so its Clear must not
          // delete stock history the user can't see here.
          excludeStock: true,
        });
        void backgroundApiProxy.serviceApp.showToast({
          method: 'success',
          title: intl.formatMessage({
            id: ETranslations.settings_clear_successful,
          }),
        });
        defaultLogger.swap.cleanSwapOrder.cleanSwapOrder({
          cleanFrom: ESwapCleanHistorySource.LIST,
        });
      },
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_clear,
      }),
      onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
    });
  }, [intl, swapMarketTxHistoryList.length]);

  const onDeletePendingHistory = useCallback(() => {
    // dialog
    if (
      !swapMarketTxHistoryList.some((item) =>
        SWAP_HISTORY_PENDING_STATUSES.includes(item.status),
      )
    )
      return;
    Dialog.show({
      icon: 'BroomOutline',
      description: intl.formatMessage({
        id: ETranslations.swap_history_pending_history_content,
      }),
      title: intl.formatMessage({
        id: ETranslations.swap_history_pending_history_title,
      }),
      onConfirm: () => {
        void backgroundApiProxy.serviceSwap.cleanSwapHistoryItems(
          SWAP_HISTORY_PENDING_STATUSES,
          {
            excludeProtocols: SWAP_CLEAN_EXCLUDE_PROTOCOLS,
            excludeStock: true,
          },
        );
        defaultLogger.swap.cleanSwapOrder.cleanSwapOrder({
          cleanFrom: ESwapCleanHistorySource.LIST,
        });
      },
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_clear,
      }),
      onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
    });
  }, [intl, swapMarketTxHistoryList]);

  const savingsPopoverContent = useMemo(
    () => (
      <YStack gap="$2" py="$2" w="100%">
        <YStack gap="$5" px="$4" py="$2">
          <XStack
            px="$1"
            alignItems="flex-start"
            justifyContent="space-between"
            gap="$2"
          >
            <XStack gap="$3" alignItems="flex-start" flex={1} minWidth={0}>
              <Icon
                name="Shield2CheckSolid"
                size="$5"
                color="$textSubdued"
                flexShrink={0}
              />
              <YStack gap="$1" flex={1} minWidth={0}>
                <SizableText size="$bodyMdMedium" color="$text">
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
            <Icon
              name="CheckRadioSolid"
              size="$5"
              color="$iconSuccess"
              flexShrink={0}
            />
          </XStack>

          <XStack
            px="$1"
            alignItems="flex-start"
            justifyContent="space-between"
            gap="$2"
          >
            <XStack gap="$3" alignItems="flex-start" flex={1} minWidth={0}>
              <Icon
                name="SplitSolid"
                size="$5"
                color="$textSubdued"
                flexShrink={0}
              />
              <YStack gap="$1" flex={1} minWidth={0}>
                <SizableText size="$bodyMdMedium" color="$text">
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
            <Icon
              name="CheckRadioSolid"
              size="$5"
              color="$iconSuccess"
              flexShrink={0}
            />
          </XStack>
        </YStack>

        <Divider />

        <XStack
          py="$2"
          px="$4"
          alignItems="center"
          justifyContent="space-between"
        >
          <XStack px="$1" gap="$3" alignItems="center">
            <Icon name="PiggyMoneySolid" size="$5" color="$text" />
            <SizableText size="$headingXs" color="$text">
              {intl.formatMessage({ id: ETranslations.swap_total_saved })}
            </SizableText>
          </XStack>
          <SizableText size="$headingSm" color="$textSuccess">
            +{cumulativeSavings}
          </SizableText>
        </XStack>
      </YStack>
    ),
    [intl, cumulativeSavings],
  );

  const deleteButton = useCallback(
    () => (
      <XStack gap="$2" alignItems="center">
        {cumulativeSavings !== '$0' && gtMd ? (
          <Popover
            title={intl.formatMessage({
              id: ETranslations.perps_saving_breakdown,
            })}
            floatingPanelProps={{
              width: 320,
            }}
            renderTrigger={
              <Badge
                badgeSize="lg"
                badgeType="success"
                py="$1"
                gap="$1.5"
                borderRadius="$8"
                cursor="pointer"
                hoverStyle={{
                  opacity: 0.8,
                }}
              >
                <Icon name="PiggyMoneySolid" size="$3" color="$iconSuccess" />
                <SizableText size="$bodySmMedium" color="$textSuccess">
                  {cumulativeSavings}
                </SizableText>
              </Badge>
            }
            renderContent={savingsPopoverContent}
          />
        ) : null}
        <ActionList
          title={intl.formatMessage({
            id: ETranslations.global_clear,
          })}
          items={[
            {
              label: intl.formatMessage({
                id: ETranslations.swap_history_pending_history,
              }),
              onPress: onDeletePendingHistory,
            },
            {
              label: intl.formatMessage({
                id: ETranslations.swap_history_all_history,
              }),
              onPress: onDeleteHistory,
            },
          ]}
          renderTrigger={
            <Button variant="tertiary" testID="swap-btn">
              {intl.formatMessage({ id: ETranslations.global_clear })}
            </Button>
          }
        />
      </XStack>
    ),
    [
      intl,
      onDeleteHistory,
      onDeletePendingHistory,
      cumulativeSavings,
      gtMd,
      savingsPopoverContent,
    ],
  );

  const stockDeleteButton = useCallback(
    () => <SwapHistoryClearButton scope="stock" triggerVariant="text" />,
    [],
  );

  // Limit has no clear; Stock clears its own dataset; everything else (Swap &
  // Bridge) uses the savings-aware clear button.
  const headerRightButton = useMemo(() => {
    if (historyType === EProtocolOfExchange.LIMIT) {
      return undefined;
    }
    return historyType === EProtocolOfExchange.STOCK
      ? stockDeleteButton
      : deleteButton;
  }, [deleteButton, historyType, stockDeleteButton]);

  const headerSelectType = useCallback(
    () => (
      // Render the ActionList directly (not via LazyHeaderTitle): on iOS the
      // lazy wrapper returns null for ~380ms and the native header does not
      // reliably re-render a headerTitle that started as null, leaving the
      // title/dropdown blank.
      <ActionList
        title={historyTypeTitle}
        items={historyTypeItems}
        renderTrigger={historyTypeTrigger}
      />
    ),
    [historyTypeItems, historyTypeTitle, historyTypeTrigger],
  );

  const savingsBanner = useMemo(() => {
    if (
      cumulativeSavings === '$0' ||
      gtMd ||
      historyType !== EProtocolOfExchange.SWAP
    ) {
      return null;
    }

    return (
      <Popover
        title={intl.formatMessage({ id: ETranslations.perps_saving_breakdown })}
        floatingPanelProps={{
          width: 320,
        }}
        renderTrigger={
          <XStack
            mx="$5"
            mt="$5"
            px="$4"
            py="$3"
            backgroundColor="$bgStrong"
            borderRadius="$3"
            alignItems="center"
            justifyContent="space-between"
            cursor="pointer"
            hoverStyle={{
              opacity: 0.8,
            }}
            borderColor="$borderSubdued"
            borderWidth={1}
          >
            <XStack gap="$2.5" alignItems="center" flex={1}>
              <Icon name="PiggyMoneySolid" size="$5" color="$iconSuccess" />
              <SizableText size="$bodyMd" color="$text">
                {intl
                  .formatMessage(
                    { id: ETranslations.perps_onekey_has_saved_you },
                    { fee: '__FEE__' },
                  )
                  .split('__FEE__')
                  .reduce((acc, part, index) => {
                    if (index === 0) return [part];
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                    return [
                      ...acc,
                      <SizableText
                        key={index}
                        size="$bodyMd"
                        color="$textSuccess"
                        fontWeight="600"
                      >
                        {cumulativeSavings}
                      </SizableText>,
                      part,
                    ];
                  }, [] as any[])}
              </SizableText>
            </XStack>
            <Icon name="ChevronRightSmallOutline" size="$5" color="$icon" />
          </XStack>
        }
        renderContent={savingsPopoverContent}
      />
    );
  }, [cumulativeSavings, gtMd, historyType, intl, savingsPopoverContent]);

  return (
    <Page>
      <Page.Header
        headerRight={headerRightButton}
        headerRightNoGlass
        headerTitleAlign={gtMd ? 'left' : 'center'}
        headerTitle={headerSelectType}
      />
      {historyType !== EProtocolOfExchange.LIMIT ? (
        <YStack flex={1}>
          {savingsBanner}
          <SwapMarketHistoryList protocol={historyType} />
        </YStack>
      ) : (
        <LimitOrderListModalWithAllProvider storeName={storeName} />
      )}
    </Page>
  );
};

const SwapHistoryListModalWithProvider = () => {
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapHistoryList>
    >();
  const { storeName } = route.params;
  return (
    <SwapProviderMirror storeName={storeName}>
      <SwapHistoryListModal storeName={storeName} />
    </SwapProviderMirror>
  );
};

export default SwapHistoryListModalWithProvider;
