import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  type IPerpsActiveTwapOrder,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { useGetBboForOrderPrice } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import type { IPerpsL2BookWorkerTiming } from '@onekeyhq/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquid';
import {
  usePerpsActiveAccountAtom,
  usePerpsCustomSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  normalizePerpsAccountAddress,
  resolveBboOrderPrice,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import {
  type IServerTimeBounds,
  getLocalMonotonicTimeMs,
} from '@onekeyhq/shared/src/utils/systemTimeUtils';
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

function getDeliveryElapsedBounds({
  sampledAt,
  requestedAt,
  receivedAt,
  workerTiming,
}: {
  sampledAt: number | undefined;
  requestedAt: number;
  receivedAt: number;
  workerTiming: IPerpsL2BookWorkerTiming | undefined;
}) {
  if (receivedAt < requestedAt) {
    return undefined;
  }

  if (platformEnv.isExtension) {
    if (!workerTiming) {
      return undefined;
    }
    // The worker's processing is nested within this RPC. Durations from this
    // reply bound delivery without treating separate worker and UI origins alike.
    const { beforeSampleMs, afterSampleMs } = workerTiming;
    const longestElapsed = receivedAt - requestedAt - beforeSampleMs;
    if (
      !Number.isFinite(beforeSampleMs) ||
      !Number.isFinite(afterSampleMs) ||
      beforeSampleMs < 0 ||
      afterSampleMs < 0 ||
      longestElapsed < afterSampleMs - 1
    ) {
      return undefined;
    }
    return {
      min: afterSampleMs,
      max: Math.max(afterSampleMs, longestElapsed),
    };
  }

  if (
    sampledAt === undefined ||
    !Number.isFinite(sampledAt) ||
    sampledAt < requestedAt - 1 ||
    sampledAt > receivedAt + 1
  ) {
    return undefined;
  }
  const elapsed = receivedAt - sampledAt;
  return { min: elapsed, max: elapsed };
}

function getRestChaseQuoteAgeAtReceipt({
  bookTime,
  clock,
  workerTiming,
  requestedAt,
  receivedAt,
  receivedAtWallTime,
}: {
  bookTime: number;
  clock: IServerTimeBounds | undefined;
  workerTiming: IPerpsL2BookWorkerTiming | undefined;
  requestedAt: number;
  receivedAt: number;
  receivedAtWallTime: number;
}): number | undefined {
  if (!clock) {
    return undefined;
  }

  const { earliestMs, latestMs, localTimeMs, localMonotonicTimeMs } = clock;
  if (
    !Number.isSafeInteger(bookTime) ||
    bookTime <= 0 ||
    !Number.isSafeInteger(earliestMs) ||
    !Number.isSafeInteger(latestMs) ||
    earliestMs <= 0 ||
    earliestMs > latestMs ||
    !Number.isSafeInteger(localTimeMs)
  ) {
    return undefined;
  }

  // Compare both clocks over the same segment. Time before the sample is
  // outside the quote window and cannot cancel a discontinuity after it.
  const elapsedBounds = getDeliveryElapsedBounds({
    sampledAt: localMonotonicTimeMs,
    requestedAt,
    receivedAt,
    workerTiming,
  });
  const wallElapsed = receivedAtWallTime - localTimeMs;
  if (
    !elapsedBounds ||
    !(
      wallElapsed >= elapsedBounds.min - 1000 &&
      wallElapsed <= elapsedBounds.max + 1000
    )
  ) {
    return undefined;
  }
  // Round outwards to allow for millisecond clock precision at either end.
  const longestElapsed = Math.max(
    0,
    Math.ceil(Math.max(elapsedBounds.max, wallElapsed) + 1),
  );
  const shortestElapsed = Math.max(
    0,
    Math.floor(Math.min(elapsedBounds.min, wallElapsed) - 1),
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
    const now = getLocalMonotonicTimeMs();
    if (now === undefined) {
      return false;
    }
    const elapsedMs = Math.max(
      now - quote.receivedAt,
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

      const requestedAt = getLocalMonotonicTimeMs();
      if (requestedAt === undefined) {
        throw getChasePriceUnavailableError(intl);
      }
      const book = await backgroundApiProxy.serviceHyperliquid
        .fetchL2BookByCoin({ coin: order.coin, includeServerTime: true })
        .catch(() => null);
      const receivedAt = getLocalMonotonicTimeMs();
      const receivedAtWallTime = Date.now();
      const ageAtReceiptMs =
        book && receivedAt !== undefined
          ? getRestChaseQuoteAgeAtReceipt({
              bookTime: book.time,
              clock: book.serverTimeBounds,
              workerTiming: book.workerTiming,
              requestedAt,
              receivedAt,
              receivedAtWallTime,
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
        receivedAt === undefined ||
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
