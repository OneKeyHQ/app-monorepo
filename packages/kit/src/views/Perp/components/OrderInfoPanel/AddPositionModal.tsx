import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  Dialog,
  Divider,
  Icon,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useHyperliquidActions,
  usePerpsAllMidsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  formatPriceToSignificantDigits,
  parseDexCoin,
  validateSizeInput,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IActiveAssetData,
  IHex,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import { usePerpsAccountScopedActivePositions } from '../../hooks/usePerpsAccountScopedActivePositions';
import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';
import { PerpTestIDs } from '../../testIDs';
import { resolveTpSlTriggerPx } from '../../utils/resolveTpSlTriggerPx';
import { buildDefaultTpSlPercent } from '../../utils/tpslSeed';
import {
  PERP_DIALOG_BUTTON_SIZE,
  PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
} from '../PerpDialogLayout';
import { TradingGuardWrapper } from '../TradingGuardWrapper';
import { PriceInput } from '../TradingPanel/inputs/PriceInput';
import { TpSlFormInput } from '../TradingPanel/inputs/TpSlFormInput';
import { TradingFormInput } from '../TradingPanel/inputs/TradingFormInput';

import {
  isAddPositionAssetDataScoped,
  isAddPositionScopeValid,
  validateAddPositionOrder,
} from './utils/addPosition';

import type { IntlShape } from 'react-intl';

type IAddPositionOrderType = 'market' | 'limit';

export interface IAddPositionParams {
  coin: string;
  isBuy: boolean;
  accountAddress: string;
}

interface IAddPositionFormProps extends IAddPositionParams {
  onClose: () => void;
}

