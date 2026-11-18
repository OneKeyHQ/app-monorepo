import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  Dialog,
  Divider,
  Page,
  SizableText,
  Toast,
  XStack,
  YStack,
  getFontSize,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useHyperliquidActions,
  usePerpsActiveOpenOrdersAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  type EModalPerpRoutes,
  type IModalPerpParamList,
} from '@onekeyhq/shared/src/routes/perp';
import {
  calculateProfitLoss,
  formatHlSize,
  parseDexCoin,
  validateSizeInput,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useEnsureTradingEnabled } from '../../hooks/useEnableTradingWithDepositFallback';
import { usePerpsAccountScopedActivePositions } from '../../hooks/usePerpsAccountScopedActivePositions';
import { usePerpsAccountScopedCacheAddress } from '../../hooks/usePerpsAccountScopedCacheAddress';
import { usePerpsMidPrice } from '../../hooks/usePerpsMidPrice';
import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';
import { isPerpsAccountAddressMatched } from '../../utils/accountScopedData';
import {
  PERP_DIALOG_BUTTON_SIZE,
  PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
} from '../PerpDialogLayout';
import { PerpsSlider } from '../PerpsSlider';
import { TradingGuardWrapper } from '../TradingGuardWrapper';
import { TpslInput } from '../TradingPanel/inputs/TpslInput';
import { TradingFormInput } from '../TradingPanel/inputs/TradingFormInput';

import {
  buildPositionTpslScopeKey,
  buildPositionTpslSubmission,
  captureInitialPositionTpslScopeKey,
  getPositionTpslScopeChangeErrorTitle,
  hasPositionTpslSubmission,
  selectPositionTpslOrders,
} from './utils/positionTpslSnapshot';

import type { RouteProp } from '@react-navigation/core';
import type { IntlShape } from 'react-intl';

export interface ISetTpslParams {
  coin: string;
  szDecimals: number;
  assetId: number;
  isMobile?: boolean;
  // Seed a single trigger field when opened from a chart position context.
  presetTriggerPrice?: string;
  presetTpsl?: 'tp' | 'sl';
}

interface ISetTpslFormProps extends Omit<ISetTpslParams, 'isMobile'> {
  onClose: () => void;
}

function getTriggerPriceErrors(
  { tpTriggerPx, slTriggerPx }: ReturnType<typeof buildPositionTpslSubmission>,
  midPrice: string | undefined,
  isLong: boolean,
  intl: IntlShape,
) {
  const mid = new BigNumber(midPrice || 0);
  function validatePrice(kind: 'tp' | 'sl', price?: string) {
    if (!price) return undefined;
    const trigger = new BigNumber(price);
    if (!trigger.isFinite() || !trigger.gt(0)) {
      return intl.formatMessage(
        { id: ETranslations.form_must_greater_then_value },
        { value: 0 },
      );
    }
    const shouldBeAbove = (kind === 'tp') === isLong;
    if (mid.gt(0) && (shouldBeAbove ? trigger.lte(mid) : trigger.gte(mid))) {
      return intl.formatMessage(
        { id: ETranslations.perps_pro_order_trigger_price },
        {
          type: intl.formatMessage({
            id: kind === 'tp' ? ETranslations.perp_tp : ETranslations.perp_sl,
          }),
          dir: intl.formatMessage({
            id: shouldBeAbove
              ? ETranslations.perps_above
              : ETranslations.perps_below,
          }),
        },
      );
    }
    return undefined;
  }
  return {
    tp: validatePrice('tp', tpTriggerPx),
    sl: validatePrice('sl', slTriggerPx),
  };
}

function MarkPrice({ coin }: { coin: string }) {
  const { midFormattedByDecimals } = usePerpsMidPrice({
    coin,
    allowActiveAssetFallback: true,
  });
  return (
    <SizableText size="$bodyMdMedium">{midFormattedByDecimals}</SizableText>
  );
}

