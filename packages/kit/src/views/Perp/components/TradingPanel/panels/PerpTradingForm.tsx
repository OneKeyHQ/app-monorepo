import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Checkbox,
  NumberSizeableText,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  getFontSize,
} from '@onekeyhq/components';
import type { ICheckedState } from '@onekeyhq/components';
import {
  useHyperliquidActions,
  useTradingFormAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsAccountLoadingInfoAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useCurrentTokenData } from '../../../hooks';
import { useHyperliquidAccount } from '../../../hooks/useHyperliquid';
import { PriceInput } from '../inputs/PriceInput';
import { SizeInput } from '../inputs/SizeInput';
import { TpslInput } from '../inputs/TpslInput';
import { LeverageAdjustModal } from '../modals/LeverageAdjustModal';
import { MarginModeSelector } from '../selectors/MarginModeSelector';
import { OrderTypeSelector } from '../selectors/OrderTypeSelector';
import { TradeSideToggle } from '../selectors/TradeSideToggle';

import type { ISide } from '../selectors/TradeSideToggle';

interface IPerpTradingFormProps {
  isSubmitting?: boolean;
}

function PerpTradingForm({ isSubmitting = false }: IPerpTradingFormProps) {
  const { userWebData2, accountSummary } = useHyperliquidAccount();
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [formData] = useTradingFormAtom();
  const intl = useIntl();
  const actions = useHyperliquidActions();
  const tokenInfo = useCurrentTokenData();
  const accountDataInfo = useMemo(() => {
    const availableBalance = accountSummary.withdrawable;
    let currentPositionValue = new BigNumber(0);
    if (userWebData2) {
      currentPositionValue =
        userWebData2.clearinghouseState.assetPositions.reduce(
          (acc, curr) =>
            acc.plus(new BigNumber(curr.position.positionValue || 0)),
          new BigNumber(0),
        );
    }
    return { availableBalance, currentPositionValue };
  }, [accountSummary.withdrawable, userWebData2]);
  const updateForm = useCallback(
    (updates: Partial<ITradingFormData>) => {
      actions.current.updateTradingForm(updates);
    },
    [actions],
  );

  const prevTypeRef = useRef<'market' | 'limit'>(formData.type);
  const prevTokenRef = useRef<string>(tokenInfo?.name || '');

  useEffect(() => {
    const prevType = prevTypeRef.current;
    const currentType = formData.type;

    if (
      prevType !== 'limit' &&
      currentType === 'limit' &&
      !formData.price &&
      tokenInfo?.markPx
    ) {
      updateForm({ price: tokenInfo.markPx });
    }

    prevTypeRef.current = currentType;
  }, [formData.type, formData.price, tokenInfo?.markPx, updateForm]);

  useEffect(() => {
    const currentTokenName = tokenInfo?.name;
    const prevToken = prevTokenRef.current;

    if (
      prevToken &&
      currentTokenName &&
      prevToken !== currentTokenName &&
      formData.type === 'limit' &&
      tokenInfo?.markPx
    ) {
      updateForm({ price: tokenInfo.markPx });
    }

    if (currentTokenName) {
      prevTokenRef.current = currentTokenName;
    }
  }, [tokenInfo?.name, tokenInfo?.markPx, formData.type, updateForm]);

  const leverage = useMemo(() => {
    return tokenInfo?.leverage?.value || tokenInfo?.maxLeverage;
  }, [tokenInfo]);

  const referencePrice = useMemo(() => {
    if (formData.type === 'limit' && formData.price) {
      return new BigNumber(formData.price);
    }
    if (formData.type === 'market' && tokenInfo?.markPx) {
      return new BigNumber(tokenInfo.markPx);
    }
    return new BigNumber(0);
  }, [formData.type, formData.price, tokenInfo?.markPx]);

  const totalValue = useMemo(() => {
    const size = new BigNumber(formData.size || 0);
    return size.multipliedBy(referencePrice);
  }, [formData.size, referencePrice]);

  const marginRequired = useMemo(() => {
    if (!leverage || leverage === 0) return new BigNumber(0);
    return totalValue.dividedBy(leverage);
  }, [totalValue, leverage]);

  const handleTpslChange = useCallback(
    (data: { tpPrice: string; slPrice: string }) => {
      updateForm({
        tpTriggerPx: data.tpPrice,
        slTriggerPx: data.slPrice,
      });
    },
    [updateForm],
  );

  return (
    <>
      <YStack gap="$4">
        <TradeSideToggle
          value={formData.side}
          onChange={(side: ISide) => updateForm({ side })}
          disabled={isSubmitting}
        />

        <XStack alignItems="center" flex={1} gap="$3">
          <YStack flex={1}>
            <OrderTypeSelector
              value={formData.type}
              onChange={(type: 'market' | 'limit') => updateForm({ type })}
              disabled={isSubmitting}
            />
          </YStack>

          <YStack flex={1}>
            <MarginModeSelector disabled={isSubmitting} />
          </YStack>

          <LeverageAdjustModal />
        </XStack>
        <YStack
          flex={1}
          gap="$2.5"
          p="$2.5"
          borderWidth="$px"
          borderColor="$borderSubdued"
          borderRadius="$3"
        >
          {/* Available Balance */}
          <XStack justifyContent="space-between">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_trade_account_overview_available,
              })}
            </SizableText>
            {perpsAccountLoading?.selectAccountLoading || !userWebData2 ? (
              <Skeleton width={70} height={16} />
            ) : (
              <NumberSizeableText
                size="$bodySmMedium"
                formatter="value"
                formatterOptions={{ currency: '$' }}
              >
                {accountDataInfo.availableBalance}
              </NumberSizeableText>
            )}
          </XStack>
          <XStack justifyContent="space-between">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_trade_current_position,
              })}
            </SizableText>
            {perpsAccountLoading?.selectAccountLoading || !userWebData2 ? (
              <Skeleton width={60} height={16} />
            ) : (
              <NumberSizeableText
                size="$bodySmMedium"
                formatter="value"
                formatterOptions={{ currency: '$' }}
              >
                {accountDataInfo.currentPositionValue.toFixed()}
              </NumberSizeableText>
            )}
          </XStack>
        </YStack>
        {formData.type === 'limit' ? (
          <PriceInput
            onUseMarketPrice={() => {
              if (tokenInfo?.markPx) {
                updateForm({ price: tokenInfo.markPx });
              }
            }}
            value={formData.price}
            onChange={(value) => updateForm({ price: value })}
            szDecimals={tokenInfo?.szDecimals ?? 2}
          />
        ) : null}

        <SizeInput
          side={formData.side}
          tokenInfo={tokenInfo}
          value={formData.size}
          onChange={(value) => updateForm({ size: value })}
        />

        <YStack p="$0">
          <Checkbox
            label={intl.formatMessage({
              id: ETranslations.perp_position_tp_sl,
            })}
            value={formData.hasTpsl}
            onChange={(checked: ICheckedState) =>
              updateForm({ hasTpsl: !!checked })
            }
            disabled={isSubmitting}
            labelProps={{
              fontSize: getFontSize('$bodyMd'),
              color: '$textSubdued',
            }}
            containerProps={{ alignItems: 'center' }}
            width="$4"
            height="$4"
          />

          {formData.hasTpsl ? (
            <TpslInput
              price={referencePrice.toFixed()}
              side={formData.side}
              szDecimals={tokenInfo?.szDecimals ?? 2}
              leverage={leverage}
              tpsl={{
                tpPrice: formData.tpTriggerPx,
                slPrice: formData.slTriggerPx,
              }}
              onChange={handleTpslChange}
              disabled={isSubmitting}
            />
          ) : null}
        </YStack>
      </YStack>

      <YStack gap="$2" mt="$5">
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_trade_order_value,
            })}
          </SizableText>
          <NumberSizeableText
            size="$bodySmMedium"
            formatter="value"
            formatterOptions={{ currency: '$' }}
          >
            {totalValue.toNumber()}
          </NumberSizeableText>
        </XStack>
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_trade_margin_required,
            })}
          </SizableText>
          {leverage ? (
            <NumberSizeableText
              size="$bodySmMedium"
              formatter="value"
              formatterOptions={{ currency: '$' }}
            >
              {marginRequired.toNumber()}
            </NumberSizeableText>
          ) : (
            <Skeleton width={80} height={18} />
          )}
        </XStack>
      </YStack>
    </>
  );
}

const PerpTradingFormMemo = memo(PerpTradingForm);
export { PerpTradingFormMemo as PerpTradingForm };
