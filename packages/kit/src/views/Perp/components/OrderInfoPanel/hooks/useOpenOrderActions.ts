import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  type IPerpsActiveTwapOrder,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { useGetBboForOrderPrice } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  usePerpsActiveAccountAtom,
  usePerpsCustomSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  normalizePerpsAccountAddress,
  resolveBboOrderPrice,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IServerTimeBounds } from '@onekeyhq/shared/src/utils/systemTimeUtils';
import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IPerpsTradingUiMode } from '@onekeyhq/shared/types/hyperliquid/types';

import { useEnsureTradingEnabled } from '../../../hooks/useEnableTradingWithDepositFallback';
import { getCurrentPerpsMarketDataFreshness } from '../../../hooks/usePerpsMarketDataFreshness';
import { isPerpsAccountAddressMatched } from '../../../utils/accountScopedData';
import { isPerpsL2BookInteractive } from '../../../utils/l2BookFreshness';
import {
  type IChaseOrderQuote,
  resolveLiveChaseOrderQuote,
  showChaseOrderConfirmDialog,
} from '../ChaseOrderConfirmModal';
import { canChasePerpsOrder } from '../utils';

import { useChasingOrderTask } from './useChasingOrderTask';

import type { IntlShape } from 'react-intl';

function getRestChaseQuoteAgeAtReceipt({
  bookTime,
  clock,
  requestedAtWallTime,
  receivedAtWallTime,
  monotonicElapsed,
}: {
  bookTime: number;
  clock: IServerTimeBounds | undefined;
  requestedAtWallTime: number;
  receivedAtWallTime: number;
  monotonicElapsed: number;
}): number | undefined {
  if (!clock) {
    return undefined;
  }

  const { earliestMs, latestMs, localTimeMs } = clock;
  const wallElapsed = receivedAtWallTime - requestedAtWallTime;
  const clockDelta = monotonicElapsed - wallElapsed;
  if (
    !Number.isSafeInteger(bookTime) ||
    bookTime <= 0 ||
    !Number.isSafeInteger(earliestMs) ||
    !Number.isSafeInteger(latestMs) ||
    earliestMs <= 0 ||
    earliestMs > latestMs ||
    !Number.isSafeInteger(localTimeMs) ||
    localTimeMs < requestedAtWallTime ||
    localTimeMs > receivedAtWallTime ||
    monotonicElapsed < 0 ||
    !(Math.abs(clockDelta) <= 1000)
  ) {
    return undefined;
  }

  // The shared wall clock lets us exclude clock recovery and outbound IPC.
  const elapsedSinceSample = receivedAtWallTime - localTimeMs;
  const longestElapsed =
    elapsedSinceSample + Math.ceil(Math.max(0, clockDelta));
  const shortestElapsed = Math.max(
    0,
    elapsedSinceSample - Math.ceil(Math.max(0, -clockDelta)),
  );
  const latestAtReceipt = latestMs + longestElapsed;
  const oldestAge = latestAtReceipt - bookTime;
  if (
    !Number.isSafeInteger(latestAtReceipt) ||
    longestElapsed > PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS ||
    oldestAge > PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS ||
    bookTime - (earliestMs + shortestElapsed) >
      PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS
  ) {
    return undefined;
  }
  return Math.max(0, oldestAge);
}

function isChaseOrderQuoteFresh(quote: IChaseOrderQuote) {
  if (quote.source === 'rest') {
    const elapsedMs = Math.max(
      performance.now() - quote.receivedAt,
      Date.now() - quote.receivedAtWallTime,
    );
    return (
      elapsedMs >= 0 &&
      quote.ageAtReceiptMs + elapsedMs <= PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS
    );
  }
  return (
    isPerpsL2BookInteractive({
      bookTime: quote.time,
      bookReceivedAt: quote.localReceivedAt,
    }) && getCurrentPerpsMarketDataFreshness().isReady
  );
}

function getChasePriceUnavailableError(intl: IntlShape) {
  return new OneKeyLocalError(
    intl.formatMessage({
      id: ETranslations.current_best_price_unavailable__msg,
    }),
  );
}