function CancelOrderButton({
  disabled,
  label,
  onPress,
}: {
  disabled: boolean;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Button
      testID="perp-intl-btn"
      size="small"
      variant="secondary"
      ml="$2"
      minWidth={56}
      height={24}
      px="$2.5"
      disabled={disabled}
      onPress={onPress}
      flexShrink={0}
    >
      <SizableText
        size="$bodySmMedium"
        color={disabled ? '$textDisabled' : '$text'}
      >
        {label}
      </SizableText>
    </Button>
  );
}

function ExistingTpslOrderSummary({
  relationLabel,
  triggerPx,
  pnlLabel,
  pnlValue,
  disabled,
  cancelLabel,
  onCancel,
}: {
  relationLabel: string;
  triggerPx: string;
  pnlLabel: string;
  pnlValue: string;
  disabled: boolean;
  cancelLabel: string;
  onCancel: () => void;
}) {
  const isNegative = pnlValue.startsWith('-');
  const formattedPnlValue = isNegative
    ? `-$${pnlValue.slice(1)}`
    : `$${pnlValue}`;

  return (
    <YStack gap="$1.5" py="$1">
      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
          <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
            {relationLabel}
          </SizableText>
          <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
            {triggerPx}
          </SizableText>
        </XStack>
        <CancelOrderButton
          disabled={disabled}
          label={cancelLabel}
          onPress={onCancel}
        />
      </XStack>
      <XStack alignItems="center" justifyContent="flex-end" gap="$1.5">
        <SizableText size="$bodySm" color="$textSubdued">
          {pnlLabel}
        </SizableText>
        <SizableText
          size="$bodyMdMedium"
          color={isNegative ? '$red11' : '$green11'}
        >
          {formattedPnlValue}
        </SizableText>
      </XStack>
    </YStack>
  );
}

