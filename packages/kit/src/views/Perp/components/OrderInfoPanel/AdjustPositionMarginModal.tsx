import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { BigNumber } from 'bignumber.js';

import type { ISelectItem } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Icon,
  Select,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useHyperliquidActions,
  usePerpsActivePositionAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsActiveAccountSummaryAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  getValidPriceDecimals,
  validateSizeInput,
} from '@onekeyhq/shared/src/utils/perpsUtils';

import { PerpsProviderMirror } from '../../PerpsProviderMirror';
import { TradingGuardWrapper } from '../TradingGuardWrapper';
import { TradingFormInput } from '../TradingPanel/inputs/TradingFormInput';

export interface IAdjustPositionMarginParams {
  coin: string;
}

interface IAdjustPositionMarginFormProps extends IAdjustPositionMarginParams {
  onClose: () => void;
}

type IMarginAction = 'add' | 'remove';

const AdjustPositionMarginForm = memo(
  ({ coin, onClose = () => {} }: IAdjustPositionMarginFormProps) => {
    const hyperliquidActions = useHyperliquidActions();
    const [{ activePositions }] = usePerpsActivePositionAtom();
    const [accountSummary] = usePerpsActiveAccountSummaryAtom();

    const currentPosition = useMemo(() => {
      return activePositions.find((p) => p.position.coin === coin)?.position;
    }, [activePositions, coin]);

    const [assetId, setAssetId] = useState<number | null>(null);

    useEffect(() => {
      void (async () => {
        const meta = await backgroundApiProxy.serviceHyperliquid.getSymbolMeta({
          coin,
        });
        if (meta) {
          setAssetId(meta.assetId);
        }
      })();
    }, [coin]);

    useEffect(() => {
      if (!currentPosition || new BigNumber(currentPosition.szi || '0').eq(0)) {
        onClose();
      }
    }, [currentPosition, onClose]);

    useEffect(() => {
      if (currentPosition?.leverage?.type !== 'isolated') {
        onClose();
      }
    }, [currentPosition?.leverage?.type, onClose]);

    const [action, setAction] = useState<IMarginAction>('add');
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const currentMarginUsed = useMemo(() => {
      if (!currentPosition) return new BigNumber(0);
      return new BigNumber(currentPosition.marginUsed || '0');
    }, [currentPosition]);

    const availableBalance = useMemo(() => {
      return new BigNumber(accountSummary?.withdrawable || '0');
    }, [accountSummary?.withdrawable]);

    const positionValue = useMemo(() => {
      if (!currentPosition) return new BigNumber(0);
      return new BigNumber(currentPosition.positionValue || '0').abs();
    }, [currentPosition]);

    const decimals = useMemo(
      () => getValidPriceDecimals(currentPosition?.entryPx || '0'),
      [currentPosition?.entryPx],
    );
    const liquidationPrice = useMemo(() => {
      const liquidationPriceBN = new BigNumber(
        currentPosition?.liquidationPx || '0',
      );
      const liquidationPriceFormatted = liquidationPriceBN.isZero()
        ? 'N/A'
        : liquidationPriceBN.toFixed(decimals);
      return liquidationPriceFormatted;
    }, [decimals, currentPosition?.liquidationPx]);

    const leverage = useMemo(() => {
      return currentPosition?.leverage?.value || 1;
    }, [currentPosition?.leverage?.value]);

    const minimumMarginRequired = useMemo(() => {
      return positionValue.dividedBy(leverage);
    }, [positionValue, leverage]);

    const maxAdd = useMemo(() => {
      return availableBalance;
    }, [availableBalance]);

    const maxRemove = useMemo(() => {
      const removable = currentMarginUsed.minus(minimumMarginRequired);
      return BigNumber.max(removable, 0);
    }, [currentMarginUsed, minimumMarginRequired]);

    const selectItems = useMemo((): ISelectItem[] => {
      return [
        {
          label: appLocale.intl.formatMessage({
            id: ETranslations.global_add,
          }),
          value: 'add',
        },
        {
          label: appLocale.intl.formatMessage({
            id: ETranslations.global_remove,
          }),
          value: 'remove',
        },
      ];
    }, []);

    const handleActionChange = useCallback((newAction: string) => {
      setAction(newAction as IMarginAction);
      setAmount('');
    }, []);

    const handleAmountChange = useCallback((value: string) => {
      if (value === '' || validateSizeInput(value, 2)) {
        setAmount(value);
      }
    }, []);

    const handleMaxPress = useCallback(() => {
      const maxValue = action === 'add' ? maxAdd : maxRemove;
      setAmount(maxValue.decimalPlaces(2, BigNumber.ROUND_DOWN).toFixed(2));
    }, [action, maxAdd, maxRemove]);

    const isValidAmount = useMemo(() => {
      const amountBN = new BigNumber(amount || '0');
      if (amountBN.isNaN() || amountBN.lte(0)) return false;

      if (action === 'add') {
        return amountBN.lte(maxAdd);
      }
      return amountBN.lte(maxRemove);
    }, [amount, action, maxAdd, maxRemove]);

    const handleSubmit = useCallback(async () => {
      if (!isValidAmount || assetId === null || !currentPosition) return;

      setIsSubmitting(true);
      try {
        const isBuy = new BigNumber(currentPosition.szi || '0').gte(0);
        const amountNumber = new BigNumber(amount).multipliedBy(1e6);
        const ntli = action === 'add' ? amountNumber : amountNumber.negated();

        await hyperliquidActions.current.updateIsolatedMargin({
          asset: assetId,
          isBuy,
          ntli: ntli.toNumber(),
        });

        onClose();
      } catch (error) {
        console.error('[AdjustPositionMargin] Submit failed:', error);
        // Error already handled by withToast in action
      } finally {
        setIsSubmitting(false);
      }
    }, [
      isValidAmount,
      assetId,
      amount,
      action,
      currentPosition,
      onClose,
      hyperliquidActions,
    ]);

    if (!currentPosition || assetId === null) {
      return null;
    }

    const customSuffix = (
      <Select
        items={selectItems}
        value={action}
        onChange={handleActionChange}
        title={appLocale.intl.formatMessage({
          id: ETranslations.perp_position_margin,
        })}
        floatingPanelProps={{
          width: 120,
        }}
        renderTrigger={({ label: selectedLabel }) => (
          <XStack alignItems="center" gap="$1" cursor="pointer">
            <SizableText size="$bodyMdMedium" color="$textSubdued">
              {selectedLabel}
            </SizableText>
            <Icon
              name="ChevronDownSmallOutline"
              size="$4"
              color="$iconSubdued"
            />
          </XStack>
        )}
      />
    );

    return (
      <YStack flex={1}>
        <YStack flex={1} gap="$4" pb="$6">
          {/* Position Info */}
          <YStack gap="$3">
            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                {appLocale.intl.formatMessage({
                  id: ETranslations.perp_token_selector_asset,
                })}
              </SizableText>
              <SizableText size="$bodyMdMedium">
                {currentPosition.coin}
              </SizableText>
            </XStack>

            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                {appLocale.intl.formatMessage({
                  id: ETranslations.perp_position_margin,
                })}
              </SizableText>
              <SizableText size="$bodyMdMedium">
                {numberFormat(
                  currentMarginUsed
                    .decimalPlaces(2, BigNumber.ROUND_DOWN)
                    .toFixed(2),
                  {
                    formatter: 'value',
                    formatterOptions: { currency: '$' },
                  },
                )}
              </SizableText>
            </XStack>

            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                {appLocale.intl.formatMessage({
                  id: ETranslations.perp_position_liq_price,
                })}
              </SizableText>
              <SizableText size="$bodyMdMedium">{liquidationPrice}</SizableText>
            </XStack>
          </YStack>

          <YStack gap="$2">
            <TradingFormInput
              label={appLocale.intl.formatMessage({
                id: ETranslations.dexmarket_details_history_amount,
              })}
              value={amount}
              onChange={handleAmountChange}
              customSuffix={customSuffix}
              placeholder="0.00"
              keyboardType="decimal-pad"
              ifOnDialog
            />

            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                {action === 'add'
                  ? appLocale.intl.formatMessage({
                      id: ETranslations.perp_trading_adjust_margin_max,
                    })
                  : appLocale.intl.formatMessage({
                      id: ETranslations.perp_trading_adjust_margin_min,
                    })}
              </SizableText>
              <XStack gap="$1" alignItems="center">
                <SizableText size="$bodyMdMedium">
                  {numberFormat(
                    (action === 'add' ? maxAdd : maxRemove)
                      .decimalPlaces(2, BigNumber.ROUND_DOWN)
                      .toFixed(2),
                    {
                      formatter: 'value',
                      formatterOptions: { currency: '$' },
                    },
                  )}
                </SizableText>
                <SizableText
                  size="$bodyMd"
                  color="$textInteractive"
                  cursor="pointer"
                  onPress={handleMaxPress}
                >
                  {appLocale.intl.formatMessage({
                    id: ETranslations.dexmarket_custom_filters_max,
                  })}
                </SizableText>
              </XStack>
            </XStack>
          </YStack>
        </YStack>

        <TradingGuardWrapper>
          <Button
            size="medium"
            variant="primary"
            onPress={handleSubmit}
            disabled={!isValidAmount || isSubmitting}
            loading={isSubmitting}
          >
            {appLocale.intl.formatMessage({
              id: ETranslations.global_confirm,
            })}
          </Button>
        </TradingGuardWrapper>
      </YStack>
    );
  },
);

AdjustPositionMarginForm.displayName = 'AdjustPositionMarginForm';

export function showAdjustPositionMarginDialog({
  coin,
}: IAdjustPositionMarginParams) {
  const dialogInstance = Dialog.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.perp_trading_adjust_margin,
    }),

    renderContent: (
      <PerpsProviderMirror>
        <AdjustPositionMarginForm
          coin={coin}
          onClose={() => {
            void dialogInstance.close();
          }}
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
