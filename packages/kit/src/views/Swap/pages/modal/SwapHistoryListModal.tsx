import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  ActionList,
  Button,
  Dialog,
  Icon,
  Page,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import {
  EProtocolOfExchange,
  ESwapCleanHistorySource,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapLimitOrdersLocalDataVisibility } from '../../hooks/useSwapLocalDataVisibility';
import { useSwapMarketHistoryList } from '../../hooks/useSwapMarketHistoryList';
import {
  SWAP_CLEAN_EXCLUDE_PROTOCOLS,
  SWAP_HISTORY_PENDING_STATUSES,
  filterSwapMarketHistoryItems,
  getSwapHistoryListTitleId,
  getSwapLimitOpenOrderCount,
  getSwapMarketPendingHistoryList,
  isStockSwapHistoryItem,
  isSwapLimitHistoryTypeSupported,
} from '../../utils/swapMarketHistory';
import { SwapHistoryClearButtonView } from '../components/SwapHistoryClearButton';
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
  const [
    { swapHistoryPendingList, swapLimitOrders, swapLimitOrdersAccountIdKey },
  ] = useInAppNotificationAtom();
  const { shouldShowSwapLocalData, shouldShowSwapLimitOrders } =
    useSwapLimitOrdersLocalDataVisibility(swapLimitOrdersAccountIdKey);
  const shouldShowLimitHistoryType = isSwapLimitHistoryTypeSupported({
    isNative: platformEnv.isNative,
  });
  const visibleHistoryType =
    historyType === EProtocolOfExchange.LIMIT && !shouldShowLimitHistoryType
      ? EProtocolOfExchange.SWAP
      : historyType;
  useEffect(() => {
    void backgroundApiProxy.serviceSwap.refreshSwapHistoryPendingStatusOnce();
  }, []);

  // Shares the list view's hook so the clear-button guards below re-fetch on the
  // RefreshSwapHistoryList signal too.
  const { swapTxHistoryList } = useSwapMarketHistoryList(
    EProtocolOfExchange.SWAP,
  );
  // Non-stock Swap & Bridge history only: the SWAP bucket also carries stock
  // orders, but the visible Swap & Bridge list hides them and the clear uses
  // excludeStock. Drive the clear guards off the same scoped set so an all-stock
  // state doesn't pop a clear that deletes nothing.
  const swapMarketTxHistoryList = useMemo(
    () =>
      filterSwapMarketHistoryItems({
        items: swapTxHistoryList ?? [],
        protocol: EProtocolOfExchange.SWAP,
      }).filter((item) => !isStockSwapHistoryItem(item)),
    [swapTxHistoryList],
  );

  const marketPendingHistoryItems = useMemo(
    () =>
      getSwapMarketPendingHistoryList(
        shouldShowSwapLocalData ? swapHistoryPendingList : [],
        EProtocolOfExchange.SWAP,
      ),
    [shouldShowSwapLocalData, swapHistoryPendingList],
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
      shouldShowSwapLimitOrders
        ? getSwapLimitOpenOrderCount(swapLimitOrders)
        : 0,
    [shouldShowSwapLimitOrders, swapLimitOrders],
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
    () =>
      intl.formatMessage({ id: getSwapHistoryListTitleId(visibleHistoryType) }),
    [visibleHistoryType, intl],
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
          visibleHistoryType === EProtocolOfExchange.SWAP ? (
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
          visibleHistoryType === EProtocolOfExchange.STOCK ? (
            <Icon name="CheckLargeOutline" size="$4" color="$iconActive" />
          ) : undefined,
        onPress: handleSelectStockHistoryType,
      },
      // Limit is not a history category on mobile (it lives in the Pro flow);
      // only offer the Limit tab in the dropdown on desktop/web.
      ...(shouldShowLimitHistoryType
        ? [
            {
              label: intl.formatMessage({
                id: ETranslations.swap_page_limit_dialog_title,
              }),
              renderLabel: renderLimitHistoryTypeLabel,
              extra:
                visibleHistoryType === EProtocolOfExchange.LIMIT ? (
                  <Icon
                    name="CheckLargeOutline"
                    size="$4"
                    color="$iconActive"
                  />
                ) : undefined,
              onPress: handleSelectLimitHistoryType,
            },
          ]
        : []),
    ],
    [
      handleSelectLimitHistoryType,
      handleSelectStockHistoryType,
      handleSelectSwapHistoryType,
      intl,
      renderLimitHistoryTypeLabel,
      renderStockHistoryTypeLabel,
      renderSwapHistoryTypeLabel,
      shouldShowLimitHistoryType,
      swapBridgeLabel,
      visibleHistoryType,
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

  const deleteButton = useCallback(
    () => (
      <XStack gap="$2" alignItems="center">
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
    [intl, onDeleteHistory, onDeletePendingHistory],
  );

  const stockDeleteButton = useCallback(
    () => (
      <SwapHistoryClearButtonView
        scope="stock"
        swapTxHistoryList={swapTxHistoryList}
      />
    ),
    [swapTxHistoryList],
  );

  // Limit has no clear; Stock clears its own dataset; everything else (Swap &
  // Bridge) uses the scoped clear button.
  const headerRightButton = useMemo(() => {
    if (!shouldShowSwapLocalData) {
      return undefined;
    }
    if (visibleHistoryType === EProtocolOfExchange.LIMIT) {
      return undefined;
    }
    return visibleHistoryType === EProtocolOfExchange.STOCK
      ? stockDeleteButton
      : deleteButton;
  }, [
    deleteButton,
    visibleHistoryType,
    shouldShowSwapLocalData,
    stockDeleteButton,
  ]);

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

  return (
    <Page>
      <Page.Header
        headerRight={headerRightButton}
        headerRightNoGlass
        headerTitleAlign={gtMd ? 'left' : 'center'}
        headerTitle={headerSelectType}
      />
      {visibleHistoryType !== EProtocolOfExchange.LIMIT ? (
        <SwapMarketHistoryList protocol={visibleHistoryType} />
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

export default function SwapHistoryListModalWithAllProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.swap,
      }}
      enabledNum={[0, 1]}
    >
      <SwapHistoryListModalWithProvider />
    </AccountSelectorProviderMirror>
  );
}