const SetTpslForm = memo(
  ({
    coin,
    szDecimals,
    assetId,
    presetTriggerPrice,
    presetTpsl,
    onClose = () => {},
  }: ISetTpslFormProps) => {
    const intl = useIntl();
    const hyperliquidActions = useHyperliquidActions();
    const ensureTradingEnabled = useEnsureTradingEnabled();
    const { mid: midPrice } = usePerpsMidPrice({
      coin,
      szDecimals,
      allowActiveAssetFallback: true,
    });

    const activePositions = usePerpsAccountScopedActivePositions();
    const [activeAccount] = usePerpsActiveAccountAtom();
    const [activeOpenOrders] = usePerpsActiveOpenOrdersAtom();
    const accountScopedAddress = usePerpsAccountScopedCacheAddress();
    const canSubmitForScopedAccount = isPerpsAccountAddressMatched({
      activeAccountAddress: activeAccount?.accountAddress,
      dataAccountAddress: accountScopedAddress,
    });
    const currentPosition = useMemo(() => {
      return activePositions.find((p) => p.position.coin === coin)?.position;
    }, [activePositions, coin]);

    useEffect(() => {
      if (!currentPosition || new BigNumber(currentPosition.szi || '0').eq(0)) {
        onClose();
      }
    }, [currentPosition, onClose]);

    const positionSize = useMemo(() => {
      if (!currentPosition) return new BigNumber(0);
      const size = new BigNumber(currentPosition.szi || '0').abs();
      return size;
    }, [currentPosition]);

    const isLongPosition = useMemo(() => {
      if (!currentPosition) return true;
      return new BigNumber(currentPosition.szi || '0').gte(0);
    }, [currentPosition]);

    const leverage = useMemo(() => {
      if (!currentPosition) return 1;
      if (currentPosition.leverage?.value) {
        return currentPosition.leverage.value;
      }
      const positionValue = new BigNumber(
        currentPosition.positionValue || '0',
      ).abs();
      const marginUsed = new BigNumber(currentPosition.marginUsed || '0');
      return marginUsed.gt(0) && positionValue.gt(0)
        ? Math.round(positionValue.dividedBy(marginUsed).toNumber())
        : 1;
    }, [currentPosition]);

    const currentScopeKey = useMemo(
      () =>
        buildPositionTpslScopeKey({
          accountAddress: activeAccount?.accountAddress,
          coin,
          positionSize: currentPosition?.szi ?? '',
          entryPrice: currentPosition?.entryPx ?? '',
          leverage,
        }),
      [
        activeAccount?.accountAddress,
        coin,
        currentPosition?.entryPx,
        currentPosition?.szi,
        leverage,
      ],
    );
    const initialScopeKeyRef = useRef('');
    initialScopeKeyRef.current = captureInitialPositionTpslScopeKey(
      initialScopeKeyRef.current,
      currentScopeKey,
    );
    const latestScopeKeyRef = useRef(currentScopeKey);
    latestScopeKeyRef.current = currentScopeKey;

    const scopedOpenOrders = useMemo(() => {
      if (
        !isPerpsAccountAddressMatched({
          activeAccountAddress: activeAccount?.accountAddress,
          dataAccountAddress: activeOpenOrders.accountAddress,
        })
      ) {
        return [];
      }
      return activeOpenOrders.openOrdersByCoin[coin] ?? [];
    }, [activeAccount?.accountAddress, activeOpenOrders, coin]);
    const currentTpslOrders = useMemo(
      () => selectPositionTpslOrders(scopedOpenOrders, coin),
      [coin, scopedOpenOrders],
    );
    const latestTpslOrdersRef = useRef(currentTpslOrders);
    latestTpslOrdersRef.current = currentTpslOrders;
    const { tpOrder, slOrder } = currentTpslOrders;

    const expectedProfit = useMemo(() => {
      if (tpOrder && currentPosition) {
        return calculateProfitLoss({
          entryPrice: currentPosition.entryPx,
          exitPrice: tpOrder.triggerPx,
          amount: positionSize,
          side: isLongPosition ? 'long' : 'short',
        });
      }
      return null;
    }, [tpOrder, positionSize, currentPosition, isLongPosition]);
    const expectedLoss = useMemo(() => {
      if (slOrder && currentPosition) {
        return calculateProfitLoss({
          entryPrice: currentPosition.entryPx,
          exitPrice: slOrder.triggerPx,
          amount: positionSize,
          side: isLongPosition ? 'long' : 'short',
        });
      }
      return null;
    }, [slOrder, positionSize, currentPosition, isLongPosition]);

    const handleCancelOrder = useCallback(
      async (order: IPerpsFrontendOrder) => {
        if (!canSubmitForScopedAccount) {
          return;
        }

        try {
          await ensureTradingEnabled();
          const symbolMeta =
            await backgroundApiProxy.serviceHyperliquid.getSymbolMeta({
              coin: order.coin,
            });
          if (!symbolMeta) {
            console.warn(`Token info not found for coin: ${order.coin}`);
            return;
          }
          await hyperliquidActions.current.cancelOrder({
            orders: [
              {
                assetId: symbolMeta.assetId,
                oid: order.oid,
              },
            ],
          });
        } catch (error) {
          console.error('SetTpslModal handleCancelOrder error:', error);
        }
      },
      [canSubmitForScopedAccount, ensureTradingEnabled, hyperliquidActions],
    );

    const entryPrice = useMemo(() => {
      return currentPosition?.entryPx || '0';
    }, [currentPosition]);

    const [formData, setFormData] = useState(() => ({
      tpPrice:
        presetTriggerPrice && presetTpsl === 'tp' ? presetTriggerPrice : '',
      slPrice:
        presetTriggerPrice && presetTpsl === 'sl' ? presetTriggerPrice : '',
      amount: '',
      percentage: 100,
    }));
    const [configureAmount, setConfigureAmount] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const displayName = useMemo(() => {
      if (!currentPosition) return '';
      const parsed = parseDexCoin(currentPosition.coin);
      return parsed.displayName || currentPosition.coin;
    }, [currentPosition]);

    const calculatedAmount = useMemo(() => {
      const percentage = Number.isNaN(formData.percentage)
        ? 0
        : formData.percentage;
      const amount = positionSize.multipliedBy(percentage).dividedBy(100);
      // Floor-truncate to szDecimals to match HL lot-size rule (no over-rounding).
      return formatHlSize(amount, szDecimals) || '0';
    }, [positionSize, formData.percentage, szDecimals]);

    const handleTpslChange = useCallback(
      (data: { tpPrice: string; slPrice: string }) => {
        setFormData((prev) => ({ ...prev, ...data }));
      },
      [],
    );

    const handlePercentageChange = useCallback(
      (percentage: number) => {
        const amount = positionSize.multipliedBy(percentage).dividedBy(100);
        setFormData((prev) => ({
          ...prev,
          percentage,
          amount: formatHlSize(amount, szDecimals) || '0',
        }));
      },
      [positionSize, szDecimals],
    );

    const handleAmountChange = useCallback(
      (value: string) => {
        const processedValue = value.replace(/。/g, '.');
        if (processedValue === '') {
          setFormData((prev) => ({
            ...prev,
            amount: '',
            percentage: 0,
          }));
          return;
        }
        if (processedValue === '.') {
          setFormData((prev) => ({
            ...prev,
            amount: processedValue,
            percentage: 0,
          }));
          return;
        }

        let numericValue = new BigNumber(processedValue);
        if (numericValue.isNaN()) {
          return;
        }
        if (numericValue.gt(positionSize)) {
          numericValue = positionSize;
        }
        const percentage = positionSize.gt(0)
          ? numericValue.dividedBy(positionSize).multipliedBy(100).toNumber()
          : 0;

        setFormData((prev) => ({
          ...prev,
          amount: numericValue.toFixed(),
          percentage: Math.min(100, Math.max(0, percentage)),
        }));
      },
      [positionSize],
    );

    const draft = useMemo(
      () =>
        buildPositionTpslSubmission({
          orders: currentTpslOrders,
          tpTriggerPx: formData.tpPrice,
          slTriggerPx: formData.slPrice,
        }),
      [currentTpslOrders, formData.tpPrice, formData.slPrice],
    );
    const priceErrors = getTriggerPriceErrors(
      draft,
      midPrice,
      isLongPosition,
      intl,
    );
    const isValidForm =
      hasPositionTpslSubmission(draft) && !priceErrors.tp && !priceErrors.sl;

    const handleSubmit = useCallback(async () => {
      try {
        if (!canSubmitForScopedAccount) {
          return;
        }
        setIsSubmitting(true);

        await ensureTradingEnabled();
        const scopeChangeErrorTitle = getPositionTpslScopeChangeErrorTitle({
          initialScopeKey: initialScopeKeyRef.current,
          currentScopeKey: latestScopeKeyRef.current,
          errorTitle: intl.formatMessage({
            id: ETranslations.position_changed_review_submit_again__msg,
          }),
        });
        if (scopeChangeErrorTitle) {
          Toast.error({ title: scopeChangeErrorTitle });
          return;
        }
        const submission = buildPositionTpslSubmission({
          orders: { tpOrder, slOrder },
          latestOrders: latestTpslOrdersRef.current,
          tpTriggerPx: formData.tpPrice,
          slTriggerPx: formData.slPrice,
        });
        if (!hasPositionTpslSubmission(submission)) {
          onClose();
          return;
        }

        const tpslAmount = configureAmount
          ? formData.amount || calculatedAmount
          : '0';
        const tpslAmountBN = new BigNumber(tpslAmount);

        if (configureAmount) {
          if (!tpslAmount || tpslAmountBN.lte(0)) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.perp_tp_sl_error_enter,
              }),
            });
            return;
          }

          if (tpslAmountBN.gt(positionSize)) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.perp_tp_sl_error_amount,
              }),
            });
            return;
          }
        }

        const errors = getTriggerPriceErrors(
          submission,
          midPrice,
          isLongPosition,
          intl,
        );
        const error = errors.tp ?? errors.sl;
        if (error) {
          Toast.error({ title: error });
          return;
        }

        await hyperliquidActions.current.setPositionTpsl({
          assetId,
          expectedAccountAddress: activeAccount?.accountAddress ?? '',
          positionSize: tpslAmount,
          isBuy: isLongPosition,
          tpTriggerPx: submission.tpTriggerPx,
          slTriggerPx: submission.slTriggerPx,
        });
        onClose();
      } catch (error) {
        console.error('SetTpslModal handleSubmit error:', error);
      } finally {
        setIsSubmitting(false);
      }
    }, [
      configureAmount,
      formData.amount,
      calculatedAmount,
      formData.tpPrice,
      formData.slPrice,
      positionSize,
      assetId,
      isLongPosition,
      ensureTradingEnabled,
      hyperliquidActions,
      onClose,
      midPrice,
      intl,
      canSubmitForScopedAccount,
      activeAccount?.accountAddress,
      tpOrder,
      slOrder,
    ]);

    // Early return if position doesn't exist to prevent accessing undefined properties
    if (!currentPosition) {
      return null;
    }

    return (
      <YStack flex={1}>
        <YStack flex={1} gap="$3" pb={platformEnv.isNative ? '$8' : '$4'}>
          <YStack gap="$3">
            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_token_selector_asset,
                })}
              </SizableText>
              <SizableText size="$bodyMdMedium">{displayName}</SizableText>
            </XStack>

            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_position_position_size,
                })}
              </SizableText>
              <SizableText size="$bodyMdMedium">
                {positionSize.toFixed(szDecimals)} {displayName}
              </SizableText>
            </XStack>

            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_position_entry_price,
                })}
              </SizableText>
              <SizableText size="$bodyMdMedium">{entryPrice}</SizableText>
            </XStack>

            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_order_mid_price_title,
                })}
              </SizableText>
              <MarkPrice coin={currentPosition.coin} />
            </XStack>
          </YStack>
          <Divider />
          {!tpOrder ? null : (
            <YStack gap="$1">
              {expectedProfit ? (
                <ExistingTpslOrderSummary
                  relationLabel={intl.formatMessage({
                    id: ETranslations.perp_tp_sl_above,
                  })}
                  triggerPx={tpOrder.triggerPx}
                  pnlLabel={intl.formatMessage({
                    id: ETranslations.perp_tp_sl_profit,
                  })}
                  pnlValue={expectedProfit}
                  disabled={!canSubmitForScopedAccount}
                  cancelLabel={intl.formatMessage({
                    id: ETranslations.perp_open_orders_cancel,
                  })}
                  onCancel={() => handleCancelOrder(tpOrder)}
                />
              ) : null}
            </YStack>
          )}
          <TpslInput
            price={entryPrice}
            side={isLongPosition ? 'long' : 'short'}
            szDecimals={szDecimals}
            leverage={leverage}
            tpsl={{ tpPrice: formData.tpPrice, slPrice: formData.slPrice }}
            tpError={priceErrors.tp}
            slError={priceErrors.sl}
            onChange={handleTpslChange}
            amount={
              configureAmount
                ? formData.amount || calculatedAmount
                : positionSize.toFixed(szDecimals)
            }
            ifOnDialog
            hiddenTp={!!tpOrder}
            hiddenSl={!!slOrder}
          />
          {!slOrder ? null : (
            <YStack gap="$1">
              {expectedLoss ? (
                <ExistingTpslOrderSummary
                  relationLabel={intl.formatMessage({
                    id: ETranslations.perp_tp_sl_below,
                  })}
                  triggerPx={slOrder.triggerPx}
                  pnlLabel={intl.formatMessage({
                    id: ETranslations.perp_tp_sl_loss,
                  })}
                  pnlValue={expectedLoss}
                  disabled={!canSubmitForScopedAccount}
                  cancelLabel={intl.formatMessage({
                    id: ETranslations.perp_open_orders_cancel,
                  })}
                  onCancel={() => handleCancelOrder(slOrder)}
                />
              ) : null}
            </YStack>
          )}

          <YStack alignItems="flex-start" gap="$2" width="100%">
            <Checkbox
              testID="perp-checkbox"
              value={configureAmount}
              onChange={(checked) => setConfigureAmount(Boolean(checked))}
              label={intl.formatMessage({
                id: ETranslations.perp_tp_sl_partial_position,
              })}
              labelProps={{
                fontSize: getFontSize('$bodyMd'),
                color: '$textSubdued',
              }}
              containerProps={{ alignItems: 'center', pt: '$0' }}
              width="$4"
              height="$4"
            />

            {configureAmount ? (
              <YStack width="100%" gap="$5">
                <YStack width="100%">
                  <TradingFormInput
                    label={intl.formatMessage({
                      id: ETranslations.dexmarket_details_history_amount,
                    })}
                    value={
                      formData.amount ||
                      (formData.percentage > 0 ? calculatedAmount : '')
                    }
                    onChange={handleAmountChange}
                    suffix={displayName}
                    validator={(value: string) => {
                      const processedValue = value.replace(/。/g, '.');
                      return validateSizeInput(processedValue, szDecimals);
                    }}
                    ifOnDialog
                  />
                </YStack>

                <YStack flex={1} width="100%">
                  <PerpsSlider
                    value={formData.percentage}
                    onChange={handlePercentageChange}
                    max={100}
                    min={0}
                    segments={4}
                    snapTapToSegment
                    sliderHeight={4}
                    showBubble
                  />
                </YStack>
              </YStack>
            ) : null}
          </YStack>
        </YStack>
        <TradingGuardWrapper buttonSize={PERP_DIALOG_BUTTON_SIZE}>
          <Button
            testID="perp-processed-value-btn"
            size={PERP_DIALOG_BUTTON_SIZE}
            variant="primary"
            onPress={handleSubmit}
            disabled={
              !canSubmitForScopedAccount || !isValidForm || isSubmitting
            }
            loading={isSubmitting}
          >
            {intl.formatMessage({
              id: ETranslations.perp_confirm_order,
            })}
          </Button>
        </TradingGuardWrapper>
      </YStack>
    );
  },
);

