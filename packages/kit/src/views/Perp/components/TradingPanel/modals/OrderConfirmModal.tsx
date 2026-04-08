import { useCallback, useEffect, useMemo, useState } from 'react';

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
import { useTradingFormAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAssetAtom,
  usePerpsCustomSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { inferTpsl, parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';
import { ETriggerOrderType } from '@onekeyhq/shared/types/hyperliquid/types';

import { useOrderConfirm, useTradingCalculationsForSide } from '../../../hooks';
import { useTradingPrice } from '../../../hooks/useTradingPrice';
import { PerpsProviderMirror } from '../../../PerpsProviderMirror';
import {
  GetTradingButtonStyleProps,
  getTradingSideTextColor,
} from '../../../utils/styleUtils';
import { TradingGuardWrapper } from '../../TradingGuardWrapper';
import { LiquidationPriceDisplay } from '../components/LiquidationPriceDisplay';

const SAVED_FEE_BENCHMARK_RATE = 0.0004;

interface IOrderConfirmContentProps {
  onClose?: () => void;
  overrideSide?: 'long' | 'short';
}

function OrderConfirmContent({
  onClose,
  overrideSide,
}: IOrderConfirmContentProps) {
  const { isSubmitting, handleConfirm: confirmOrder } = useOrderConfirm({
    onSuccess: () => {
      onClose?.();
    },
    onError: () => {
      onClose?.();
    },
  });
  const [perpsCustomSettings, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();
  const [formData] = useTradingFormAtom();
  const [selectedSymbol] = usePerpsActiveAssetAtom();
  const effectiveSide = overrideSide || formData.side;
  const { computedSizeForSide, orderValue } =
    useTradingCalculationsForSide(effectiveSide);
  const szDecimals = selectedSymbol?.universe?.szDecimals ?? 2;
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

  const actionText =
    effectiveSide === 'long'
      ? intl.formatMessage({
          id: ETranslations.perp_trade_long,
        })
      : intl.formatMessage({
          id: ETranslations.perp_trade_short,
        });

  const sizeDisplay = useMemo(() => {
    const sizeString = computedSizeForSide.toFixed(szDecimals);
    if (selectedSymbol?.coin) {
      const parsed = parseDexCoin(selectedSymbol.coin);
      return `${sizeString} ${parsed.displayName}`;
    }
    return sizeString;
  }, [computedSizeForSide, szDecimals, selectedSymbol?.coin]);

  const priceDisplay = useMemo(() => {
    if (formData.type === 'market' || !formData.price) {
      return (
        <SizableText size="$bodyMdMedium">
          {appLocale.intl.formatMessage({
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

    return <SizableText size="$bodyMdMedium">$ {formData.price}</SizableText>;
  }, [formData.type, formData.price, formData.bboPriceMode, intl]);

  const buttonText = useMemo(() => {
    if (isSubmitting) {
      return appLocale.intl.formatMessage({
        id: ETranslations.perp_trading_button_placing,
      });
    }
    return appLocale.intl.formatMessage({
      id: ETranslations.perp_confirm_order,
    });
  }, [isSubmitting]);

  const setSkipOrderConfirm = useCallback(
    (value: boolean) => {
      setPerpsCustomSettings({
        ...perpsCustomSettings,
        skipOrderConfirm: value,
      });
    },
    [perpsCustomSettings, setPerpsCustomSettings],
  );

  const handleConfirm = useCallback(() => {
    onClose?.();
    void confirmOrder(overrideSide);
  }, [confirmOrder, onClose, overrideSide]);

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
              $ {formData.triggerPrice}
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
              $ {formData.executionPrice}
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
            {appLocale.intl.formatMessage({
              id: ETranslations.perp_position_position_size,
            })}
          </SizableText>
          <SizableText size="$bodyMdMedium">{sizeDisplay}</SizableText>
        </XStack>

        {/* Price (standard orders only — trigger orders show trigger/execution price above) */}
        {!isTriggerMode ? (
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              {appLocale.intl.formatMessage({
                id: ETranslations.perp_orderbook_price,
              })}
            </SizableText>
            {priceDisplay}
          </XStack>
        ) : null}

        {/* Liquidation Price */}
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {appLocale.intl.formatMessage({
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
            labelProps={{
              fontSize: '$bodyMdMedium',
              color: '$textSubdued',
            }}
            label={appLocale.intl.formatMessage({
              id: ETranslations.perp_confirm_not_show,
            })}
            value={perpsCustomSettings.skipOrderConfirm}
            onChange={(checked) => setSkipOrderConfirm(!!checked)}
          />
        </XStack>
      </YStack>

      <TradingGuardWrapper>
        <Button
          variant="primary"
          size="medium"
          disabled={isSubmitting}
          loading={isSubmitting}
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

export function showOrderConfirmDialog(overrideSide?: 'long' | 'short') {
  const dialogInstance = Dialog.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.perp_confirm_order,
    }),
    renderContent: (
      <PerpsProviderMirror>
        <OrderConfirmContent
          onClose={() => {
            void dialogInstance.close();
          }}
          overrideSide={overrideSide}
        />
      </PerpsProviderMirror>
    ),
    showFooter: false,
    onClose: () => {
      void dialogInstance.close();
    },
  });

  return dialogInstance;
}