export function useOpenOrderActions(
  accountScopedAddress?: string | null,
  tradingUiMode: IPerpsTradingUiMode = 'pro',
) {
  const intl = useIntl();
  const [currentUser] = usePerpsActiveAccountAtom();
  const [perpsCustomSettings] = usePerpsCustomSettingsAtom();
  const actions = useHyperliquidActions();
  const getBbo = useGetBboForOrderPrice();
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
            tradingUiMode,
            expectedAccountAddress: accountScopedAddress ?? undefined,
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
    [
      tradingUiMode,
      accountScopedAddress,
      actions,
      assertCurrentAccount,
      ensureTradingEnabled,
      intl,
    ],
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
            expectedAccountAddress: accountScopedAddress ?? undefined,
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
    [
      accountScopedAddress,
      actions,
      assertCurrentAccount,
      ensureTradingEnabled,
      intl,
    ],
  );

  const resolveChaseTargetQuote = useCallback(
    async (
      order: IPerpsFrontendOrder,
      previousQuote?: IChaseOrderQuote,
    ): Promise<{ quote: IChaseOrderQuote; szDecimals: number }> => {
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

      if (getCurrentPerpsMarketDataFreshness().isReady) {
        const quote = resolveLiveChaseOrderQuote({
          bbo: getBbo(),
          order,
          szDecimals,
          minBboTime: previousQuote?.time,
        });
        if (quote && (!previousQuote || quote.time > previousQuote.time)) {
          return { quote, szDecimals };
        }
      }

      const requestedAt = performance.now();
      const requestedAtWallTime = Date.now();
      const book = await backgroundApiProxy.serviceHyperliquid
        .fetchL2BookByCoin({ coin: order.coin, includeServerTime: true })
        .catch(() => null);
      const receivedAt = performance.now();
      const receivedAtWallTime = Date.now();
      const ageAtReceiptMs = book
        ? getRestChaseQuoteAgeAtReceipt({
            bookTime: book.time,
            clock: book.serverTimeBounds,
            requestedAtWallTime,
            receivedAtWallTime,
            monotonicElapsed: receivedAt - requestedAt,
          })
        : undefined;
      const bid = book?.levels[0]?.[0]?.px;
      const ask = book?.levels[1]?.[0]?.px;
      const nextPrice =
        bid && ask
          ? resolveBboOrderPrice({
              bid,
              ask,
              side: order.side === 'B' ? 'long' : 'short',
              type: 'queue',
              offsetTicks: 0,
              szDecimals,
            })
          : null;
      if (
        !book ||
        !nextPrice ||
        ageAtReceiptMs === undefined ||
        (previousQuote && book.time <= previousQuote.time)
      ) {
        throw getChasePriceUnavailableError(intl);
      }

      return {
        quote: {
          price: nextPrice.toFixed(),
          time: book.time,
          source: 'rest',
          receivedAt,
          receivedAtWallTime,
          ageAtReceiptMs,
        },
        szDecimals,
      };
    },
    [getBbo, intl],
  );

  const handleChaseOrder = useCallback(
    async (
      order: IPerpsFrontendOrder,
      confirmation?: {
        quote: IChaseOrderQuote;
        updateQuote: (quote: IChaseOrderQuote) => void;
      },
    ) => {
      if (
        !canMutateScopedOrders ||
        !canChasePerpsOrder(order) ||
        isChasingOrder(order.oid)
      ) {
        return false;
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
        return false;
      }

      let keepConfirmOpen = false;
      const started = await runChasingOrderTask(order.oid, async () => {
        try {
          assertCurrentAccount();
          const quote =
            confirmation?.quote ?? (await resolveChaseTargetQuote(order)).quote;
          const needsRefresh = !isChaseOrderQuoteFresh(quote);
          if (!needsRefresh) {
            assertCurrentAccount();
            await ensureTradingEnabled();
            assertCurrentAccount();
          }

          if (needsRefresh || !isChaseOrderQuoteFresh(quote)) {
            if (!confirmation) {
              throw getChasePriceUnavailableError(intl);
            }
            keepConfirmOpen = true;
            const refreshed = await resolveChaseTargetQuote(order, quote);
            assertCurrentAccount();
            confirmation.updateQuote(refreshed.quote);
            return;
          }

          await actions.current
            .chaseOrder({
              tradingUiMode,
              coin: order.coin,
              oid: order.oid,
              newPrice: quote.price,
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
      return started && !keepConfirmOpen;
    },
    [
      tradingUiMode,
      accountScopedAddress,
      actions,
      assertCurrentAccount,
      canMutateScopedOrders,
      currentUser?.accountAddress,
      ensureTradingEnabled,
      intl,
      isChasingOrder,
      resolveChaseTargetQuote,
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
          const { quote, szDecimals } = await resolveChaseTargetQuote(order);
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
            targetQuote: quote,
            szDecimals,
            intl,
            onConfirm: (renderedQuote, updateQuote) =>
              handleChaseOrder(order, { quote: renderedQuote, updateQuote }),
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
      resolveChaseTargetQuote,
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
