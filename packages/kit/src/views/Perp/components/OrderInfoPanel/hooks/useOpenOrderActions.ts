import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  type IPerpsActiveTwapOrder,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAccountAtom,
  usePerpsCustomSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  normalizePerpsAccountAddress,
  resolveBboOrderPrice,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useEnsureTradingEnabled } from '../../../hooks/useEnableTradingWithDepositFallback';
import { isPerpsAccountAddressMatched } from '../../../utils/accountScopedData';
import { showChaseOrderConfirmDialog } from '../ChaseOrderConfirmModal';
import { canChasePerpsOrder } from '../utils';

import { useChasingOrderTask } from './useChasingOrderTask';

export function useOpenOrderActions(accountScopedAddress?: string | null) {
  const intl = useIntl();
  const [currentUser] = usePerpsActiveAccountAtom();
  const [perpsCustomSettings] = usePerpsCustomSettingsAtom();
  const actions = useHyperliquidActions();
  const ensureTradingEnabled = useEnsureTradingEnabled();
  const { chasingOrderIds, isChasingOrder, runChasingOrderTask } =
    useChasingOrderTask();
  const activeAccountAddressRef = useRef(currentUser?.accountAddress);
  const scopedAccountAddressRef = useRef(accountScopedAddress);
  activeAccountAddressRef.current = currentUser?.accountAddress;
  scopedAccountAddressRef.current = accountScopedAddress;
  const canMutateScopedOrders = isPerpsAccountAddressMatched({
    activeAccountAddress: currentUser?.accountAddress,
    dataAccountAddress: accountScopedAddress,
  });
  const assertCurrentAccount = useCallback(() => {
    if (
      !isPerpsAccountAddressMatched({
        activeAccountAddress: activeAccountAddressRef.current,
        dataAccountAddress: accountScopedAddress,
      }) ||
      !isPerpsAccountAddressMatched({
        activeAccountAddress: scopedAccountAddressRef.current,
        dataAccountAddress: accountScopedAddress,
      })
    ) {
      throw new OneKeyLocalError(
        intl.formatMessage({
          id: ETranslations.active_trading_account_changed__msg,
        }),
      );
    }
  }, [accountScopedAddress, intl]);

  const handleCancelOrder = useCallback(
    async (order: IPerpsFrontendOrder) => {
      try {
        assertCurrentAccount();
        await ensureTradingEnabled();
        const symbolMeta =
          await backgroundApiProxy.serviceHyperliquid.getSymbolMeta({
            coin: order.coin,
          });
        const tokenInfo = symbolMeta;
        if (!tokenInfo) {
          Toast.message({
            title: intl.formatMessage({
              id: ETranslations.perp_token_info_not_found__msg,
            }),
          });
          return;
        }
        assertCurrentAccount();
        await actions.current
          .cancelOrder({
            orders: [
              {
                assetId: tokenInfo.assetId,
                oid: order.oid,
              },
            ],
          })
          .catch(() => undefined);
      } catch (error) {
        Toast.error({
          title:
            error instanceof Error
              ? error.message
              : intl.formatMessage({
                  id: ETranslations.perp_simple_failed_cancel_order__msg,
                }),
        });
      }
    },
    [actions, assertCurrentAccount, ensureTradingEnabled, intl],
  );

  const handleCancelTwapOrder = useCallback(
    async (order: IPerpsActiveTwapOrder) => {
      try {
        assertCurrentAccount();
        await ensureTradingEnabled();
        const symbolMeta =
          await backgroundApiProxy.serviceHyperliquid.getSymbolMeta({
            coin: order.state.coin,
          });
        if (!symbolMeta) {
          Toast.message({
            title: intl.formatMessage({
              id: ETranslations.perp_token_info_not_found__msg,
            }),
          });
          return;
        }
        assertCurrentAccount();
        await actions.current
          .cancelTwapOrder({
            assetId: symbolMeta.assetId,
            twapId: order.twapId,
          })
          .catch(() => undefined);
      } catch (error) {
        Toast.error({
          title:
            error instanceof Error
              ? error.message
              : intl.formatMessage({
                  id: ETranslations.perp_failed_cancel_twap_order__msg,
                }),
        });
      }
    },
    [actions, assertCurrentAccount, ensureTradingEnabled, intl],
  );

  const resolveChaseTargetPrice = useCallback(
    async (order: IPerpsFrontendOrder) => {
      const symbolMeta =
        await backgroundApiProxy.serviceHyperliquid.getSymbolMeta({
          coin: order.coin,
        });
      const szDecimals = symbolMeta?.universe?.szDecimals;
      if (!symbolMeta || symbolMeta.isSpot || szDecimals === undefined) {
        throw new OneKeyLocalError(
          intl.formatMessage({
            id: ETranslations.perp_token_info_not_found__msg,
          }),
        );
      }

      const book =
        await backgroundApiProxy.serviceHyperliquid.fetchL2BookByCoin({
          coin: order.coin,
        });
      const bid = book?.levels[0]?.[0]?.px;
      const ask = book?.levels[1]?.[0]?.px;
      const nextPrice =
        bid && ask
          ? resolveBboOrderPrice({
              bid,
              ask,
              side: order.side === 'B' ? 'long' : 'short',
              type: 'counterparty',
              offsetTicks: 0,
              szDecimals,
            })
          : null;
      if (!nextPrice) {
        throw new OneKeyLocalError(
          intl.formatMessage({
            id: ETranslations.current_best_price_unavailable__msg,
          }),
        );
      }

      return {
        price: nextPrice.toFixed(),
        szDecimals,
      };
    },
    [intl],
  );

  const handleChaseOrder = useCallback(
    async (order: IPerpsFrontendOrder, preparedTargetPrice?: string) => {
      if (
        !canMutateScopedOrders ||
        !canChasePerpsOrder(order) ||
        isChasingOrder(order.oid)
      ) {
        return;
      }

      const requestAccountAddress = normalizePerpsAccountAddress(
        currentUser?.accountAddress,
      );
      const requestScopedAddress =
        normalizePerpsAccountAddress(accountScopedAddress);
      if (
        !requestAccountAddress ||
        requestAccountAddress !== requestScopedAddress
      ) {
        return;
      }

      await runChasingOrderTask(order.oid, async () => {
        try {
          await ensureTradingEnabled();
          const targetPrice =
            preparedTargetPrice ?? (await resolveChaseTargetPrice(order)).price;

          const latestAccountAddress = normalizePerpsAccountAddress(
            activeAccountAddressRef.current,
          );
          const latestScopedAddress = normalizePerpsAccountAddress(
            scopedAccountAddressRef.current,
          );
          if (
            latestAccountAddress !== requestAccountAddress ||
            latestScopedAddress !== requestScopedAddress ||
            latestAccountAddress !== latestScopedAddress
          ) {
            throw new OneKeyLocalError(
              intl.formatMessage({
                id: ETranslations.active_trading_account_changed__msg,
              }),
            );
          }

          await actions.current
            .chaseOrder({
              coin: order.coin,
              oid: order.oid,
              newPrice: targetPrice,
              expectedAccountAddress: requestAccountAddress,
            })
            .catch(() => undefined);
        } catch (error) {
          Toast.error({
            title:
              error instanceof Error
                ? error.message
                : intl.formatMessage({
                    id: ETranslations.perp_toast_modifying_order,
                  }),
          });
        }
      });
    },
    [
      accountScopedAddress,
      actions,
      canMutateScopedOrders,
      currentUser?.accountAddress,
      ensureTradingEnabled,
      intl,
      isChasingOrder,
      resolveChaseTargetPrice,
      runChasingOrderTask,
    ],
  );

  const handleChaseOrderPress = useCallback(
    async (order: IPerpsFrontendOrder) => {
      if (perpsCustomSettings.skipOrderConfirm) {
        await handleChaseOrder(order);
        return;
      }

      if (
        !canMutateScopedOrders ||
        !canChasePerpsOrder(order) ||
        isChasingOrder(order.oid)
      ) {
        return;
      }

      const requestAccountAddress = normalizePerpsAccountAddress(
        currentUser?.accountAddress,
      );
      const requestScopedAddress =
        normalizePerpsAccountAddress(accountScopedAddress);
      if (
        !requestAccountAddress ||
        requestAccountAddress !== requestScopedAddress
      ) {
        return;
      }

      await runChasingOrderTask(order.oid, async () => {
        try {
          const { price, szDecimals } = await resolveChaseTargetPrice(order);
          const latestAccountAddress = normalizePerpsAccountAddress(
            activeAccountAddressRef.current,
          );
          const latestScopedAddress = normalizePerpsAccountAddress(
            scopedAccountAddressRef.current,
          );
          if (
            latestAccountAddress !== requestAccountAddress ||
            latestScopedAddress !== requestScopedAddress ||
            latestAccountAddress !== latestScopedAddress
          ) {
            throw new OneKeyLocalError(
              intl.formatMessage({
                id: ETranslations.active_trading_account_changed__msg,
              }),
            );
          }
          showChaseOrderConfirmDialog({
            order,
            targetPrice: price,
            szDecimals,
            intl,
            onConfirm: () => handleChaseOrder(order, price),
          });
        } catch (error) {
          Toast.error({
            title:
              error instanceof Error
                ? error.message
                : intl.formatMessage({
                    id: ETranslations.perp_toast_modifying_order,
                  }),
          });
        }
      });
    },
    [
      accountScopedAddress,
      canMutateScopedOrders,
      currentUser?.accountAddress,
      handleChaseOrder,
      intl,
      isChasingOrder,
      perpsCustomSettings.skipOrderConfirm,
      resolveChaseTargetPrice,
      runChasingOrderTask,
    ],
  );

  return {
    canMutateScopedOrders,
    chasingOrderIds,
    handleCancelOrder,
    handleCancelTwapOrder,
    handleChaseOrderPress,
  };
}