SetTpslForm.displayName = 'SetTpslForm';

function SetTpslModal() {
  const intl = useIntl();
  const route =
    useRoute<RouteProp<IModalPerpParamList, EModalPerpRoutes.MobileSetTpsl>>();

  const { coin, szDecimals, assetId } = route.params;
  const navigation = useNavigation();
  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.perp_tp_sl_position,
        })}
      />
      <Page.Body>
        <PerpsAccountSelectorProviderMirror>
          <PerpsProviderMirror>
            <YStack px="$4" flex={1}>
              <SetTpslForm
                coin={coin}
                szDecimals={szDecimals}
                assetId={assetId}
                onClose={handleClose}
              />
            </YStack>
          </PerpsProviderMirror>
        </PerpsAccountSelectorProviderMirror>
      </Page.Body>
    </Page>
  );
}

export default SetTpslModal;
export function showSetTpslDialog({
  coin,
  szDecimals,
  assetId,
  presetTriggerPrice,
  presetTpsl,
  intl,
}: ISetTpslParams & { intl: IntlShape }) {
  const dialogInstance = Dialog.show({
    title: intl.formatMessage({
      id: ETranslations.perp_tp_sl_position,
    }),
    description: intl.formatMessage({
      id: ETranslations.perp_tp_sl_position_desc,
    }),
    renderContent: (
      <PerpsAccountSelectorProviderMirror>
        <PerpsProviderMirror>
          <SetTpslForm
            coin={coin}
            szDecimals={szDecimals}
            assetId={assetId}
            presetTriggerPrice={presetTriggerPrice}
            presetTpsl={presetTpsl}
            onClose={() => {
              void dialogInstance.close();
            }}
          />
        </PerpsProviderMirror>
      </PerpsAccountSelectorProviderMirror>
    ),
    contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
    showFooter: false,
    onClose: () => {
      void dialogInstance.close();
    },
  });

  return dialogInstance;
}
