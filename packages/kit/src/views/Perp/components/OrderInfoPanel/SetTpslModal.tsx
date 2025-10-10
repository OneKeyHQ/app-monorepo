import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { BigNumber } from 'bignumber.js';

import {
  Button,
  Checkbox,
  Dialog,
  Divider,
  Page,
  SegmentSlider,
  SizableText,
  Slider,
  Toast,
  XStack,
  YStack,
  getFontSize,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useHyperliquidActions,
  usePerpsActivePositionAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsActiveOpenOrdersAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  type EModalPerpRoutes,
  type IModalPerpParamList,
} from '@onekeyhq/shared/src/routes/perp';
import {
  calculateProfitLoss,
  formatWithPrecision,
  validateSizeInput,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { usePerpsMidPrice } from '../../hooks/usePerpsMidPrice';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';
import { TradingGuardWrapper } from '../TradingGuardWrapper';
import { TpslInput } from '../TradingPanel/inputs/TpslInput';
import { TradingFormInput } from '../TradingPanel/inputs/TradingFormInput';

import type { RouteProp } from '@react-navigation/core';

export interface ISetTpslParams {
  coin: string;
  szDecimals: number;
  assetId: number;
  isMobile?: boolean;
}

interface ISetTpslFormProps extends ISetTpslParams {
  onClose: () => void;
}

function MarkPrice({ coin }: { coin: string }) {
  const { midFormattedByDecimals } = usePerpsMidPrice({ coin });
  return (
    <SizableText size="$bodyMdMedium">{midFormattedByDecimals}</SizableText>
  );
}

const SetTpslForm = memo(
  ({
    coin,
    szDecimals,
    assetId,
    isMobile,
    onClose = () => {},
  }: ISetTpslFormProps) => {
    const hyperliquidActions = useHyperliquidActions();
    const { mid: midPrice } = usePerpsMidPrice({ coin });

    const [{ activePositions }] = usePerpsActivePositionAtom();
    const [{ openOrders }] = usePerpsActiveOpenOrdersAtom();

    const currentPosition = useMemo(() => {
      return activePositions.find((p) => p.position.coin === coin)?.position;
    }, [activePositions, coin]);

    const currentTpslOrders = useMemo(() => {
      if (!currentPosition) return [];
      return openOrders.filter(
        (o) =>
          o.coin === currentPosition.coin &&
          (o.orderType.startsWith('Take') || o.orderType.startsWith('Stop')),
      );
    }, [openOrders, currentPosition]);

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

    // Position is full position when sz is 0.0
    const tpOrder = useMemo(() => {
      return (
        currentTpslOrders.filter(
          (order) => order.orderType.startsWith('Take') && order.sz === '0.0',
        )?.[0] || null
      );
    }, [currentTpslOrders]);
    const slOrder = useMemo(() => {
      return (
        currentTpslOrders.filter(
          (order) => order.orderType.startsWith('Stop') && order.sz === '0.0',
        )?.[0] || null
      );
    }, [currentTpslOrders]);

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
        await hyperliquidActions.current.ensureTradingEnabled();
        const symbolMeta =
          await backgroundApiProxy.serviceHyperliquid.getSymbolMeta({
            coin: order.coin,
          });
        const tokenInfo = symbolMeta;
        if (!tokenInfo) {
          console.warn(`Token info not found for coin: ${order.coin}`);
          return;
        }
        await hyperliquidActions.current.cancelOrder({
          orders: [
            {
              assetId: tokenInfo.assetId,
              oid: order.oid,
            },
          ],
        });
      },
      [hyperliquidActions],
    );

    const entryPrice = useMemo(() => {
      return currentPosition?.entryPx || '0';
    }, [currentPosition]);

    const leverage = useMemo(() => {
      if (!currentPosition) return 1;
      const positionValue = new BigNumber(
        currentPosition.positionValue || '0',
      ).abs();
      const marginUsed = new BigNumber(currentPosition.marginUsed || '0');
      if (marginUsed.gt(0) && positionValue.gt(0)) {
        return Math.round(positionValue.dividedBy(marginUsed).toNumber());
      }
      return 1; // Default leverage if calculation fails
    }, [currentPosition]);

    const [formData, setFormData] = useState({
      tpPrice: '',
      slPrice: '',
      amount: '',
      percentage: 100,
    });

    const [configureAmount, setConfigureAmount] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const calculatedAmount = useMemo(() => {
      const percentage = Number.isNaN(formData.percentage)
        ? 0
        : formData.percentage;
      const amount = positionSize.multipliedBy(percentage).dividedBy(100);
      return formatWithPrecision(amount.toNumber(), szDecimals, true);
    }, [positionSize, formData.percentage, szDecimals]);

    const handleTpslChange = useCallback(
      (data: { tpPrice: string; slPrice: string }) => {
        setFormData((prev) => ({
          ...prev,
          tpPrice: data.tpPrice,
          slPrice: data.slPrice,
        }));
      },
      [],
    );

    const handlePercentageChange = useCallback(
      (percentage: number) => {
        const amount = positionSize
          .multipliedBy(percentage)
          .dividedBy(100)
          .toFixed(szDecimals);
        setFormData((prev) => ({
          ...prev,
          percentage,
          amount,
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

    const isValidForm = useMemo(() => {
      const hasNewTpPrice = !tpOrder && formData.tpPrice.trim() !== '';
      const hasNewSlPrice = !slOrder && formData.slPrice.trim() !== '';
      return hasNewTpPrice || hasNewSlPrice;
    }, [formData.tpPrice, formData.slPrice, tpOrder, slOrder]);

    const handleSubmit = useCallback(async () => {
      try {
        setIsSubmitting(true);

        const tpslAmount = configureAmount
          ? formData.amount || calculatedAmount
          : '0';
        const tpslAmountBN = new BigNumber(tpslAmount);

        if (configureAmount) {
          if (!tpOrder && !slOrder && (!tpslAmount || tpslAmountBN.lte(0))) {
            Toast.error({
              title: appLocale.intl.formatMessage({
                id: ETranslations.perp_tp_sl_error_enter,
              }),
            });
            return;
          }

          if (tpslAmountBN.gt(positionSize)) {
            Toast.error({
              title: appLocale.intl.formatMessage({
                id: ETranslations.perp_tp_sl_error_amount,
              }),
            });
            return;
          }
        }

        if (!isValidForm) {
          Toast.error({
            title: appLocale.intl.formatMessage({
              id: ETranslations.perp_tp_sl_error_price,
            }),
          });
          return;
        }

        const currentPriceBN = new BigNumber(midPrice || '0');
        const tpPriceBN = new BigNumber(formData.tpPrice || '0');
        const slPriceBN = new BigNumber(formData.slPrice || '0');

        if (
          !tpOrder &&
          formData.tpPrice &&
          tpPriceBN.isFinite() &&
          currentPriceBN.gt(0)
        ) {
          const isInvalid = isLongPosition
            ? tpPriceBN.lte(currentPriceBN)
            : tpPriceBN.gte(currentPriceBN);

          if (isInvalid) {
            let errorMessage = '';
            if (isLongPosition) {
              // Long + above
              errorMessage = appLocale.intl.formatMessage({
                id: ETranslations.perp_invaild_tp_desc_1,
              });
            } else {
              // Short + below
              errorMessage = appLocale.intl.formatMessage({
                id: ETranslations.perp_invaild_tp_desc_2,
              });
            }

            Toast.error({
              title: errorMessage,
            });
            return;
          }
        }

        if (
          !slOrder &&
          formData.slPrice &&
          slPriceBN.isFinite() &&
          currentPriceBN.gt(0)
        ) {
          const isInvalid = isLongPosition
            ? slPriceBN.gte(currentPriceBN)
            : slPriceBN.lte(currentPriceBN);
          if (isInvalid) {
            let errorMessage = '';
            if (isLongPosition) {
              // Long + below
              errorMessage = appLocale.intl.formatMessage({
                id: ETranslations.perp_invaild_sl_desc_1,
              });
            } else {
              // Short + above
              errorMessage = appLocale.intl.formatMessage({
                id: ETranslations.perp_invaild_sl_desc_2,
              });
            }

            Toast.error({
              title: errorMessage,
            });
            return;
          }
        }
        onClose();
        // Call the actual setPositionTpsl action
        await hyperliquidActions.current.setPositionTpsl({
          assetId,
          positionSize: tpslAmount,
          isBuy: isLongPosition,
          tpTriggerPx: !tpOrder ? formData.tpPrice || undefined : undefined,
          slTriggerPx: !slOrder ? formData.slPrice || undefined : undefined,
        });
      } catch (error) {
        // Error toast is handled in the action
        console.error('SetTpslModal handleSubmit error:', error);
        throw error;
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
      hyperliquidActions,
      onClose,
      slOrder,
      tpOrder,
      midPrice,
      isValidForm,
    ]);

    // Early return if position doesn't exist to prevent accessing undefined properties
    if (!currentPosition) {
      return null;
    }

    return (
      <YStack flex={1}>
        <YStack flex={1} gap="$3" pb="$6">
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
                  id: ETranslations.perp_position_position_size,
                })}
              </SizableText>
              <SizableText size="$bodyMdMedium">
                {positionSize.toFixed(szDecimals)} {currentPosition.coin}
              </SizableText>
            </XStack>

            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                {appLocale.intl.formatMessage({
                  id: ETranslations.perp_position_entry_price,
                })}
              </SizableText>
              <SizableText size="$bodyMdMedium">{entryPrice}</SizableText>
            </XStack>

            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                {appLocale.intl.formatMessage({
                  id: ETranslations.perp_position_mark_price,
                })}
              </SizableText>
              <MarkPrice coin={currentPosition.coin} />
            </XStack>
          </YStack>
          <Divider />
          {!tpOrder ? null : (
            <XStack justifyContent="space-between">
              <SizableText size="$bodyMd" color="$textSubdued">
                {appLocale.intl.formatMessage({
                  id: ETranslations.perp_trade_tp_price,
                })}
              </SizableText>
              <YStack>
                <XStack gap="$1">
                  <SizableText size="$bodyMdMedium">
                    {appLocale.intl.formatMessage({
                      id: ETranslations.perp_tp_sl_above,
                    })}
                    {': '}
                    {tpOrder.triggerPx}
                  </SizableText>
                  <SizableText
                    size="$bodyMd"
                    color="$green9"
                    ml="$2"
                    cursor="pointer"
                    onPress={() => handleCancelOrder(tpOrder)}
                  >
                    {appLocale.intl.formatMessage({
                      id: ETranslations.perp_open_orders_cancel,
                    })}
                  </SizableText>
                </XStack>
                {expectedProfit ? (
                  <SizableText size="$bodySm" alignSelf="flex-end">
                    {appLocale.intl.formatMessage({
                      id: ETranslations.perp_tp_sl_profit,
                    })}
                    {': '}${expectedProfit}
                  </SizableText>
                ) : null}
              </YStack>
            </XStack>
          )}
          <TpslInput
            price={entryPrice}
            side={isLongPosition ? 'long' : 'short'}
            szDecimals={szDecimals}
            leverage={leverage}
            tpsl={{ tpPrice: formData.tpPrice, slPrice: formData.slPrice }}
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
            <XStack justifyContent="space-between">
              <SizableText size="$bodyMd" color="$textSubdued">
                {appLocale.intl.formatMessage({
                  id: ETranslations.perp_trade_sl_price,
                })}
              </SizableText>
              <YStack>
                <XStack gap="$1">
                  <SizableText size="$bodyMdMedium">
                    {appLocale.intl.formatMessage({
                      id: ETranslations.perp_tp_sl_below,
                    })}
                    {': '}
                    {slOrder.triggerPx}
                  </SizableText>
                  <SizableText
                    size="$bodyMd"
                    color="$green9"
                    ml="$2"
                    cursor="pointer"
                    onPress={() => handleCancelOrder(slOrder)}
                  >
                    {appLocale.intl.formatMessage({
                      id: ETranslations.perp_open_orders_cancel,
                    })}
                  </SizableText>
                </XStack>
                {expectedLoss ? (
                  <SizableText size="$bodySm" alignSelf="flex-end">
                    {appLocale.intl.formatMessage({
                      id: ETranslations.perp_tp_sl_loss,
                    })}
                    {': '}${expectedLoss}
                  </SizableText>
                ) : null}
              </YStack>
            </XStack>
          )}

          <YStack alignItems="flex-start" gap="$2" width="100%">
            <Checkbox
              value={configureAmount}
              onChange={(checked) => setConfigureAmount(Boolean(checked))}
              label={appLocale.intl.formatMessage({
                id: ETranslations.perp_tp_sl_partial_position,
              })}
              labelProps={{
                fontSize: getFontSize('$bodyMd'),
                color: '$textSubdued',
              }}
              containerProps={{ alignItems: 'center' }}
              width="$4"
              height="$4"
            />

            {configureAmount ? (
              <YStack width="100%" gap="$5">
                <YStack width="100%">
                  <TradingFormInput
                    label={appLocale.intl.formatMessage({
                      id: ETranslations.dexmarket_details_history_amount,
                    })}
                    value={
                      formData.amount ||
                      (formData.percentage > 0 ? calculatedAmount : '')
                    }
                    onChange={handleAmountChange}
                    suffix={currentPosition.coin}
                    validator={(value: string) => {
                      const processedValue = value.replace(/。/g, '.');
                      return validateSizeInput(processedValue, szDecimals);
                    }}
                    ifOnDialog
                  />
                </YStack>

                <YStack flex={1} width="100%">
                  {platformEnv.isNativeIOS ? (
                    <SegmentSlider
                      value={formData.percentage}
                      onChange={handlePercentageChange}
                      max={100}
                      min={0}
                      segments={0}
                    />
                  ) : (
                    <Slider
                      value={formData.percentage}
                      onChange={handlePercentageChange}
                      max={100}
                      min={0}
                      step={1}
                    />
                  )}
                </YStack>
              </YStack>
            ) : null}
          </YStack>
        </YStack>
        <TradingGuardWrapper>
          <Button
            size={isMobile ? 'large' : 'medium'}
            variant="primary"
            onPress={handleSubmit}
            disabled={!isValidForm || isSubmitting}
            loading={isSubmitting}
          >
            {appLocale.intl.formatMessage({
              id: ETranslations.perp_confirm_order,
            })}
          </Button>{' '}
        </TradingGuardWrapper>
      </YStack>
    );
  },
);

