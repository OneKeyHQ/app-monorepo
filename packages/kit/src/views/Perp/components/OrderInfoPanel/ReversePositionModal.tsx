import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Divider,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatLocalizedNumberString } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  estimateLiquidationPrice,
  formatPriceToSignificantDigits,
  getValidPerpsPrice,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useEnsureTradingEnabled } from '../../hooks/useEnableTradingWithDepositFallback';
import { usePerpsAccountScopedActivePositions } from '../../hooks/usePerpsAccountScopedActivePositions';
import { usePerpsAssetCtx } from '../../hooks/usePerpsAssetCtx';
import { usePerpsCrossAvailableAfterMaintenance } from '../../hooks/usePerpsCrossAvailableAfterMaintenance';
import { usePerpsMidPrice } from '../../hooks/usePerpsMidPrice';
import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';
import { PerpTestIDs } from '../../testIDs';
import { getTradingSideTextColor } from '../../utils/styleUtils';
import { PERP_DIALOG_BUTTON_SIZE } from '../PerpDialogLayout';
import { TradingGuardWrapper } from '../TradingGuardWrapper';

import {
  computeAddPositionMaxSize,
  isAddPositionAssetDataScoped,
} from './utils/addPosition';
import {
  buildReversePositionOrder,
  getReversePositionClearingPrice,
  getReversePositionSize,
  isReversePositionScopeValid,
} from './utils/reversePosition';

import type { IReversePositionSnapshot } from './utils/reversePosition';

