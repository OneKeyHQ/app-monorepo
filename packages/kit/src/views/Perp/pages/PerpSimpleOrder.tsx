import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useOverlayPageScope } from '@onekeyfe/react-native-native-overlay';
import { useNavigation, useRoute } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Button,
  Dialog,
  Icon,
  Page,
  SizableText,
  Switch,
  Toast,
  XStack,
  YStack,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import {
  type ITradingFormData,
  useActiveTradeInstrumentAtom,
  useHyperliquidActions,
  useTradingLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsSimpleDraftAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  type ISendAmountAutoSizeInputRef,
  SendAutoSizeAmountInput,
} from '@onekeyhq/kit/src/views/Send/components/SendAutoSizeAmountInput';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountSummaryAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
  usePerpsActiveAssetDataAtom,
  usePerpsCustomSettingsAtom,
  usePerpsTradingPreferencesAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { dismissKeyboardWithDelay } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalPerpRoutes,
  type IModalPerpParamList,
} from '@onekeyhq/shared/src/routes/perp';
import {
  computeMaxTradeSize,
  estimateLiquidationPrice,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid/types';

import { PerpActionButton } from '../components/PerpActionButton';
import { PerpsNativeAmountKeypad } from '../components/PerpsNativeAmountKeypad';
import { PerpsSlider } from '../components/PerpsSlider';
import { useSimpleScope } from '../components/Simple/PerpsMobileMode';
import { showSimpleLeverageDialog } from '../components/Simple/SimpleLeverageDialog';
import { SimpleMarketHeader } from '../components/Simple/SimpleMarketHeader';
import { showSimpleOrderTypeDialog } from '../components/Simple/SimpleOrderTypeDialog';
import { simplePerpsCardStyle } from '../components/Simple/simpleStyles';
import { SimpleValue } from '../components/Simple/SimpleValue';
import { TradingGuardWrapper } from '../components/TradingGuardWrapper';
import { showOrderConfirmDialog } from '../components/TradingPanel/modals/OrderConfirmModal';
import { useGetAggressiveLimitPriceWarning } from '../hooks/useAggressiveLimitPriceWarning';
import { usePerpsAccountScopedActivePositions } from '../hooks/usePerpsAccountScopedActivePositions';
import { usePerpsCrossAvailableAfterMaintenance } from '../hooks/usePerpsCrossAvailableAfterMaintenance';
import { getCurrentPerpsMarketDataFreshness } from '../hooks/usePerpsMarketDataFreshness';
import { useShowDepositWithdrawModal } from '../hooks/useShowDepositWithdrawModal';
import { useTradingPrice } from '../hooks/useTradingPrice';
import { PerpsAccountSelectorProviderMirror } from '../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../PerpsProviderMirror';
import { shouldShowOrderConfirm } from '../utils/aggressiveLimitPrice';
import { simplePrice, simpleUsd } from '../utils/simpleDisplay';
import {
  applySimpleAmountKey,
  getSimpleOrderPreview,
  getSimpleSliderAmount,
  validateSimpleAmountInput,
} from '../utils/simpleTrading';

import type { ISimpleOrderType } from '../components/Simple/SimpleOrderTypeDialog';
import type { ISimpleOrderError } from '../utils/simpleTrading';
import type { RouteProp } from '@react-navigation/native';

const ORDER_VALIDATION: Record<ISimpleOrderError, ETranslations> = {
  invalidAmount: ETranslations.defi_action_invalid_amount__msg,
  feeUnavailable: ETranslations.perp_simple_fee_unavailable__msg,
  minimumOrderValue: ETranslations.perp_simple_minimum_order_value__msg,
  insufficientMargin: ETranslations.perp_insufficient_margin__title,
};

function SimpleOrderUnitSetting({
  value: initialValue,
  onChange,
}: {
  value: 'token' | 'usd' | 'margin';
  onChange: (value: 'token' | 'usd' | 'margin') => void;
}) {
  const intl = useIntl();
  const [value, setValue] = useState(initialValue);
  const labels = {
    token: intl.formatMessage({ id: ETranslations.content__amount }),
    usd: `${intl.formatMessage({ id: ETranslations.global_value })} ($)`,
    margin: `${intl.formatMessage({ id: ETranslations.perp_cost })} ($)`,
  };
  return (
    <YStack gap="$3">
      <SizableText size="$bodyMdMedium" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.perp_size_input_title })}
      </SizableText>
      {([['token', 'usd'], ['margin']] as const).map((row) => (
        <XStack key={row[0]} gap="$3">
          {row.map((unit) => (
            <YStack key={unit} flex={1} minWidth={0}>
              <YStack
                testID={`perps-simple-unit-${unit}`}
                width="100%"
                minHeight={48}
                px="$2"
                py="$2"
                alignItems="center"
                justifyContent="center"
                borderRadius="$3"
                borderWidth={1}
                borderColor={
                  value === unit ? '$borderActive' : '$borderSubdued'
                }
                bg="$bg"
                accessibilityRole="radio"
                accessibilityState={{ checked: value === unit }}
                onPress={() => {
                  if (unit === value) return;
                  setValue(unit);
                  onChange(unit);
                }}
              >
                <SizableText
                  size="$bodyMdMedium"
                  fontWeight="600"
                  textAlign="center"
                >
                  {labels[unit]}
                </SizableText>
              </YStack>
            </YStack>
          ))}
          {row.length === 1 ? <YStack flex={1} /> : null}
        </XStack>
      ))}
    </YStack>
  );
}