SetTpslForm.displayName = 'SetTpslForm';

function SetTpslModal() {
  const route =
    useRoute<RouteProp<IModalPerpParamList, EModalPerpRoutes.MobileSetTpsl>>();

  const { coin, szDecimals, assetId, isMobile = true } = route.params;
  const navigation = useNavigation();
  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);
  return (
    <Page>
      <Page.Header
        title={appLocale.intl.formatMessage({
          id: ETranslations.perp_tp_sl_position,
        })}
      />
      <Page.Body>
        <PerpsProviderMirror>
          <YStack px="$4" flex={1}>
            <SetTpslForm
              coin={coin}
              szDecimals={szDecimals}
              assetId={assetId}
              onClose={handleClose}
              isMobile={isMobile}
            />
          </YStack>
        </PerpsProviderMirror>
      </Page.Body>
    </Page>
  );
}

export default SetTpslModal;
export function showSetTpslDialog({
  coin,
  szDecimals,
  assetId,
}: ISetTpslParams) {
  const dialogInstance = Dialog.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.perp_tp_sl_position,
    }),
    description: appLocale.intl.formatMessage({
      id: ETranslations.perp_tp_sl_position_desc,
    }),
    renderContent: (
      <PerpsProviderMirror>
        <SetTpslForm
          coin={coin}
          szDecimals={szDecimals}
          assetId={assetId}
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