export function ReversePositionContent({
  snapshot,
  onClose,
  onSubmittingChange,
}: {
  snapshot: IReversePositionSnapshot;
  onClose: () => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}) {
  const intl = useIntl();
  const actions = useHyperliquidActions();
  const ensureTradingEnabled = useEnsureTradingEnabled();
  const [activeAccount] = usePerpsActiveAccountAtom();
  const positions = usePerpsAccountScopedActivePositions();
  const position = positions.find(
    (item) => item.position.coin === snapshot.coin,
  )?.position;
  const liveScopeRef = useRef({
    accountAddress: activeAccount.accountAddress,
    position,
  });
  liveScopeRef.current = {
    accountAddress: activeAccount.accountAddress,
    position,
  };
  const mountedRef = useRef(true);
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchTarget = useCallback(async () => {
    const [assetData, symbolMeta, price] = await Promise.all([
      backgroundApiProxy.serviceHyperliquid.getActiveAssetDataByCoin({
        coin: snapshot.coin,
        user: snapshot.accountAddress as IHex,
      }),
      backgroundApiProxy.serviceHyperliquid.getSymbolMeta({
        coin: snapshot.coin,
      }),
      backgroundApiProxy.serviceHyperliquid.getMarketOrderReferencePrice(
        snapshot.coin,
      ),
    ]);
    const referencePrice = getValidPerpsPrice(price);
    if (
      !isAddPositionAssetDataScoped({
        data: assetData,
        coin: snapshot.coin,
        accountAddress: snapshot.accountAddress,
      }) ||
      !symbolMeta ||
      symbolMeta.isSpot ||
      symbolMeta.coin !== snapshot.coin ||
      symbolMeta.universe?.szDecimals === undefined ||
      !referencePrice
    ) {
      throw new OneKeyLocalError(
        intl.formatMessage({
          id: ETranslations.target_market_data_changed__msg,
        }),
      );
    }
    return { assetData, symbolMeta, price: referencePrice };
  }, [intl, snapshot.accountAddress, snapshot.coin]);
  const {
    result: symbolMeta,
    isLoading,
    run,
  } = usePromiseResult(
    async () => {
      const meta = await backgroundApiProxy.serviceHyperliquid.getSymbolMeta({
        coin: snapshot.coin,
      });
      return meta?.coin === snapshot.coin && !meta.isSpot ? meta : undefined;
    },
    [snapshot.coin],
    { watchLoading: true, checkIsFocused: false, undefinedResultIfError: true },
  );
  const { result: book } = usePromiseResult(
    async () => {
      const cached =
        await backgroundApiProxy.serviceHyperliquid.getL2BookSnapshotCache({
          coin: snapshot.coin,
        });
      if (
        cached?.coin === snapshot.coin &&
        Math.abs(Date.now() - cached.time) <=
          PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS
      )
        return cached;
      return backgroundApiProxy.serviceHyperliquid.fetchL2BookByCoin({
        coin: snapshot.coin,
      });
    },
    [snapshot.coin],
    {
      pollingInterval: PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS,
      checkIsFocused: false,
      undefinedResultIfError: true,
      undefinedResultIfReRun: true,
    },
  );
  const szDecimals = symbolMeta?.universe?.szDecimals;
  const { mid } = usePerpsMidPrice({ coin: snapshot.coin, szDecimals });
  const { assetCtx } = usePerpsAssetCtx({ assetId: symbolMeta?.assetId ?? -1 });
  // Preview uses coin-scoped streaming data. Account limits are fetched again
  // on submit, so a slow activeAssetData request cannot block the preview.
  const referencePrice = getValidPerpsPrice(mid);
  const markPrice = symbolMeta
    ? getValidPerpsPrice(assetCtx.markPrice)
    : undefined;
  const isScopeValid = isReversePositionScopeValid({
    snapshot,
    ...liveScopeRef.current,
  });
  const size =
    szDecimals === undefined
      ? null
      : getReversePositionSize(snapshot.positionSize, szDecimals)?.abs();
  const isBuy = new BigNumber(snapshot.positionSize).lt(0);
  const side = isBuy ? 'long' : 'short';
  const symbol = parseDexCoin(snapshot.coin).displayName;
  const crossAvailableAfterMaintenance = usePerpsCrossAvailableAfterMaintenance(
    snapshot.coin,
  );
  const liquidationPrice = useMemo(() => {
    if (!symbolMeta || !markPrice || !position || !isScopeValid || !size)
      return null;
    const estimatedClearingPrice =
      referencePrice && szDecimals !== undefined
        ? getReversePositionClearingPrice({
            coin: snapshot.coin,
            book,
            referencePrice,
            positionSize: isBuy ? size.negated() : size,
            szDecimals,
          })
        : null;
    if (!estimatedClearingPrice) return null;
    return estimateLiquidationPrice({
      estimatedClearingPrice,
      side,
      orderSize: size.multipliedBy(2),
      priceMode: 'market',
      markPrice: new BigNumber(markPrice),
      marginMode: position.leverage.type,
      leverage: position.leverage.value,
      marginTiers: symbolMeta.marginTable?.marginTiers,
      maxLeverage: symbolMeta.universe?.maxLeverage ?? 1,
      existingPositionSize: new BigNumber(position.szi),
      isolatedRawUsd:
        position.leverage.type === 'isolated'
          ? new BigNumber(position.leverage.rawUsd)
          : undefined,
      crossAvailableAfterMaintenance,
    });
  }, [
    book,
    referencePrice,
    szDecimals,
    snapshot.coin,
    isBuy,
    crossAvailableAfterMaintenance,
    isScopeValid,
    position,
    side,
    size,
    markPrice,
    symbolMeta,
  ]);

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    onSubmittingChange?.(true);
    setIsSubmitting(true);
    let submitted = false;
    try {
      const assertScope = () => {
        if (
          !isReversePositionScopeValid({ snapshot, ...liveScopeRef.current })
        ) {
          throw new OneKeyLocalError(
            intl.formatMessage({
              id: ETranslations.position_or_account_changed__msg,
            }),
          );
        }
      };
      assertScope();
      await ensureTradingEnabled();
      if (!mountedRef.current) return;
      assertScope();
      const latest = await fetchTarget();
      if (!mountedRef.current) return;
      assertScope();
      const order = buildReversePositionOrder({
        snapshot,
        price: latest.price,
        szDecimals: latest.symbolMeta.universe?.szDecimals ?? 0,
        maxSize: computeAddPositionMaxSize({
          isBuy,
          orderType: 'market',
          limitPrice: '',
          markPrice: latest.assetData.markPx,
          maxTradeSzs: latest.assetData.maxTradeSzs,
          leverage: latest.assetData.leverage.value,
          szDecimals: latest.symbolMeta.universe?.szDecimals,
        }),
      });
      if (order.error) {
        const title =
          order.error === 'minimumOrder'
            ? intl.formatMessage(
                { id: ETranslations.perp_size_least },
                { amount: '$10' },
              )
            : intl.formatMessage({
                id:
                  order.error === 'insufficientMargin'
                    ? ETranslations.perp_insufficient_margin__title
                    : ETranslations.target_market_data_changed__msg,
              });
        Toast.error({ title });
        return;
      }
      try {
        await actions.current.placeOrderByCoin(order.params);
        submitted = true;
      } catch {
        // The shared order action already reports exchange failures.
      }
    } catch (error) {
      Toast.error({
        title:
          error instanceof Error
            ? error.message
            : intl.formatMessage({
                id: ETranslations.target_market_data_changed__msg,
              }),
      });
    } finally {
      // Allow closing, but keep successful submissions locked through exit.
      onSubmittingChange?.(false);
      if (!submitted) {
        submittingRef.current = false;
        if (mountedRef.current) setIsSubmitting(false);
      }
    }
    if (submitted) onClose();
  }, [
    actions,
    ensureTradingEnabled,
    fetchTarget,
    intl,
    isBuy,
    onClose,
    onSubmittingChange,
    snapshot,
  ]);

  const formattedSize = size
    ? `${formatLocalizedNumberString(size.toFixed())} ${symbol}`
    : '--';
  const currentSideLabel = intl.formatMessage({
    id: isBuy ? ETranslations.perp_short : ETranslations.perp_long,
  });
  const nextSideLabel = intl.formatMessage({
    id: isBuy ? ETranslations.perp_long : ETranslations.perp_short,
  });
  const rows = [
    {
      label: intl.formatMessage({
        id: ETranslations.perp_market_order_size__title,
      }),
      value: size
        ? `${intl.formatMessage({ id: isBuy ? ETranslations.global_buy : ETranslations.global_sell })} ${formatLocalizedNumberString(size.multipliedBy(2).toFixed())} ${symbol}`
        : '--',
    },
    {
      label: intl.formatMessage({
        id: ETranslations.global_price,
      }),
      value: intl.formatMessage({ id: ETranslations.perp_market_price }),
    },
    {
      label: intl.formatMessage({ id: ETranslations.perp_est_liq_price }),
      value: liquidationPrice?.gt(0)
        ? `$${formatLocalizedNumberString(formatPriceToSignificantDigits(liquidationPrice.toFixed(), szDecimals))}`
        : '--',
    },
  ];
  return (
    <YStack gap="$5" testID={PerpTestIDs.ReversePositionDialog}>
      <YStack bg="$bgStrong" borderRadius="$3" overflow="hidden">
        <XStack
          p="$4"
          gap="$3"
          justifyContent="space-between"
          alignItems="center"
        >
          <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
            {intl.formatMessage({
              id: ETranslations.perp_trade_current_position,
            })}
          </SizableText>
          <SizableText
            size="$bodyMdMedium"
            color={getTradingSideTextColor(isBuy ? 'short' : 'long')}
            textAlign="right"
            flexShrink={1}
          >
            {`${currentSideLabel} ${formattedSize}`}
          </SizableText>
        </XStack>
        <Divider borderColor="$bg" />
        <XStack
          p="$4"
          gap="$3"
          justifyContent="space-between"
          alignItems="center"
        >
          <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
            {intl.formatMessage({
              id: ETranslations.perp_position_after_reversal__title,
            })}
          </SizableText>
          <SizableText
            size="$bodyMdMedium"
            color={getTradingSideTextColor(side)}
            textAlign="right"
            flexShrink={1}
          >
            {`${nextSideLabel} ${formattedSize}`}
          </SizableText>
        </XStack>
      </YStack>
      <YStack gap="$4">
        {rows.map((row) => (
          <XStack
            key={row.label}
            gap="$3"
            justifyContent="space-between"
            alignItems="center"
          >
            <SizableText size="$bodyMd" color="$textSubdued" flexShrink={1}>
              {row.label}
            </SizableText>
            <SizableText size="$bodyMdMedium" textAlign="right" flexShrink={1}>
              {row.value}
            </SizableText>
          </XStack>
        ))}
      </YStack>
      <SizableText size="$bodySm" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.perp_reverse_position__desc })}
      </SizableText>
      {!isScopeValid ? (
        <SizableText size="$bodySm" color="$textCritical">
          {intl.formatMessage({
            id: ETranslations.position_or_account_changed__msg,
          })}
        </SizableText>
      ) : null}
      {!symbolMeta && !isLoading ? (
        <Button
          testID="perp-reverse-position-retry-button"
          onPress={() => void run()}
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      ) : null}
      <YStack>
        <TradingGuardWrapper
          buttonSize={PERP_DIALOG_BUTTON_SIZE}
          disabled={!isScopeValid || isSubmitting}
        >
          <Button
            testID={PerpTestIDs.ReversePositionConfirmButton}
            size={PERP_DIALOG_BUTTON_SIZE}
            variant="primary"
            disabled={
              !symbolMeta ||
              !referencePrice ||
              !size ||
              !isScopeValid ||
              isSubmitting
            }
            loading={isSubmitting}
            onPress={handleSubmit}
          >
            {intl.formatMessage({
              id: ETranslations.perp_confirm_reversal__action,
            })}
          </Button>
        </TradingGuardWrapper>
      </YStack>
    </YStack>
  );
}

export function showReversePositionDialog(
  snapshot: IReversePositionSnapshot,
  title: string,
) {
  let isSubmitting = false;
  const dialog = Dialog.show({
    title,
    disableDrag: true,
    showFooter: false,
    onBeforeClose: () => !isSubmitting,
    renderContent: (
      <PerpsAccountSelectorProviderMirror>
        <PerpsProviderMirror>
          <ReversePositionContent
            snapshot={snapshot}
            onClose={() => dialog.close()}
            onSubmittingChange={(value) => {
              isSubmitting = value;
            }}
          />
        </PerpsProviderMirror>
      </PerpsAccountSelectorProviderMirror>
    ),
  });
  return dialog;
}