function SimpleOrderConfirmationSetting() {
  const intl = useIntl();
  const [settings, setSettings] = usePerpsCustomSettingsAtom();
  return (
    <XStack alignItems="center" gap="$3" justifyContent="space-between">
      <SizableText
        size="$bodyMdMedium"
        color="$text"
        flexShrink={1}
        y={platformEnv.isNativeIOS ? 1 : 0}
      >
        {intl.formatMessage({ id: ETranslations.perp_setting_title })}
      </SizableText>
      <Switch
        testID="perps-simple-skip-order-confirm"
        size="small"
        value={settings.skipOrderConfirm}
        onChange={(value) => {
          setSettings((previous) => ({
            ...previous,
            skipOrderConfirm: value,
          }));
        }}
      />
    </XStack>
  );
}

function SimpleOrderContent() {
  const sourcePage = useOverlayPageScope();
  const themeVariant = useThemeVariant();
  const simplePageBackground =
    themeVariant === 'light' ? '$bgSubdued' : '$bgApp';
  const route =
    useRoute<
      RouteProp<IModalPerpParamList, EModalPerpRoutes.MobilePerpSimpleOrder>
    >();
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const theme = useTheme();
  const headerBackgroundColor =
    themeVariant === 'light' ? theme.bgSubdued.val : theme.bgApp.val;
  const headerStyle = useMemo(
    () => ({ backgroundColor: headerBackgroundColor }),
    [headerBackgroundColor],
  );
  const side = route.params.side;
  const sliderActiveColor =
    side === 'long' ? theme.bgAccent.val : theme.bgCriticalStrong.val;
  const intl = useIntl();
  const { width, height } = useWindowDimensions();
  const compactLayout = height < 740;
  const nativeAmountMaxFontSize = compactLayout ? 48 : 64;
  const confirmDialogRef = useRef<
    ReturnType<typeof showOrderConfirmDialog> | undefined
  >(undefined);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void confirmDialogRef.current?.close();
    };
  }, []);
  const amountInputRef = useRef<ISendAmountAutoSizeInputRef>(null);
  useEffect(() => {
    if (gtMd && !platformEnv.isNative) navigation.popStack();
  }, [gtMd, navigation]);
  const nativeNavigation = useNavigation();
  const actions = useHyperliquidActions();
  const scope = useSimpleScope();
  const [openedScope] = useState(scope);
  const [orderSettings, setOrderSettings] = useState<
    ISimpleOrderType & { scope: string }
  >({ scope, type: 'market', price: '' });
  const [draft, setDraft] = usePerpsSimpleDraftAtom();
  const [tradingPreferences, setTradingPreferences] =
    usePerpsTradingPreferencesAtom();
  const [perpsSettings, setPerpsSettings] = usePerpsCustomSettingsAtom();
  const [account] = usePerpsActiveAccountAtom();

  const [accountLoading] = usePerpsAccountLoadingInfoAtom();
  const [instrument] = useActiveTradeInstrumentAtom();
  const [asset] = usePerpsActiveAssetAtom();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const [assetData] = usePerpsActiveAssetDataAtom();
  const [summary] = usePerpsActiveAccountSummaryAtom();
  const positions = usePerpsAccountScopedActivePositions();
  const crossAvailableAfterMaintenance = usePerpsCrossAvailableAfterMaintenance(
    route.params.coin,
  );
  const [tradingSubmitting] = useTradingLoadingAtom();
  const [directSubmitting, setDirectSubmitting] = useState(false);
  const directSubmitLock = useRef(false);
  const submitting = tradingSubmitting || directSubmitting;
  const getAggressiveLimitPriceWarning = useGetAggressiveLimitPriceWarning();
  const { showDepositWithdrawModal, isDepositDisabled } =
    useShowDepositWithdrawModal('tradingPanel');
  const orderSubmittedRef = useRef(false);
  const { midPrice = '', midPriceBN } = useTradingPrice();
  const marketQuoteRef = useRef({ scope, price: midPrice });
  useEffect(() => {
    marketQuoteRef.current = { scope, price: midPrice };
  }, [scope, midPrice]);
  const coinLabel = parseDexCoin(route.params.coin).displayName;
  const orderType =
    orderSettings.scope === scope ? orderSettings.type : 'market';
  const orderPrice = orderType === 'limit' ? orderSettings.price : midPrice;
  const orderPriceBN = useMemo(() => new BigNumber(orderPrice), [orderPrice]);
  const scopedDraft =
    draft?.scope === scope && draft.side === side ? draft : undefined;
  const inputUnit =
    scopedDraft?.inputUnit ?? tradingPreferences.simpleSizeInputUnit ?? 'usd';
  const amountDecimals =
    inputUnit === 'token' ? (asset.universe?.szDecimals ?? 0) : 2;
  const leverage = assetData?.leverage.value ?? 0;
  const sizingMarkPriceBN = new BigNumber(assetData?.markPx ?? 0);
  const maxSize = computeMaxTradeSize({
    side,
    price: orderPrice,
    markPrice: assetData?.markPx,
    maxTradeSzs: assetData?.maxTradeSzs,
    leverageValue: leverage,
    szDecimals: asset.universe?.szDecimals,
  }).toFixed();
  const percent =
    scopedDraft?.source === 'percent' ? scopedDraft.sizePercent : 0;
  let amount = scopedDraft?.source === 'manual' ? scopedDraft.inputAmount : '';
  if (scopedDraft?.source === 'percent') {
    amount = getSimpleSliderAmount({
      percent,
      maxSize,
      price: orderPrice,
      leverage,
      inputUnit,
      decimals: amountDecimals,
    });
  }
  const displayedAmount =
    scopedDraft?.source === 'percent' && inputUnit !== 'token'
      ? new BigNumber(amount || 0).toFixed(amountDecimals)
      : amount || '0';
  const marginBN = new BigNumber(amount || 0)
    .times(inputUnit === 'token' ? orderPriceBN : 1)
    .div(inputUnit === 'margin' ? 1 : leverage || 1);
  const hasPositiveMargin = marginBN.isFinite() && marginBN.gt(0);
  const setAmount = (value: string) => {
    if (
      submitting ||
      !/^[0-9]*\.?[0-9]*$/.test(value) ||
      !validateSimpleAmountInput(value, amountDecimals, inputUnit, amount)
    )
      return;
    setDraft({
      scope,
      side,
      source: 'manual',
      inputAmount: value,
      inputUnit,
    });
  };
  const showSettings = () => {
    const dialog = Dialog.show({
      title: intl.formatMessage({ id: ETranslations.global_settings }),
      showFooter: false,
      contentContainerProps: { pb: '$1' },
      renderContent: (
        <YStack gap="$4">
          <SimpleOrderUnitSetting
            value={inputUnit}
            onChange={(unit) => {
              if (submitting) return;
              setTradingPreferences((prev) => ({
                ...prev,
                simpleSizeInputUnit: unit,
              }));
              setDraft({
                scope,
                side,
                source: 'manual',
                inputAmount: '',
                inputUnit: unit,
              });
            }}
          />
          <SimpleOrderConfirmationSetting />
          <Button
            testID="perps-simple-order-go-pro"
            variant="tertiary"
            size="small"
            minHeight={40}
            disabled={submitting}
            childrenAsText={false}
            iconAfter="ChevronRightSmallOutline"
            onPress={async () => {
              if (submitting) return;
              await dialog.close();
              if (!mountedRef.current || !nativeNavigation.isFocused()) return;
              setPerpsSettings((previous) => ({
                ...previous,
                mobileTradingMode: 'pro',
              }));
              navigation.popStack();
            }}
          >
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              textAlign="center"
              flexShrink={1}
            >
              {intl.formatMessage({
                id: ETranslations.perp_simple_more_order_types__desc,
              })}
            </SizableText>
          </Button>
        </YStack>
      ),
    });
  };
  const accountAddress = account.accountAddress;
  const { result: fees } = usePromiseResult(
    async () => {
      if (!accountAddress) return undefined;
      const data =
        await backgroundApiProxy.serviceHyperliquid.getMobileTradingFees({
          user: accountAddress,
        });
      return { ...data, accountAddress };
    },
    [accountAddress],
    {
      keepResultIfError: true,
      checkIsFocused: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      pollingInterval: accountAddress ? 30_000 : undefined,
      runImmediatelyOnPollingIntervalChange: true,
    },
  );
  const mode = assetData?.leverage.type;
  const position = positions.find(
    (item) => item.position.coin === route.params.coin,
  )?.position;
  const feeRate =
    fees?.accountAddress === accountAddress
      ? new BigNumber(fees.takerRate).plus(fees.builderRate).toFixed()
      : '';
  const preview = getSimpleOrderPreview({
    inputAmount: amount,
    inputUnit,
    price: orderPrice,
    leverage,
    szDecimals: asset.universe?.szDecimals ?? 0,
    maxSize,
    feeRate,
  });
  // Keep the form usable during transient disconnects; validate live market
  // data when reviewing an order, just like the professional trading panel.
  const ready =
    scope === openedScope &&
    instrument.mode === 'perp' &&
    instrument.coin === route.params.coin &&
    asset.coin === route.params.coin &&
    assetData?.coin === route.params.coin &&
    assetCtx?.coin === route.params.coin &&
    Boolean(accountAddress) &&
    assetData?.accountAddress?.toLowerCase() ===
      accountAddress?.toLowerCase() &&
    summary?.accountAddress?.toLowerCase() === accountAddress?.toLowerCase() &&
    !accountLoading.selectAccountLoading &&
    leverage > 0 &&
    sizingMarkPriceBN.isFinite() &&
    sizingMarkPriceBN.gt(0) &&
    Boolean(mode) &&
    Boolean(feeRate) &&
    midPriceBN.gt(0);
  const validation =
    ready && hasPositiveMargin && preview.error
      ? ORDER_VALIDATION[preview.error]
      : undefined;
  const validationMessage = validation
    ? intl.formatMessage({ id: validation }, { amount: '$10' })
    : undefined;
  const readinessLabel = intl.formatMessage({
    id:
      scope !== openedScope
        ? ETranslations.perp_simple_reopen_order__action
        : ETranslations.tray_loading_title,
  });
  const marginModeLabel = intl.formatMessage({
    id:
      mode === 'cross'
        ? ETranslations.perp_trade_cross
        : ETranslations.perp_trade_isolated,
  });
  const canSubmit = ready && !preview.error && !submitting;
  const showDeposit = ready && preview.error === 'insufficientMargin';
  const depositLabel = showDeposit
    ? `${validationMessage} · ${intl.formatMessage({ id: ETranslations.perp_trade_deposit })}`
    : undefined;
  const liqPrice =
    ready && mode && !preview.error
      ? estimateLiquidationPrice({
          orderSize: preview.size,
          priceMode: orderType,
          orderPrice: orderPriceBN,
          markPrice: new BigNumber(assetCtx?.ctx?.markPrice ?? midPrice),
          side,
          leverage,
          marginMode: mode,
          marginTiers: asset.margin?.marginTiers,
          maxLeverage: asset.universe?.maxLeverage ?? 1,
          existingPositionSize: new BigNumber(position?.szi ?? 0),
          isolatedRawUsd:
            position?.leverage?.type === 'isolated'
              ? new BigNumber(position.leverage.rawUsd)
              : undefined,
          crossAvailableAfterMaintenance,
        })
      : null;
  useEffect(
    () =>
      nativeNavigation.addListener('beforeRemove', (event) => {
        if (submitting && !orderSubmittedRef.current) {
          event.preventDefault();
        }
      }),
    [nativeNavigation, submitting],
  );
  const directionLabel = intl.formatMessage({
    id: side === 'long' ? ETranslations.perp_long : ETranslations.perp_short,
  });
  const previousPrice = new BigNumber(assetCtx?.ctx?.prevDayPrice ?? 0);
  const change =
    assetCtx?.coin === route.params.coin &&
    previousPrice.gt(0) &&
    midPriceBN.gt(0)
      ? midPriceBN.minus(previousPrice).div(previousPrice).times(100)
      : undefined;
  const changeLabel = change?.isFinite()
    ? `${change.gte(0) ? '+' : ''}${change.toFixed(2)}%`
    : '--';
  const directionColor = change?.gte(0) ? '$textSuccess' : '$textCritical';
  const changeColor = change?.isFinite() ? directionColor : '$textSubdued';
  const headerWidth = Math.max(100, Math.min(264, width - 152));
  const openTokenSelector = useCallback(() => {
    if (submitting || directSubmitLock.current || confirmDialogRef.current)
      return;
    amountInputRef.current?.blur();
    void dismissKeyboardWithDelay();
    navigation.push(EModalPerpRoutes.MobileTokenSelector);
  }, [navigation, submitting]);
  const renderHeaderTitle = useCallback(
    () => (
      <SimpleMarketHeader
        testID="perps-simple-order-token-selector"
        coin={route.params.coin}
        width={headerWidth}
        price={midPriceBN.gt(0) ? simplePrice(midPrice) : '--'}
        changeLabel={changeLabel}
        changeColor={changeColor}
        onPress={openTokenSelector}
      />
    ),
    [
      headerWidth,
      route.params.coin,
      midPrice,
      midPriceBN,
      changeLabel,
      changeColor,
      openTokenSelector,
    ],
  );
  const reviewOrder = async () => {
    if (!canSubmit || confirmDialogRef.current || directSubmitLock.current) {
      return;
    }
    if (!getCurrentPerpsMarketDataFreshness().isReady) {
      Toast.error({
        title: intl.formatMessage({ id: ETranslations.perp_offline }),
        message: intl.formatMessage({ id: ETranslations.perps_offline_moblie }),
      });
      return;
    }
    amountInputRef.current?.blur();
    void dismissKeyboardWithDelay();
    const formData: ITradingFormData = {
      side,
      type: orderType,
      orderMode: 'standard',
      price: orderPrice,
      size: preview.size.toFixed(),
      sizeInputMode: EPerpsSizeInputMode.MANUAL,
      sizePercent: 0,
      leverage,
      hasTpsl: false,
      tpTriggerPx: '',
      slTriggerPx: '',
      tpGainPercent: '',
      slLossPercent: '',
    };
    const onOrderSuccess = () => {
      orderSubmittedRef.current = true;
      setDraft((current) => (current?.scope === scope ? undefined : current));
      void actions.current.refreshAllPerpsData();
      if (
        !mountedRef.current ||
        marketQuoteRef.current.scope !== scope ||
        !nativeNavigation.isFocused()
      ) {
        return;
      }
      const state = nativeNavigation.getState();
      const previousRoute = state?.routes[(state?.index ?? 0) - 1];
      if (previousRoute?.name === EModalPerpRoutes.MobilePerpSimpleMarket) {
        navigation.pop();
      } else {
        navigation.replace(EModalPerpRoutes.MobilePerpSimpleMarket, {
          coin: route.params.coin,
        });
      }
    };
    const aggressiveLimitPriceWarning = getAggressiveLimitPriceWarning({
      coin: route.params.coin,
      formData,
      side,
      price: orderPrice,
    });
    if (
      !shouldShowOrderConfirm({
        skipOrderConfirm: perpsSettings.skipOrderConfirm,
        aggressiveLimitPriceWarning,
      })
    ) {
      if (instrument.assetId === undefined) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.perp_token_info_not_found__msg,
          }),
        });
        return;
      }
      directSubmitLock.current = true;
      setDirectSubmitting(true);
      try {
        await actions.current.submitOrder({
          assetId: instrument.assetId,
          expectedAccountAddress: accountAddress,
          formData,
          price: orderPrice,
        });
        onOrderSuccess();
      } catch {
        // submitOrder surfaces errors with a toast; keep the draft for retry.
      } finally {
        directSubmitLock.current = false;
        if (mountedRef.current) setDirectSubmitting(false);
      }
      return;
    }
    confirmDialogRef.current = showOrderConfirmDialog({
      sourcePage,
      intl,
      expectedCoin: route.params.coin,
      expectedAccountAddress: accountAddress,
      formData,
      price: orderPrice,
      aggressiveLimitPriceWarning,
      liquidationPriceOverride: liqPrice?.gt(0) ? simplePrice(liqPrice) : '--',
      onConfirmSuccess: onOrderSuccess,
      onDismiss: () => {
        confirmDialogRef.current = undefined;
      },
    });
  };
  const leverageControl = (
    <Button
      testID="perps-simple-leverage"
      variant="accent"
      borderRadius="$full"
      size="small"
      minHeight={28}
      px="$2"
      py="$0.5"
      hitSlop={8}
      mx="$0"
      my="$0"
      disabled={submitting}
      onPress={() => {
        if (!ready || asset.assetId === undefined || !accountAddress || !mode)
          return;
        showSimpleLeverageDialog(
          {
            coin: route.params.coin,
            accountAddress,
            assetId: asset.assetId,
            leverage,
            mode,
            maxLeverage: asset.universe?.maxLeverage ?? 1,
            onlyIsolated: Boolean(asset.universe?.onlyIsolated),
          },
          intl,
        );
      }}
      childrenAsText={false}
    >
      <SizableText size="$bodyMdMedium" color="$textInverse">
        {mode && leverage > 0 ? `${marginModeLabel} ${leverage}×` : '--'}
      </SizableText>
      <Icon
        name="ChevronTriangleDownSmallSolid"
        size="$3"
        color="$iconInverse"
        ml="$1"
      />
    </Button>
  );
  const setPercent = (value: number) => {
    if (submitting) return;
    setDraft({
      scope,
      side,
      inputUnit,
      source: 'percent',
      sizePercent: Number.isFinite(value)
        ? Math.max(0, Math.min(100, value))
        : 0,
    });
  };
  return (
    <Page backgroundColor={simplePageBackground}>
      <Page.Header
        headerStyle={headerStyle}
        headerContainerBackgroundColor={headerBackgroundColor}
        title={`${directionLabel} ${coinLabel}`}
        headerTitle={renderHeaderTitle}
        headerRight={() => (
          <HeaderIconButton
            icon="SettingsOutline"
            title={intl.formatMessage({ id: ETranslations.global_settings })}
            onPress={showSettings}
            disabled={submitting}
            testID="perps-simple-order-settings"
          />
        )}
      />
      <Page.Body minHeight={0}>
        <YStack flex={1} minHeight={0} px="$5" pt={compactLayout ? '$2' : '$3'}>
          <YStack flex={1} gap={compactLayout ? '$2' : '$4'}>
            <YStack
              flex={1}
              minHeight={compactLayout ? 104 : 144}
              justifyContent="center"
              gap={compactLayout ? '$1' : '$2'}
            >
              <SendAutoSizeAmountInput
                ref={amountInputRef}
                testID="perps-simple-amount"
                inlineTextAlignMode="center"
                value={platformEnv.isNative ? displayedAmount : amount}
                maxFontSize={
                  platformEnv.isNative ? nativeAmountMaxFontSize : undefined
                }
                tokenSymbol={inputUnit === 'token' ? coinLabel : undefined}
                onChange={(value) => setAmount(value)}
                validator={(value) =>
                  validateSimpleAmountInput(
                    value,
                    amountDecimals,
                    inputUnit,
                    amount,
                  )
                }
                inputProps={{
                  editable: !platformEnv.isNative && !submitting,
                  keyboardType: 'decimal-pad',
                  leftAddOnProps:
                    inputUnit === 'token' ? undefined : { label: '$' },
                }}
              />
              <XStack
                justifyContent="center"
                alignItems="center"
                gap="$2"
                flexWrap="wrap"
              >
                {leverageControl}
              </XStack>
            </YStack>
            <YStack
              {...simplePerpsCardStyle}
              borderRadius="$4"
              px="$4"
              py={compactLayout ? '$2' : '$3'}
              gap="$0"
            >
              <SimpleValue
                compact
                label={intl.formatMessage({
                  id: ETranslations.perp_trade_order_type,
                })}
                value={
                  orderType === 'market'
                    ? intl.formatMessage({
                        id: ETranslations.perp_position_market,
                      })
                    : `${intl.formatMessage({ id: ETranslations.perp_position_limit })} ${simplePrice(orderPrice)}`
                }
                testID="perps-simple-order-type"
                disabled={submitting || scope !== openedScope}
                onPress={() =>
                  showSimpleOrderTypeDialog(
                    {
                      side,
                      value: {
                        type: orderType,
                        price:
                          orderSettings.scope === scope
                            ? orderSettings.price
                            : '',
                      },
                      marketPrice: midPrice,
                      getMarketPrice: () =>
                        marketQuoteRef.current.scope === scope
                          ? marketQuoteRef.current.price
                          : '',
                      szDecimals: asset.universe?.szDecimals ?? 0,
                      onConfirm: (value) => {
                        if (!mountedRef.current) return;
                        setOrderSettings({ ...value, scope });
                      },
                    },
                    intl,
                  )
                }
              />
              <SimpleValue
                compact
                singleLine
                label={intl.formatMessage({
                  id: ETranslations.perp_size_input_usd_order_size,
                })}
                value={
                  ready && preview.value.isFinite() && hasPositiveMargin
                    ? simpleUsd(preview.value)
                    : '--'
                }
              />
              <SimpleValue
                compact
                label={intl.formatMessage({
                  id: ETranslations.perp_est_liq_price,
                })}
                value={liqPrice?.gt(0) ? simplePrice(liqPrice) : '--'}
              />
            </YStack>
            <YStack gap="$1">
              <PerpsSlider
                activeColor={sliderActiveColor}
                appearance="dotted"
                value={Number.isFinite(percent) ? percent : 0}
                onChange={setPercent}
                min={0}
                max={100}
                segments={4}
                snapTapToSegment
                showBubble
                disabled={!ready || submitting}
              />
            </YStack>
          </YStack>
        </YStack>
      </Page.Body>
      <Page.Footer>
        <YStack
          px="$5"
          pt={compactLayout ? '$1' : '$2'}
          pb={compactLayout ? '$2' : '$3'}
          gap={compactLayout ? '$1' : '$2'}
        >
          {platformEnv.isNative ? (
            <PerpsNativeAmountKeypad
              compact={compactLayout}
              hideCta
              disabled={submitting}
              onKeyPress={(key) => setAmount(applySimpleAmountKey(amount, key))}
              onBackspaceLongPress={() => setAmount('')}
              ctaLabel={intl.formatMessage({ id: ETranslations.global_review })}
              onCtaPress={reviewOrder}
            />
          ) : null}
          <YStack height={48} minHeight={48} flexShrink={0}>
            <TradingGuardWrapper buttonSize="large">
              <PerpActionButton
                testID={
                  validationMessage
                    ? 'perps-simple-validation'
                    : 'perps-simple-submit'
                }
                size="medium"
                height={48}
                minHeight={48}
                variant={
                  showDeposit || side === 'long' ? 'accent' : 'destructive'
                }
                borderRadius="$full"
                disabled={
                  showDeposit ? submitting || isDepositDisabled : !canSubmit
                }
                loading={submitting}
                accessibilityLabel={depositLabel || validationMessage}
                onPress={
                  showDeposit
                    ? () => showDepositWithdrawModal('deposit')
                    : reviewOrder
                }
              >
                {depositLabel ||
                  validationMessage ||
                  (ready ? `${directionLabel} ${coinLabel}` : readinessLabel)}
              </PerpActionButton>
            </TradingGuardWrapper>
          </YStack>
        </YStack>
      </Page.Footer>
    </Page>
  );
}

export default function PerpSimpleOrder() {
  const route =
    useRoute<
      RouteProp<IModalPerpParamList, EModalPerpRoutes.MobilePerpSimpleOrder>
    >();
  return (
    <PerpsAccountSelectorProviderMirror>
      <PerpsProviderMirror>
        <SimpleOrderContent key={route.params.coin} />
      </PerpsProviderMirror>
    </PerpsAccountSelectorProviderMirror>
  );
}