const AddPositionForm = memo(
  ({ coin, isBuy, accountAddress, onClose }: IAddPositionFormProps) => {
    const intl = useIntl();
    const actions = useHyperliquidActions();
    const [activeAccount] = usePerpsActiveAccountAtom();
    const [allMids] = usePerpsAllMidsAtom();
    const activePositions = usePerpsAccountScopedActivePositions();
    const currentPosition = useMemo(
      () =>
        activePositions.find((item) => item.position.coin === coin)?.position,
      [activePositions, coin],
    );
    const currentPositionRef = useRef(currentPosition);
    const activeAccountAddressRef = useRef(activeAccount?.accountAddress);
    currentPositionRef.current = currentPosition;
    activeAccountAddressRef.current = activeAccount?.accountAddress;

    const [orderType, setOrderType] = useState<IAddPositionOrderType>('market');
    const [amount, setAmount] = useState('');
    const [limitPrice, setLimitPrice] = useState('');
    const [hasTpsl, setHasTpsl] = useState(false);
    const [tpType, setTpType] = useState<'price' | 'percentage'>('price');
    const [tpValue, setTpValue] = useState('');
    const [slType, setSlType] = useState<'price' | 'percentage'>('price');
    const [slValue, setSlValue] = useState('');
    const [assetData, setAssetData] = useState<IActiveAssetData>();
    const [szDecimals, setSzDecimals] = useState<number>();
    const [isLoadingAssetData, setIsLoadingAssetData] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const requestIdRef = useRef(0);
    const isLimitPriceInitializedRef = useRef(false);

    const midPrice = allMids?.mids?.[coin] ?? '';
    const displayName = parseDexCoin(coin).displayName;
    const leverage = currentPosition?.leverage?.value ?? 1;
    const fetchTargetAssetData = useCallback(async () => {
      const [data, symbolMeta] = await Promise.all([
        backgroundApiProxy.serviceHyperliquid.getActiveAssetDataByCoin({
          coin,
          user: accountAddress as IHex,
        }),
        backgroundApiProxy.serviceHyperliquid.getSymbolMeta({ coin }),
      ]);
      if (
        !isAddPositionAssetDataScoped({ data, coin, accountAddress }) ||
        !symbolMeta ||
        symbolMeta.isSpot ||
        symbolMeta.universe?.szDecimals === undefined
      ) {
        throw new OneKeyLocalError('The target market data scope changed');
      }
      return { data, szDecimals: symbolMeta.universe.szDecimals };
    }, [accountAddress, coin]);

    useEffect(() => {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      let disposed = false;
      setIsLoadingAssetData(true);
      void fetchTargetAssetData()
        .then((result) => {
          if (!disposed && requestId === requestIdRef.current) {
            setAssetData(result.data);
            setSzDecimals(result.szDecimals);
          }
        })
        .catch(() => {
          if (!disposed && requestId === requestIdRef.current) {
            setAssetData(undefined);
            setSzDecimals(undefined);
          }
        })
        .finally(() => {
          if (!disposed && requestId === requestIdRef.current) {
            setIsLoadingAssetData(false);
          }
        });
      return () => {
        disposed = true;
      };
    }, [fetchTargetAssetData]);

    useEffect(() => {
      if (midPrice && !isLimitPriceInitializedRef.current) {
        setLimitPrice(formatPriceToSignificantDigits(midPrice));
        isLimitPriceInitializedRef.current = true;
      }
    }, [midPrice]);

    const isScopeValid = isAddPositionScopeValid({
      expectedAccountAddress: accountAddress,
      currentAccountAddress: activeAccount?.accountAddress,
      coin,
      isBuy,
      currentPosition,
    });
    const maxSize = assetData?.maxTradeSzs?.[isBuy ? 0 : 1] ?? '0';
    const effectivePrice = orderType === 'market' ? midPrice : limitPrice;
    const validation = validateAddPositionOrder({
      size: amount,
      price: effectivePrice,
      maxSize,
      szDecimals: szDecimals ?? 0,
    });
    const isFormValid = Boolean(
      isScopeValid &&
      !isLoadingAssetData &&
      szDecimals !== undefined &&
      isAddPositionAssetDataScoped({ data: assetData, coin, accountAddress }) &&
      !validation.error,
    );

    const handleTpslCheckboxChange = useCallback(
      (checked: boolean) => {
        setHasTpsl(checked);
        if (checked) {
          const seed = buildDefaultTpSlPercent({
            tpType,
            tpValue,
            slType,
            slValue,
          });
          setTpType(seed.tpType);
          setTpValue(seed.tpValue);
          setSlType(seed.slType);
          setSlValue(seed.slValue);
        }
      },
      [slType, slValue, tpType, tpValue],
    );

    const handleSubmit = useCallback(async () => {
      if (!isFormValid || isSubmitting) {
        return;
      }
      setIsSubmitting(true);
      try {
        await actions.current.ensureTradingEnabled();
        const latestTargetData = await fetchTargetAssetData();
        const latestAssetData = latestTargetData.data;
        if (
          !isAddPositionScopeValid({
            expectedAccountAddress: accountAddress,
            currentAccountAddress: activeAccountAddressRef.current,
            coin,
            isBuy,
            currentPosition: currentPositionRef.current,
          })
        ) {
          throw new OneKeyLocalError('The position or active account changed');
        }

        const latestPrice =
          orderType === 'market' ? latestAssetData.markPx : limitPrice;
        const latestValidation = validateAddPositionOrder({
          size: amount,
          price: latestPrice,
          maxSize: latestAssetData.maxTradeSzs[isBuy ? 0 : 1],
          szDecimals: latestTargetData.szDecimals,
        });
        if (latestValidation.error) {
          throw new OneKeyLocalError(
            latestValidation.error === 'minimumOrder'
              ? intl.formatMessage(
                  { id: ETranslations.perp_order_size_small },
                  { amount: '$10' },
                )
              : 'The position increase amount is no longer available',
          );
        }

        const latestPosition = currentPositionRef.current;
        const latestLeverage = latestPosition?.leverage?.value ?? leverage;
        const { tpTriggerPx, slTriggerPx } = resolveTpSlTriggerPx({
          hasTpsl,
          tpType,
          tpValue,
          slType,
          slValue,
          referencePrice: new BigNumber(latestPrice),
          side: isBuy ? 'long' : 'short',
          leverage: latestLeverage,
        });

        await actions.current.placeOrderByCoin({
          coin,
          expectedAccountAddress: accountAddress,
          isBuy,
          size: latestValidation.size,
          price: latestPrice,
          orderType,
          tif: orderType === 'limit' ? 'Gtc' : undefined,
          tpTriggerPx,
          slTriggerPx,
        });
        onClose();
      } catch (error) {
        Toast.error({
          title:
            error instanceof Error
              ? error.message
              : intl.formatMessage({
                  id: ETranslations.perp_token_info_not_found__msg,
                }),
        });
      } finally {
        setIsSubmitting(false);
      }
    }, [
      accountAddress,
      actions,
      amount,
      coin,
      fetchTargetAssetData,
      hasTpsl,
      intl,
      isBuy,
      isFormValid,
      isSubmitting,
      limitPrice,
      leverage,
      onClose,
      orderType,
      slType,
      slValue,
      tpType,
      tpValue,
    ]);

    return (
      <YStack gap="$4">
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
                id: ETranslations.perp_trades_history_direction,
              })}
            </SizableText>
            <SizableText
              size="$bodyMdMedium"
              color={isBuy ? '$green11' : '$red11'}
            >
              {intl.formatMessage({
                id: isBuy ? ETranslations.perp_long : ETranslations.perp_short,
              })}{' '}
              {leverage}x
            </SizableText>
          </XStack>
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_position_mark_price,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {assetData?.markPx || midPrice || '--'}
            </SizableText>
          </XStack>
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.perp_trade_order_type })}
            </SizableText>
            <XStack
              testID={PerpTestIDs.AddPositionTypeToggle}
              alignItems="center"
              gap="$1"
              cursor="default"
              onPress={() =>
                setOrderType((value) =>
                  value === 'market' ? 'limit' : 'market',
                )
              }
            >
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({
                  id:
                    orderType === 'market'
                      ? ETranslations.perp_trade_market
                      : ETranslations.perp_trade_limit,
                })}
              </SizableText>
              <Icon name="RepeatOutline" size="$3.5" color="$text" />
            </XStack>
          </XStack>
        </YStack>
        <Divider />
        {orderType === 'limit' ? (
          <PriceInput
            label={intl.formatMessage({
              id: ETranslations.perp_trade_limit_pirce,
            })}
            value={limitPrice}
            onChange={setLimitPrice}
            onUseMidPrice={() =>
              setLimitPrice(formatPriceToSignificantDigits(midPrice))
            }
            disabled={!midPrice}
            szDecimals={szDecimals ?? 0}
            ifOnDialog
          />
        ) : null}
        <TradingFormInput
          testID={PerpTestIDs.AddPositionAmountInput}
          label={intl.formatMessage({
            id: ETranslations.dexmarket_details_history_amount,
          })}
          value={amount}
          onChange={setAmount}
          suffix={displayName}
          validator={(value: string) =>
            value === '' ||
            validateSizeInput(value.replace(/。/g, '.'), szDecimals ?? 0)
          }
          ifOnDialog
        />
        <Checkbox
          testID="perp-add-position-tpsl-checkbox"
          value={hasTpsl}
          onChange={(checked) => handleTpslCheckboxChange(Boolean(checked))}
          label={intl.formatMessage({
            id: ETranslations.perp_position_tp_sl,
          })}
          containerProps={{ alignItems: 'center' }}
        />
        {hasTpsl ? (
          <YStack gap="$2">
            <TpSlFormInput
              type="tp"
              label={intl.formatMessage({
                id: ETranslations.perp_trade_tp_price,
              })}
              value={tpValue}
              inputType={tpType}
              referencePrice={effectivePrice}
              szDecimals={szDecimals ?? 0}
              onChange={setTpValue}
              onTypeChange={setTpType}
            />
            <TpSlFormInput
              type="sl"
              label={intl.formatMessage({
                id: ETranslations.perp_trade_sl_price,
              })}
              value={slValue}
              inputType={slType}
              referencePrice={effectivePrice}
              szDecimals={szDecimals ?? 0}
              onChange={setSlValue}
              onTypeChange={setSlType}
            />
          </YStack>
        ) : null}
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_trading_adjust_margin_max,
            })}
          </SizableText>
          <SizableText size="$bodySmMedium">
            {maxSize} {displayName}
          </SizableText>
        </XStack>
        <TradingGuardWrapper buttonSize={PERP_DIALOG_BUTTON_SIZE}>
          <Button
            testID={PerpTestIDs.AddPositionConfirmButton}
            size={PERP_DIALOG_BUTTON_SIZE}
            variant="primary"
            disabled={!isFormValid || isSubmitting}
            loading={isSubmitting}
            onPress={handleSubmit}
          >
            {intl.formatMessage({ id: ETranslations.global_add })}
          </Button>
        </TradingGuardWrapper>
      </YStack>
    );
  },
);

AddPositionForm.displayName = 'AddPositionForm';

export function showAddPositionDialog({
  coin,
  isBuy,
  accountAddress,
  intl,
}: IAddPositionParams & { intl: IntlShape }) {
  const dialogInstance = Dialog.show({
    title: intl.formatMessage({ id: ETranslations.global_add }),
    disableDrag: true,
    renderContent: (
      <PerpsAccountSelectorProviderMirror>
        <PerpsProviderMirror>
          <AddPositionForm
            coin={coin}
            isBuy={isBuy}
            accountAddress={accountAddress}
            onClose={() => dialogInstance.close()}
          />
        </PerpsProviderMirror>
      </PerpsAccountSelectorProviderMirror>
    ),
    contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
    showFooter: false,
  });
  return dialogInstance;
}
