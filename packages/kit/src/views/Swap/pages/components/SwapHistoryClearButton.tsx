import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, Button, Dialog, IconButton } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EProtocolOfExchange,
  ESwapCleanHistorySource,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapMarketHistoryList } from '../../hooks/useSwapMarketHistoryList';
import {
  SWAP_CLEAN_EXCLUDE_PROTOCOLS,
  SWAP_HISTORY_PENDING_STATUSES,
  filterSwapMarketHistoryItems,
  isStockSwapHistoryItem,
} from '../../utils/swapMarketHistory';

// Clear control for the Order History surfaces. The Swap & Bridge and Pro tabs
// share one dataset (non-stock trades), and Stocks owns a separate one, so the
// scope decides both which rows count as "history here" and which slice
// cleanSwapHistoryItems removes:
//   - swap:  every non-stock market trade (excludeStock), minus limit/private
//            send which live in their own surfaces.
//   - stock: only stock trades (onlyStock).
// Mirrors the Swap & Bridge clear menu: both menu items stay enabled and the
// handlers no-op when there is nothing to clear.
type ISwapHistoryClearScope = 'swap' | 'stock';

function getCleanOptions(scope: ISwapHistoryClearScope) {
  // Both scopes exclude limit / private-send: those live in their own surfaces
  // and are filtered out of the list/guards here (filterSwapMarketHistoryItems),
  // so clearing must not physically delete rows the user can't see on this panel.
  return scope === 'stock'
    ? { onlyStock: true, excludeProtocols: SWAP_CLEAN_EXCLUDE_PROTOCOLS }
    : { excludeStock: true, excludeProtocols: SWAP_CLEAN_EXCLUDE_PROTOCOLS };
}

function SwapHistoryClearButton({
  scope,
  triggerVariant = 'text',
}: {
  scope: ISwapHistoryClearScope;
  triggerVariant?: 'text' | 'icon';
}) {
  const intl = useIntl();
  const { swapTxHistoryList } = useSwapMarketHistoryList(
    EProtocolOfExchange.SWAP,
  );

  const scopedHistoryList = useMemo(() => {
    const marketList = filterSwapMarketHistoryItems({
      items: swapTxHistoryList ?? [],
      protocol: EProtocolOfExchange.SWAP,
    });
    return scope === 'stock'
      ? marketList.filter(isStockSwapHistoryItem)
      : marketList.filter((item) => !isStockSwapHistoryItem(item));
  }, [scope, swapTxHistoryList]);

  const hasHistory = scopedHistoryList.length > 0;
  const hasPending = useMemo(
    () =>
      scopedHistoryList.some((item) =>
        SWAP_HISTORY_PENDING_STATUSES.includes(item.status),
      ),
    [scopedHistoryList],
  );

  // Clear-all and clear-pending share the same dialog shape; only the status
  // filter, the description copy, and the success toast differ.
  const showClearDialog = useCallback(
    (variant: 'all' | 'pending') => {
      const isPending = variant === 'pending';
      if (isPending ? !hasPending : !hasHistory) {
        return;
      }
      Dialog.show({
        icon: 'BroomOutline',
        title: intl.formatMessage({
          id: isPending
            ? ETranslations.swap_history_pending_history_title
            : ETranslations.swap_history_all_history_title,
        }),
        description: isPending
          ? intl.formatMessage({
              id: ETranslations.swap_history_pending_history_content,
            })
          : undefined,
        onConfirm: async () => {
          await backgroundApiProxy.serviceSwap.cleanSwapHistoryItems(
            isPending ? SWAP_HISTORY_PENDING_STATUSES : undefined,
            getCleanOptions(scope),
          );
          if (!isPending) {
            void backgroundApiProxy.serviceApp.showToast({
              method: 'success',
              title: intl.formatMessage({
                id: ETranslations.settings_clear_successful,
              }),
            });
          }
          defaultLogger.swap.cleanSwapOrder.cleanSwapOrder({
            cleanFrom: ESwapCleanHistorySource.LIST,
          });
        },
        onConfirmText: intl.formatMessage({ id: ETranslations.global_clear }),
        onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
      });
    },
    [hasHistory, hasPending, intl, scope],
  );

  const items = useMemo(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.swap_history_pending_history,
        }),
        onPress: () => showClearDialog('pending'),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.swap_history_all_history,
        }),
        onPress: () => showClearDialog('all'),
      },
    ],
    [intl, showClearDialog],
  );

  return (
    <ActionList
      title={intl.formatMessage({ id: ETranslations.global_clear })}
      items={items}
      renderTrigger={
        triggerVariant === 'icon' ? (
          <IconButton
            icon="BroomOutline"
            variant="tertiary"
            size="small"
            title={intl.formatMessage({ id: ETranslations.global_clear })}
            testID={`swap-history-clear-icon-${scope}`}
          />
        ) : (
          <Button variant="tertiary" testID={`swap-history-clear-btn-${scope}`}>
            {intl.formatMessage({ id: ETranslations.global_clear })}
          </Button>
        )
      }
    />
  );
}

export default SwapHistoryClearButton;
