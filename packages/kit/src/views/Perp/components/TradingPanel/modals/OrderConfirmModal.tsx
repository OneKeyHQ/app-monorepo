import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useActiveTradeInstrumentAtom,
  useTradingFormAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAccountAtom,
  usePerpsCustomSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  formatPriceToSignificantDigits,
  formatSpotPriceToValid,
  getSpotTokenDisplayName,
  inferTpsl,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import { ETriggerOrderType } from '@onekeyhq/shared/types/hyperliquid/types';

import { useOrderConfirm, useTradingCalculationsForSide } from '../../../hooks';
import { useTradingPrice } from '../../../hooks/useTradingPrice';
import { PerpsProviderMirror } from '../../../PerpsProviderMirror';
import {
  GetTradingButtonStyleProps,
  getTradingSideTextColor,
} from '../../../utils/styleUtils';
import { PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS } from '../../PerpDialogLayout';
import { TradingGuardWrapper } from '../../TradingGuardWrapper';
import { LiquidationPriceDisplay } from '../components/LiquidationPriceDisplay';

import type { IEnableTradingWithDepositFallbackResult } from '../../../hooks/useEnableTradingWithDepositFallback';
import type { IntlShape } from 'react-intl';

const SAVED_FEE_BENCHMARK_RATE = 0.0004;

function formatOrderPriceDisplay({
  price,
  isSpot,
  szDecimals,
}: {
  price: string;
  isSpot: boolean;
  szDecimals: number;
}) {
  const formattedPrice = isSpot
    ? formatSpotPriceToValid(price, szDecimals)
    : formatPriceToSignificantDigits(price, szDecimals);
  return `$${formattedPrice}`;
}

interface IOrderConfirmContentProps {
  onClose?: () => void;
  overrideSide?: 'long' | 'short';
  enableTradingBeforeConfirm?: (
    context: IOrderConfirmEnableTradingBeforeConfirmContext,
  ) => Promise<IEnableTradingWithDepositFallbackResult>;
  enableTradingAccountKey?: string;
}

type IOrderConfirmAccountForKey = {
  accountId?: string | null;
  indexedAccountId?: string | null;
  accountAddress?: string | null;
};

interface IOrderConfirmEnableTradingBeforeConfirmContext {
  closeDialog: () => void;
  shouldIgnoreResult: () => boolean;
}

function getOrderConfirmAccountKey(account: IOrderConfirmAccountForKey) {
  const accountId = account.accountId ?? account.indexedAccountId;
  if (!accountId && !account.accountAddress) {
    return undefined;
  }
  return `${accountId ?? ''}:${account.accountAddress ?? ''}`;
}

