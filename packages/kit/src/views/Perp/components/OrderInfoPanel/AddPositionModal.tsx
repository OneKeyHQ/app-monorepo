import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { type IntlShape, useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  DashText,
  Dialog,
  Divider,
  Icon,
  NumberSizeableText,
  SizableText,
  Toast,
  XStack,
  YStack,
  getFontSize,
  useKeyboardHeight,
} from '@onekeyhq/components';
import type { IInputRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useConnectionStateAtom,
  useHyperliquidActions,
  usePerpsAllMidsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { IPerpsActiveAssetAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountSummaryAtom,
  usePerpsTradingPreferencesAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  calculateLiquidationPrice,
  formatPriceToSignificantDigits,
  parseDexCoin,
  resolveTradingSize,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid';
import type {
  IActiveAssetData,
  IHex,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useCoinOrderBookTop } from '../../hooks/useCoinOrderBookTop';
import { usePerpsAccountScopedActivePositions } from '../../hooks/usePerpsAccountScopedActivePositions';
import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';
import { PerpTestIDs } from '../../testIDs';
import { getAggressiveLimitPriceWarning } from '../../utils/aggressiveLimitPrice';
import { resolveTpSlTriggerPx } from '../../utils/resolveTpSlTriggerPx';
import { buildDefaultTpSlPercent } from '../../utils/tpslSeed';
import {
  PERP_DIALOG_BUTTON_SIZE,
  PERP_KEYBOARD_AWARE_DIALOG_CONTENT_CONTAINER_PROPS,
} from '../PerpDialogLayout';
import { PerpKeyboardAwareDialogContent } from '../PerpKeyboardAwareDialogContent';
import { PerpsSlider } from '../PerpsSlider';
import { TradingGuardWrapper } from '../TradingGuardWrapper';
import { PriceInput } from '../TradingPanel/inputs/PriceInput';
import {
  type ISizeInputMinimumOrderAction,
  SizeInput,
  getMinimumOrderToastActionProps,
} from '../TradingPanel/inputs/SizeInput';
import { TpSlFormInput } from '../TradingPanel/inputs/TpSlFormInput';
import { AggressiveLimitPriceWarning } from '../TradingPanel/modals/AggressiveLimitPriceWarning';

import {
  buildAddPositionMinimumAmountLabel,
  computeAddPositionMaxSize,
  isAddPositionAssetDataScoped,
  isAddPositionScopeValid,
  validateAddPositionOrder,
} from './utils/addPosition';

import type { IAddPositionValidationError } from './utils/addPosition';

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
    const keyboardHeight = useKeyboardHeight();
    const actions = useHyperliquidActions();
    const [activeAccount] = usePerpsActiveAccountAtom();
    const [{ isConnected }] = useConnectionStateAtom();
    const [accountSummary] = usePerpsActiveAccountSummaryAtom();
    const [tradingPreferences] = usePerpsTradingPreferencesAtom();
    const sizeInputUnit = tradingPreferences.sizeInputUnit ?? 'usd';
    const tpslButtonPaddingTop = keyboardHeight > 0 ? 0 : '$4';
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
    const [sizeInputMode, setSizeInputMode] = useState<EPerpsSizeInputMode>(
      EPerpsSizeInputMode.MANUAL,
    );
    const [sizePercent, setSizePercent] = useState(0);
    const [limitPrice, setLimitPrice] = useState('');
    const [hasTpsl, setHasTpsl] = useState(false);
    const [tpType, setTpType] = useState<'price' | 'percentage'>('price');
    const [tpValue, setTpValue] = useState('');
    const [slType, setSlType] = useState<'price' | 'percentage'>('price');
    const [slValue, setSlValue] = useState('');
    const [assetData, setAssetData] = useState<IActiveAssetData>();
    const [targetAsset, setTargetAsset] = useState<IPerpsActiveAssetAtom>();
    const [isLoadingAssetData, setIsLoadingAssetData] = useState(true);
    const [hasAssetDataError, setHasAssetDataError] = useState(false);
    const [assetDataRetryNonce, setAssetDataRetryNonce] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const orderBookTop = useCoinOrderBookTop(coin);
    const requestIdRef = useRef(0);
    const isLimitPriceInitializedRef = useRef(false);
    const sizeInputRef = useRef<IInputRef>(null);
    const minimumOrderActionRef = useRef<
      ISizeInputMinimumOrderAction | undefined
    >(undefined);

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
        symbolMeta.coin !== coin ||
        symbolMeta.universe?.szDecimals === undefined
      ) {
        throw new OneKeyLocalError(
          intl.formatMessage({
            id: ETranslations.target_market_data_changed__msg,
          }),
        );
      }
      return {
        data,
        targetAsset: {
          coin: symbolMeta.coin,
          assetId: symbolMeta.assetId,
          universe: symbolMeta.universe,
          margin: symbolMeta.marginTable,
        } satisfies IPerpsActiveAssetAtom,
      };
    }, [accountAddress, coin, intl]);

    useEffect(() => {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      let disposed = false;
      setIsLoadingAssetData(true);
      void fetchTargetAssetData()
        .then((result) => {
          if (!disposed && requestId === requestIdRef.current) {
            setAssetData(result.data);
            setTargetAsset(result.targetAsset);
            setHasAssetDataError(false);
          }
        })
        .catch(() => {
          if (!disposed && requestId === requestIdRef.current) {
            setAssetData(undefined);
            setTargetAsset(undefined);
            setHasAssetDataError(true);
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
    }, [fetchTargetAssetData, assetDataRetryNonce]);

    // Opening this dialog offline leaves the target asset unresolved, and the
    // fetch above only re-runs on a coin/account change — so without this the
    // dialog stays permanently unusable even after the socket comes back.
    const wasConnectedRef = useRef(isConnected);
    useEffect(() => {
      const reconnected = isConnected && !wasConnectedRef.current;
      wasConnectedRef.current = isConnected;
      if (reconnected && hasAssetDataError) {
        setAssetDataRetryNonce((nonce) => nonce + 1);
      }
    }, [hasAssetDataError, isConnected]);

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
    const effectivePrice = orderType === 'market' ? midPrice : limitPrice;
    const szDecimals = targetAsset?.universe?.szDecimals;
    const maxSize = useMemo(
      () =>
        computeAddPositionMaxSize({
          isBuy,
          orderType,
          limitPrice,
          markPrice: assetData?.markPx,
          maxTradeSzs: assetData?.maxTradeSzs,
          leverage,
          szDecimals,
        }),
      [
        assetData?.markPx,
        assetData?.maxTradeSzs,
        isBuy,
        leverage,
        limitPrice,
        orderType,
        szDecimals,
      ],
    );
    const sizeInputAsset = useMemo<IPerpsActiveAssetAtom>(
      () =>
        targetAsset ?? {
          coin,
          assetId: undefined,
          universe: undefined,
          margin: undefined,
        },
      [coin, targetAsset],
    );
    const isTargetAssetReady = Boolean(
      !isLoadingAssetData &&
      targetAsset?.coin === coin &&
      targetAsset.assetId !== undefined &&
      szDecimals !== undefined &&
      isAddPositionAssetDataScoped({ data: assetData, coin, accountAddress }),
    );
    const aggressiveLimitPriceWarning = useMemo(
      () =>
        orderType === 'limit'
          ? getAggressiveLimitPriceWarning({
              side: isBuy ? 'long' : 'short',
              limitPrice,
              bestBid: orderBookTop.bestBid,
              bestAsk: orderBookTop.bestAsk,
            })
          : undefined,
      [
        isBuy,
        limitPrice,
        orderBookTop.bestAsk,
        orderBookTop.bestBid,
        orderType,
      ],
    );
    const resolvedSize = useMemo(
      () =>
        resolveTradingSize({
          sizeInputMode,
          manualSize: amount,
          sizePercent,
          side: isBuy ? 'long' : 'short',
          maxSize,
          szDecimals,
        }),
      [amount, isBuy, maxSize, sizeInputMode, sizePercent, szDecimals],
    );

    // Margin this add consumes, and where the position would be liquidated once
    // it fills. Both are previews of the position AFTER the add, so the
    // liquidation price blends the existing position with the new size.
    const addPositionPreview = useMemo(() => {
      const sizeBN = new BigNumber(resolvedSize || 0);
      const priceBN = new BigNumber(effectivePrice || 0);
      if (
        !sizeBN.isFinite() ||
        sizeBN.lte(0) ||
        !priceBN.isFinite() ||
        priceBN.lte(0)
      ) {
        return { marginRequired: null, liquidationPrice: null };
      }

      const totalValue = sizeBN.multipliedBy(priceBN);
      const safeLeverage = leverage > 0 ? leverage : 1;
      const marginRequired = totalValue.dividedBy(safeLeverage);

      const marginMode = assetData?.leverage?.type;
      const maxLeverage = targetAsset?.universe?.maxLeverage;
      if (!marginMode || !maxLeverage) {
        return { marginRequired, liquidationPrice: null };
      }

      const side = isBuy ? 'long' : 'short';
      const liquidationPrice = calculateLiquidationPrice({
        totalValue,
        referencePrice: priceBN,
        // An aggressive limit fills near the mark, so the preview must
        // converge on it instead of the extreme limit price — mirrors
        // useLiquidationPrice and the chart limit ticket.
        clampToCurrentMark: true,
        markPrice: assetData?.markPx
          ? new BigNumber(assetData.markPx)
          : undefined,
        positionSize: sizeBN,
        side,
        leverage: safeLeverage,
        mode: marginMode,
        marginTiers: targetAsset?.margin?.marginTiers,
        maxLeverage,
        crossMarginUsed: new BigNumber(accountSummary?.crossAccountValue || 0),
        crossMaintenanceMarginUsed: new BigNumber(
          accountSummary?.crossMaintenanceMarginUsed || 0,
        ),
        existingPositionSize: currentPosition
          ? new BigNumber(currentPosition.szi)
          : undefined,
        existingEntryPrice: currentPosition
          ? new BigNumber(currentPosition.entryPx)
          : undefined,
        newOrderSide: side,
      });

      return {
        marginRequired,
        liquidationPrice:
          liquidationPrice && liquidationPrice.gt(0) ? liquidationPrice : null,
      };
    }, [
      accountSummary?.crossAccountValue,
      accountSummary?.crossMaintenanceMarginUsed,
      assetData?.leverage?.type,
      assetData?.markPx,
      currentPosition,
      effectivePrice,
      isBuy,
      leverage,
      resolvedSize,
      targetAsset?.margin?.marginTiers,
      targetAsset?.universe?.maxLeverage,
    ]);

    const handleManualSizeChange = useCallback((value: string) => {
      setAmount(value);
      setSizeInputMode(EPerpsSizeInputMode.MANUAL);
      setSizePercent(0);
    }, []);

    const handleSliderPercentChange = useCallback((value: number) => {
      const percent = Number.isFinite(value) ? value : 0;
      setSizeInputMode(EPerpsSizeInputMode.SLIDER);
      setSizePercent(Math.max(0, Math.min(100, percent)));
      setAmount('');
    }, []);

    const switchToManual = useCallback(() => {
      if (sizeInputMode !== EPerpsSizeInputMode.SLIDER) {
        return;
      }
      setSizeInputMode(EPerpsSizeInputMode.MANUAL);
      setSizePercent(0);
      setAmount('');
    }, [sizeInputMode]);

    const requestSizeInputFocus = useCallback(() => {
      if (!platformEnv.isNative) return;
      requestAnimationFrame(() => sizeInputRef.current?.focus());
    }, []);

    // Size problems keep the button pressable and surface a toast on press,
    // matching the main trading panel instead of silently disabling it.
    const showValidationToast = useCallback(
      ({
        error,
        price,
        decimals,
      }: {
        error: IAddPositionValidationError;
        price: string;
        decimals: number;
      }) => {
        if (error === 'invalidPrice') {
          Toast.message({
            title: intl.formatMessage({
              id: ETranslations.perp_trade_price_place_holder,
            }),
          });
          return;
        }
        if (error === 'insufficientMargin') {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.perp_insufficient_margin__title,
            }),
          });
          return;
        }
        const minimumOrderAction = minimumOrderActionRef.current;
        Toast.message({
          title: intl.formatMessage(
            { id: ETranslations.perp_size_least },
            {
              amount: buildAddPositionMinimumAmountLabel({
                price,
                szDecimals: decimals,
                sizeInputUnit,
                leverage,
                symbol: displayName,
              }),
            },
          ),
          ...getMinimumOrderToastActionProps(
            minimumOrderAction,
            intl.formatMessage({
              id: ETranslations.fill_minimum_amount__action,
            }),
          ),
        });
        requestSizeInputFocus();
      },
      [displayName, intl, leverage, requestSizeInputFocus, sizeInputUnit],
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
      if (isSubmitting) {
        return;
      }
      // The market data this ticket needs failed to load (typically offline).
      // Say so and retry instead of leaving a dead button, matching how the size
      // validations below keep the button pressable and explain themselves.
      if (hasAssetDataError) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.target_market_data_changed__msg,
          }),
        });
        setAssetDataRetryNonce((nonce) => nonce + 1);
        return;
      }
      if (!isTargetAssetReady) {
        return;
      }
      if (!isScopeValid) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.position_or_account_changed__msg,
          }),
        });
        return;
      }
      const localValidation = validateAddPositionOrder({
        size: resolvedSize,
        price: effectivePrice,
        maxSize,
        szDecimals: szDecimals ?? 0,
      });
      if (localValidation.error) {
        showValidationToast({
          error: localValidation.error,
          price: effectivePrice,
          decimals: szDecimals ?? 0,
        });
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
          throw new OneKeyLocalError(
            intl.formatMessage({
              id: ETranslations.position_or_account_changed__msg,
            }),
          );
        }

        const latestPrice =
          orderType === 'market' ? latestAssetData.markPx : limitPrice;
        const latestSzDecimals =
          latestTargetData.targetAsset.universe?.szDecimals ?? 0;
        const latestPositionSnapshot = currentPositionRef.current;
        const latestMaxSize = computeAddPositionMaxSize({
          isBuy,
          orderType,
          limitPrice,
          markPrice: latestAssetData.markPx,
          maxTradeSzs: latestAssetData.maxTradeSzs,
          leverage: latestPositionSnapshot?.leverage?.value ?? leverage,
          szDecimals: latestSzDecimals,
        });
        // Re-resolve slider sizes against the refreshed max so a 100% drag
        // cannot fall out of range while the dialog was open.
        const latestSize = resolveTradingSize({
          sizeInputMode,
          manualSize: amount,
          sizePercent,
          side: isBuy ? 'long' : 'short',
          maxSize: latestMaxSize,
          szDecimals: latestSzDecimals,
        });
        const latestValidation = validateAddPositionOrder({
          size: latestSize,
          price: latestPrice,
          maxSize: latestMaxSize,
          szDecimals: latestSzDecimals,
        });
        if (latestValidation.error) {
          showValidationToast({
            error: latestValidation.error,
            price: latestPrice,
            decimals: latestSzDecimals,
          });
          return;
        }

        const latestPosition = latestPositionSnapshot;
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
          szDecimals: latestSzDecimals,
        });

        const orderParams = {
          coin,
          expectedAccountAddress: accountAddress,
          isBuy,
          size: latestValidation.size,
          price: latestPrice,
          orderType,
          tif: orderType === 'limit' ? 'Gtc' : undefined,
          tpTriggerPx,
          slTriggerPx,
        } as const;
        try {
          await actions.current.placeOrderByCoin(orderParams);
          onClose();
        } catch {
          // placeOrderByCoin already reports the failure through withToast,
          // which localizes the HyperLiquid rejection; toasting error.message
          // here repeated the same rejection in raw English.
        }
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
      effectivePrice,
      fetchTargetAssetData,
      hasAssetDataError,
      hasTpsl,
      intl,
      isBuy,
      isScopeValid,
      isSubmitting,
      isTargetAssetReady,
      limitPrice,
      leverage,
      maxSize,
      onClose,
      orderType,
      resolvedSize,
      showValidationToast,
      sizeInputMode,
      sizePercent,
      slType,
      slValue,
      szDecimals,
      tpType,
      tpValue,
    ]);

    return (
      <YStack gap="$4">
        {aggressiveLimitPriceWarning ? (
          <AggressiveLimitPriceWarning warning={aggressiveLimitPriceWarning} />
        ) : null}

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
            disabled={!midPrice}
            szDecimals={szDecimals ?? 0}
            ifOnDialog
          />
        ) : null}
        <SizeInput
          testID={PerpTestIDs.AddPositionAmountInput}
          referencePrice={effectivePrice}
          side={isBuy ? 'long' : 'short'}
          activeAsset={sizeInputAsset}
          isAssetCtxReady={isTargetAssetReady}
          symbol={displayName}
          value={amount}
          onChange={handleManualSizeChange}
          sizeInputMode={sizeInputMode}
          sliderPercent={sizePercent}
          onRequestManualMode={switchToManual}
          leverage={leverage}
          allowMarginInput
          ifOnDialog
          inputRef={sizeInputRef}
          minimumOrderActionRef={minimumOrderActionRef}
        />
        <YStack gap="$1.5">
          <PerpsSlider
            min={0}
            max={100}
            value={
              sizeInputMode === EPerpsSizeInputMode.SLIDER ? sizePercent : 0
            }
            onChange={handleSliderPercentChange}
            disabled={isSubmitting || !isTargetAssetReady}
            segments={4}
            snapTapToSegment
            showBubble={false}
            sliderHeight={4}
          />
          <YStack gap="$2">
            <Checkbox
              testID="perp-add-position-tpsl-checkbox"
              value={hasTpsl}
              onChange={(checked) => handleTpslCheckboxChange(Boolean(checked))}
              label={intl.formatMessage({
                id: ETranslations.perp_position_tp_sl,
              })}
              labelProps={{
                fontSize: getFontSize('$bodyMd'),
                color: '$textSubdued',
              }}
              containerProps={{ alignItems: 'center' }}
              width="$4"
              height="$4"
            />
            {hasTpsl ? (
              <YStack gap="$4">
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
          </YStack>
        </YStack>
        <YStack gap="$2">
          <XStack justifyContent="space-between">
            <DashText
              size="$bodySm"
              color="$textSubdued"
              dashThickness={0.3}
              tooltip={intl.formatMessage({
                id: ETranslations.perp_trade_margin_tooltip,
              })}
              tooltipDisplayMode="popover"
              tooltipTitle={intl.formatMessage({
                id: ETranslations.perp_trade_margin_required,
              })}
            >
              {intl.formatMessage({ id: ETranslations.perp_cost })}
            </DashText>
            {addPositionPreview.marginRequired ? (
              <NumberSizeableText
                size="$bodySm"
                color="$text"
                formatter="value"
                formatterOptions={{ currency: '$' }}
              >
                {addPositionPreview.marginRequired.toFixed()}
              </NumberSizeableText>
            ) : (
              <SizableText size="$bodySm" color="$textSubdued">
                --
              </SizableText>
            )}
          </XStack>

          <XStack justifyContent="space-between">
            <DashText
              size="$bodySm"
              color="$textSubdued"
              dashThickness={0.5}
              tooltip={intl.formatMessage({
                id: ETranslations.perp_est_liq_price_tooltip,
              })}
              tooltipDisplayMode="popover"
              tooltipTitle={intl.formatMessage({
                id: ETranslations.perp_est_liq_price,
              })}
            >
              {intl.formatMessage({ id: ETranslations.perp_est_liq_price })}
            </DashText>
            {addPositionPreview.liquidationPrice ? (
              <NumberSizeableText
                size="$bodySm"
                color="$text"
                formatter="price"
                formatterOptions={{ currency: '$' }}
              >
                {addPositionPreview.liquidationPrice.toFixed()}
              </NumberSizeableText>
            ) : (
              <SizableText size="$bodySm" color="$textSubdued">
                --
              </SizableText>
            )}
          </XStack>
        </YStack>
        <YStack pt={hasTpsl ? tpslButtonPaddingTop : undefined}>
          <TradingGuardWrapper buttonSize={PERP_DIALOG_BUTTON_SIZE}>
            <Button
              testID={PerpTestIDs.AddPositionConfirmButton}
              size={PERP_DIALOG_BUTTON_SIZE}
              variant="primary"
              // Stays pressable on a load failure so the press can explain
              // itself and retry, instead of leaving a dead button after
              // going offline.
              disabled={
                isSubmitting || (!isTargetAssetReady && !hasAssetDataError)
              }
              loading={isSubmitting}
              onPress={handleSubmit}
            >
              {intl.formatMessage({
                id: ETranslations.perp_confirm_order_action,
              })}
            </Button>
          </TradingGuardWrapper>
        </YStack>
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
}: IAddPositionParams & {
  intl: IntlShape;
}) {
  const dialogInstance = Dialog.show({
    title: intl.formatMessage({
      id: ETranslations.add_position__title,
    }),
    disableDrag: true,
    renderContent: (
      <PerpsAccountSelectorProviderMirror>
        <PerpsProviderMirror>
          <PerpKeyboardAwareDialogContent>
            <AddPositionForm
              coin={coin}
              isBuy={isBuy}
              accountAddress={accountAddress}
              onClose={() => dialogInstance.close()}
            />
          </PerpKeyboardAwareDialogContent>
        </PerpsProviderMirror>
      </PerpsAccountSelectorProviderMirror>
    ),
    contentContainerProps: PERP_KEYBOARD_AWARE_DIALOG_CONTENT_CONTAINER_PROPS,
    showFooter: false,
  });
  return dialogInstance;
}
