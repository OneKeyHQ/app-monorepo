import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  Dialog,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useTradingFormAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAssetAtom,
  usePerpsCustomSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';

import { useOrderConfirm, useTradingCalculationsForSide } from '../../../hooks';
import { PerpsProviderMirror } from '../../../PerpsProviderMirror';
import {
  GetTradingButtonStyleProps,
  getTradingSideTextColor,
} from '../../../utils/styleUtils';
import { TradingGuardWrapper } from '../../TradingGuardWrapper';
import { LiquidationPriceDisplay } from '../components/LiquidationPriceDisplay';

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
  const { computedSizeForSide } = useTradingCalculationsForSide(effectiveSide);
  const szDecimals = selectedSymbol?.universe?.szDecimals ?? 2;
  const actionColor = getTradingSideTextColor(effectiveSide);
  const buttonStyleProps = GetTradingButtonStyleProps(effectiveSide, false);
  const intl = useIntl();
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

  return (
    <YStack gap="$4" p="$1">
      {/* Order Details */}
      <YStack gap="$3">
        {/* Action */}
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {appLocale.intl.formatMessage({
              id: ETranslations.perp_confirm_order_action,
            })}
          </SizableText>
          <SizableText size="$bodyMdMedium" color={actionColor}>
            {actionText}
          </SizableText>
        </XStack>

        {/* Position Size */}
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {appLocale.intl.formatMessage({
              id: ETranslations.perp_position_position_size,
            })}
          </SizableText>
          <SizableText size="$bodyMdMedium">{sizeDisplay}</SizableText>
        </XStack>

        {/* Price */}
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {appLocale.intl.formatMessage({
              id: ETranslations.perp_orderbook_price,
            })}
          </SizableText>
          {formData.type === 'market' || !formData.price ? (
            <SizableText size="$bodyMdMedium">
              {appLocale.intl.formatMessage({
                id: ETranslations.perp_trade_market,
              })}
            </SizableText>
          ) : (
            <SizableText size="$bodyMdMedium">$ {formData.price}</SizableText>
          )}
        </XStack>

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