function OrderConfirmContent({
  onClose,
  overrideSide,
  enableTradingBeforeConfirm,
  enableTradingAccountKey,
}: IOrderConfirmContentProps) {
  const [isPreparingEnableTrading, setIsPreparingEnableTrading] =
    useState(false);
  const [perpsAccount] = usePerpsActiveAccountAtom();
  const currentAccountKey = useMemo(
    () => getOrderConfirmAccountKey(perpsAccount),
    [perpsAccount],
  );
  const currentAccountKeyRef = useRef(currentAccountKey);
  const isDialogClosedRef = useRef(false);
  const closeDialog = useCallback(() => {
    isDialogClosedRef.current = true;
    onClose?.();
  }, [onClose]);
  const shouldIgnoreEnableTradingResult = useCallback(() => {
    return Boolean(
      isDialogClosedRef.current ||
      (enableTradingAccountKey &&
        currentAccountKeyRef.current !== enableTradingAccountKey),
    );
  }, [enableTradingAccountKey]);

  useEffect(() => {
    currentAccountKeyRef.current = currentAccountKey;
  }, [currentAccountKey]);

  useEffect(
    () => () => {
      isDialogClosedRef.current = true;
    },
    [],
  );

  const { isSubmitting, handleConfirm: confirmOrder } = useOrderConfirm({
    onSuccess: () => {
      closeDialog();
    },
    onError: () => {
      closeDialog();
    },
  });
  const [perpsCustomSettings, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();
  const [formData] = useTradingFormAtom();
  const [activeInstrument] = useActiveTradeInstrumentAtom();
  const isSpot = activeInstrument.mode === 'spot';
  const effectiveSide = overrideSide || formData.side;
  const { computedSizeForSide, orderValue } =
    useTradingCalculationsForSide(effectiveSide);
  const szDecimals =
    activeInstrument.mode === 'spot'
      ? (activeInstrument.universe?.baseSzDecimals ?? 2)
      : (activeInstrument.universe?.szDecimals ?? 2);
  const actionColor = getTradingSideTextColor(effectiveSide);

  const [onekeyFee, setOnekeyFee] = useState<number | undefined>(undefined);
  useEffect(() => {
    void backgroundApiProxy.simpleDb.perp
      .getExpectMaxBuilderFee()
      .then((fee) => {
        setOnekeyFee(fee ?? 0);
      });
  }, []);
  const buttonStyleProps = GetTradingButtonStyleProps(effectiveSide, false);
  const intl = useIntl();

  const isTriggerMode = formData.orderMode === 'trigger';
  const isLimitTrigger =
    formData.triggerOrderType === ETriggerOrderType.TRIGGER_LIMIT;

  const { midPriceBN } = useTradingPrice();

  const triggerTypeLabel = useMemo(() => {
    if (!isTriggerMode) return null;
    switch (formData.triggerOrderType) {
      case ETriggerOrderType.TRIGGER_MARKET:
        return intl.formatMessage({
          id: ETranslations.perp_order_trigger_market,
        });
      case ETriggerOrderType.TRIGGER_LIMIT:
        return intl.formatMessage({
          id: ETranslations.perp_order_trigger_limit,
        });
      default:
        return null;
    }
  }, [isTriggerMode, formData.triggerOrderType, intl]);

  const _inferredTpslBadge = useMemo(() => {
    if (!isTriggerMode || !formData.triggerPrice) return null;
    const triggerPriceBN = new BigNumber(formData.triggerPrice);
    if (
      !triggerPriceBN.isFinite() ||
      triggerPriceBN.lte(0) ||
      !midPriceBN.isFinite() ||
      midPriceBN.lte(0) ||
      triggerPriceBN.eq(midPriceBN)
    ) {
      return null;
    }
    const tpsl = inferTpsl({
      side: effectiveSide,
      triggerPrice: triggerPriceBN,
      currentPrice: midPriceBN,
    });
    if (tpsl === 'tp') {
      return intl.formatMessage({
        id:
          effectiveSide === 'long'
            ? ETranslations.perps_take_profit_buy
            : ETranslations.perps_take_profit_sell,
      });
    }
    return intl.formatMessage({
      id:
        effectiveSide === 'long'
          ? ETranslations.perps_stop_loss_buy
          : ETranslations.perps_stop_loss_sell,
    });
  }, [isTriggerMode, formData.triggerPrice, midPriceBN, effectiveSide, intl]);

  const actionText = isSpot
    ? intl.formatMessage({
        id:
          effectiveSide === 'long'
            ? ETranslations.dexmarket_details_transactions_buy
            : ETranslations.dexmarket_details_transactions_sell,
      })
    : intl.formatMessage({
        id:
          effectiveSide === 'long'
            ? ETranslations.perp_trade_long
            : ETranslations.perp_trade_short,
      });

  const sizeDisplay = useMemo(() => {
    const sizeString = computedSizeForSide.toFixed(szDecimals);
    if (activeInstrument?.coin) {
      // Spot coins use @N format, resolve to display name (e.g. HYPE)
      const coinDisplay =
        activeInstrument.mode === 'spot'
          ? getSpotTokenDisplayName(
              activeInstrument.universe?.baseName ?? activeInstrument.coin,
            )
          : parseDexCoin(activeInstrument.coin).displayName;
      return `${sizeString} ${coinDisplay}`;
    }
    return sizeString;
  }, [
    computedSizeForSide,
    szDecimals,
    activeInstrument?.coin,
    activeInstrument.mode,
    activeInstrument.universe,
  ]);

  const priceDisplay = useMemo(() => {
    if (formData.type === 'market' || !formData.price) {
      return (
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({
            id: ETranslations.perp_trade_market,
          })}
        </SizableText>
      );
    }

    if (formData.bboPriceMode) {
      const { type } = formData.bboPriceMode;
      const modeName = intl.formatMessage({
        id:
          type === 'counterparty'
            ? ETranslations.Perps_BBO_Counterparty
            : ETranslations.Perps_BBO_Queue,
      });

      return (
        <YStack alignItems="flex-end" gap="$1">
          <SizableText size="$bodyMdMedium">{modeName}</SizableText>
        </YStack>
      );
    }

    return (
      <SizableText size="$bodyMdMedium">
        {formatOrderPriceDisplay({
          price: formData.price,
          isSpot,
          szDecimals,
        })}
      </SizableText>
    );
  }, [
    formData.type,
    formData.price,
    formData.bboPriceMode,
    intl,
    isSpot,
    szDecimals,
  ]);

  const buttonText = useMemo(() => {
    if (isSubmitting) {
      return intl.formatMessage({
        id: ETranslations.perp_trading_button_placing,
      });
    }
    return intl.formatMessage({
      id: ETranslations.perp_confirm_order,
    });
  }, [isSubmitting, intl]);

  const setSkipOrderConfirm = useCallback(
    (value: boolean) => {
      setPerpsCustomSettings({
        ...perpsCustomSettings,
        skipOrderConfirm: value,
      });
    },
    [perpsCustomSettings, setPerpsCustomSettings],
  );

  const isConfirmLoading = isSubmitting || isPreparingEnableTrading;

  const handleConfirm = useCallback(async () => {
    if (isConfirmLoading) {
      return;
    }

    if (enableTradingBeforeConfirm) {
      if (shouldIgnoreEnableTradingResult()) {
        closeDialog();
        return;
      }

      let result: IEnableTradingWithDepositFallbackResult | undefined;
      setIsPreparingEnableTrading(true);
      try {
        result = await enableTradingBeforeConfirm({
          closeDialog,
          shouldIgnoreResult: shouldIgnoreEnableTradingResult,
        });
      } finally {
        if (!isDialogClosedRef.current) {
          setIsPreparingEnableTrading(false);
        }
      }

      if (shouldIgnoreEnableTradingResult()) {
        if (!isDialogClosedRef.current) {
          closeDialog();
        }
        return;
      }

      if (!result?.shouldContinue) {
        closeDialog();
        return;
      }
    }

    closeDialog();
    void confirmOrder(overrideSide);
  }, [
    closeDialog,
    confirmOrder,
    enableTradingBeforeConfirm,
    isConfirmLoading,
    overrideSide,
    shouldIgnoreEnableTradingResult,
  ]);

  const savedFeeDisplay = useMemo(() => {
    if (!orderValue.isFinite() || orderValue.lte(0)) {
      return undefined;
    }
    const savedFee = orderValue.multipliedBy(SAVED_FEE_BENCHMARK_RATE);
    if (savedFee.lt(0.01)) {
      return undefined;
    }
    const savedFeeStr = savedFee.toFixed(2, BigNumber.ROUND_HALF_UP);
    if (!Number.isFinite(Number(savedFeeStr)) || Number(savedFeeStr) <= 0) {
      return undefined;
    }
    return numberFormat(savedFeeStr, {
      formatter: 'value',
      formatterOptions: { currency: '$' },
    });
  }, [orderValue]);

  return (
    <YStack gap="$4" p="$1">
      {/* Order Details */}
      <YStack gap="$3">
        {/* Action */}
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_trade_order_type,
            })}
          </SizableText>
          {triggerTypeLabel ? (
            <SizableText size="$bodyMdMedium" color={actionColor}>
              {triggerTypeLabel}
              {' /'}{' '}
              {intl.formatMessage({
                id:
                  effectiveSide === 'long'
                    ? ETranslations.dexmarket_details_transactions_buy
                    : ETranslations.dexmarket_details_transactions_sell,
              })}
            </SizableText>
          ) : (
            <SizableText size="$bodyMdMedium" color={actionColor}>
              {actionText}
            </SizableText>
          )}
        </XStack>

        {/* Trigger Price (trigger orders only) */}
        {isTriggerMode && formData.triggerPrice ? (
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.dexmarket_pro_trigger_price,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {formatOrderPriceDisplay({
                price: formData.triggerPrice,
                isSpot,
                szDecimals,
              })}
            </SizableText>
          </XStack>
        ) : null}

        {/* Execution Price (limit trigger orders only) */}
        {isTriggerMode && isLimitTrigger && formData.executionPrice ? (
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perps_pro_execution_price,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {formatOrderPriceDisplay({
                price: formData.executionPrice,
                isSpot,
                szDecimals,
              })}
            </SizableText>
          </XStack>
        ) : null}

        {/* Reduce Only (trigger orders) */}
        {isTriggerMode ? (
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perps_reduce_only,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {formData.triggerReduceOnly ? 'Yes' : 'No'}
            </SizableText>
          </XStack>
        ) : null}

        {/* Position Size */}
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_position_position_size,
            })}
          </SizableText>
          <SizableText size="$bodyMdMedium">{sizeDisplay}</SizableText>
        </XStack>

        {/* Order Value */}
        {orderValue.isFinite() && orderValue.gt(0) ? (
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_trade_order_value,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {numberFormat(orderValue.toFixed(2), {
                formatter: 'value',
                formatterOptions: { currency: '$' },
              })}
            </SizableText>
          </XStack>
        ) : null}

        {/* Price (standard orders only — trigger orders show trigger/execution price above) */}
        {!isTriggerMode ? (
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_orderbook_price,
              })}
            </SizableText>
            {priceDisplay}
          </XStack>
        ) : null}

        {/* Liquidation Price */}
        {isSpot ? null : (
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_position_liq_price,
              })}
            </SizableText>
            <SizableText size="$bodyMd">
              <LiquidationPriceDisplay
                textSize="$bodyMdMedium"
                side={effectiveSide}
              />
            </SizableText>
          </XStack>
        )}

        {/* OneKey Fee */}
        {onekeyFee === 0 ? (
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.referral_perps_onekey_fee,
              })}
            </SizableText>
            <YStack alignItems="flex-end" gap="$0.5">
              <SizableText size="$bodyMdMedium" color="$green11">
                {intl.formatMessage({ id: ETranslations.perp_0_fee })}
              </SizableText>
              {savedFeeDisplay ? (
                <Badge badgeType="success" badgeSize="sm">
                  {intl.formatMessage(
                    {
                      id: ETranslations.perps_onekey_has_saved_you,
                    },
                    {
                      fee: savedFeeDisplay,
                    },
                  )}
                </Badge>
              ) : null}
            </YStack>
          </XStack>
        ) : null}

        {/* skip order confirm checkbox */}
        <XStack justifyContent="space-between" alignItems="center" gap="$2">
          <Checkbox
            testID="perp-checkbox"
            labelProps={{
              fontSize: '$bodyMdMedium',
              color: '$textSubdued',
            }}
            label={intl.formatMessage({
              id: ETranslations.perp_confirm_not_show,
            })}
            value={perpsCustomSettings.skipOrderConfirm}
            onChange={(checked) => setSkipOrderConfirm(!!checked)}
          />
        </XStack>
      </YStack>

      <TradingGuardWrapper
        bypassEnableTradingGuard={Boolean(enableTradingBeforeConfirm)}
      >
        <Button
          testID="perp-btn"
          variant="primary"
          size="medium"
          disabled={isConfirmLoading}
          loading={isConfirmLoading}
          onPress={handleConfirm}
          {...buttonStyleProps}
        >
          <SizableText size="$bodyMdMedium" color="$textOnColor">
            {buttonText}
          </SizableText>
        </Button>
      </TradingGuardWrapper>
    </YStack>
  );
}

export function showOrderConfirmDialog({
  overrideSide,
  intl,
  enableTradingBeforeConfirm,
  enableTradingAccountKey,
}: {
  overrideSide?: 'long' | 'short';
  intl: IntlShape;
  enableTradingBeforeConfirm?: (
    context: IOrderConfirmEnableTradingBeforeConfirmContext,
  ) => Promise<IEnableTradingWithDepositFallbackResult>;
  enableTradingAccountKey?: string;
}) {
  const dialogInstance = Dialog.show({
    title: intl.formatMessage({
      id: ETranslations.perp_confirm_order,
    }),
    renderContent: (
      <PerpsProviderMirror>
        <OrderConfirmContent
          onClose={() => {
            void dialogInstance.close();
          }}
          overrideSide={overrideSide}
          enableTradingBeforeConfirm={enableTradingBeforeConfirm}
          enableTradingAccountKey={enableTradingAccountKey}
        />
      </PerpsProviderMirror>
    ),
    contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
    showFooter: false,
    onClose: () => {
      void dialogInstance.close();
    },
  });

  return dialogInstance;
}
