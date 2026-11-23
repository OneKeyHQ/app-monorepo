import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useOverlayPageScope } from '@onekeyfe/react-native-native-overlay';
import {
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  Button,
  Dialog,
  Haptics,
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
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import {
  type ITradingFormData,
  useActiveTradeInstrumentAtom,
  useHyperliquidActions,
  useTradingLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsSimpleDraftAtom,
  usePerpsSimplePendingLeverageAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  type ISendAmountAutoSizeInputRef,
  SendAutoSizeAmountInput,
} from '@onekeyhq/kit/src/views/Send/components/SendAutoSizeAmountInput';
import {
  perpsCustomSettingsAtom,
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountSummaryAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
  usePerpsActiveAssetDataAtom,
  usePerpsCommonConfigPersistAtom,
  usePerpsCustomSettingsAtom,
  usePerpsTradingPreferencesAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { dismissKeyboardWithDelay } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalPerpRoutes,
  type IModalPerpParamList,
} from '@onekeyhq/shared/src/routes/perp';
import {
  computeMaxTradeSize,
  estimateLiquidationPrice,
  getValidPerpsPrice,
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
import { getPerpsMinimumOrderSuggestion } from '../components/TradingPanel/inputs/sizeInputConversion';
import { showOrderConfirmDialog } from '../components/TradingPanel/modals/OrderConfirmModal';
import { useGetAggressiveLimitPriceWarning } from '../hooks/useAggressiveLimitPriceWarning';
import { usePerpsAccountScopedActivePositions } from '../hooks/usePerpsAccountScopedActivePositions';
import { usePerpsCrossAvailableAfterMaintenance } from '../hooks/usePerpsCrossAvailableAfterMaintenance';
import { getCurrentPerpsMarketDataFreshness } from '../hooks/usePerpsMarketDataFreshness';
import { isPerpsSimpleModeAvailable } from '../hooks/usePerpsTradingUiMode';
import { useShowDepositWithdrawModal } from '../hooks/useShowDepositWithdrawModal';
import { useSimpleMarketFocus } from '../hooks/useSimpleMarketFocus';
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
import { getTradingButtonStyleProps } from '../utils/styleUtils';

import type { ISimpleOrderType } from '../components/Simple/SimpleOrderTypeDialog';
import type { ISimpleOrderError } from '../utils/simpleTrading';
import type { RouteProp } from '@react-navigation/native';

const ORDER_VALIDATION: Record<ISimpleOrderError, ETranslations> = {
  invalidAmount: ETranslations.defi_action_invalid_amount__msg,
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

function SimpleOrderHeader({
  coin,
  width,
  onPress,
}: {
  coin: string;
  width: number;
  onPress: () => void;
}) {
  const { midPrice, midPriceBN } = useTradingPrice({ perpCoin: coin });
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const previousPrice = new BigNumber(assetCtx?.ctx?.prevDayPrice ?? 0);
  const change =
    assetCtx?.coin === coin && previousPrice.gt(0) && midPriceBN.gt(0)
      ? midPriceBN.minus(previousPrice).div(previousPrice).times(100)
      : undefined;
  const changeLabel = change?.isFinite()
    ? `${change.gte(0) ? '+' : ''}${change.toFixed(2)}%`
    : '--';
  const directionColor = change?.gte(0) ? '$textSuccess' : '$textCritical';
  const changeColor = change?.isFinite() ? directionColor : '$textSubdued';
  return (
    <SimpleMarketHeader
      testID="perps-simple-order-token-selector"
      coin={coin}
      width={width}
      price={midPriceBN.gt(0) ? simplePrice(midPrice) : '--'}
      changeLabel={changeLabel}
      changeColor={changeColor}
      onPress={onPress}
    />
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
  const optionsDialogRef = useRef<ReturnType<typeof Dialog.show> | undefined>(
    undefined,
  );
  const openOptionsDialog = useCallback(
    (show: (onClose: () => void) => ReturnType<typeof Dialog.show>) => {
      if (optionsDialogRef.current) return;
      const dialog = show(() => {
        if (optionsDialogRef.current === dialog)
          optionsDialogRef.current = undefined;
      });
      optionsDialogRef.current = dialog;
    },
    [],
  );
  const closePageDialogs = useCallback(() => {
    void optionsDialogRef.current?.close();
    optionsDialogRef.current = undefined;
    void confirmDialogRef.current?.close();
  }, []);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      closePageDialogs();
    };
  }, [closePageDialogs]);
  const amountInputRef = useRef<ISendAmountAutoSizeInputRef>(null);
  const nativeNavigation = useNavigation();
  const actions = useHyperliquidActions();
  const scope = useSimpleScope();
  const [openedScope, setOpenedScope] = useState<string>();
  const [orderSettings, setOrderSettings] = useState<
    ISimpleOrderType & { scope: string }
  >({ scope, type: 'market', price: '' });
  const [draft, setDraft] = usePerpsSimpleDraftAtom();
  const [tradingPreferences, setTradingPreferences] =
    usePerpsTradingPreferencesAtom();
  const [perpsSettings, setPerpsSettings] = usePerpsCustomSettingsAtom();
  const [tradingSubmitting] = useTradingLoadingAtom();
  const [directSubmitting, setDirectSubmitting] = useState(false);
  const directSubmitLock = useRef<AbortController | undefined>(undefined);
  const submitting = tradingSubmitting || directSubmitting;
  const focused = useIsFocused();
  const simpleAvailable = isPerpsSimpleModeAvailable(gtMd);
  const pageActive =
    focused && simpleAvailable && perpsSettings.mobileTradingMode === 'simple';
  useSimpleMarketFocus(route.params.coin, pageActive);
  useEffect(() => {
    if (!focused || pageActive || submitting) return;
    if (!simpleAvailable) {
      closePageDialogs();
      navigation.popStack();
      return;
    }
    let current = true;
    void perpsCustomSettingsAtom.ready().then(async () => {
      const settings = await perpsCustomSettingsAtom.get();
      if (
        current &&
        settings.mobileTradingMode !== 'simple' &&
        nativeNavigation.isFocused()
      ) {
        closePageDialogs();
        navigation.popStack();
      }
    });
    return () => {
      current = false;
    };
  }, [
    closePageDialogs,
    focused,
    nativeNavigation,
    navigation,
    pageActive,
    simpleAvailable,
    submitting,
  ]);
  const [account] = usePerpsActiveAccountAtom();
  const [{ perpConfigCommon }] = usePerpsCommonConfigPersistAtom();

  const [accountLoading] = usePerpsAccountLoadingInfoAtom();
  const [instrument] = useActiveTradeInstrumentAtom();
  useEffect(() => {
    if (
      !openedScope &&
      account.accountAddress &&
      instrument.mode === 'perp' &&
      instrument.coin === route.params.coin
    ) {
      setOpenedScope(scope);
    }
  }, [
    openedScope,
    account.accountAddress,
    instrument.mode,
    instrument.coin,
    route.params.coin,
    scope,
  ]);
  const [asset] = usePerpsActiveAssetAtom();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const [assetData] = usePerpsActiveAssetDataAtom();
  const [summary] = usePerpsActiveAccountSummaryAtom();
  const positions = usePerpsAccountScopedActivePositions();
  const crossAvailableAfterMaintenance = usePerpsCrossAvailableAfterMaintenance(
    route.params.coin,
  );
  const getAggressiveLimitPriceWarning = useGetAggressiveLimitPriceWarning();
  const { showDepositWithdrawModal, isDepositDisabled } =
    useShowDepositWithdrawModal('tradingPanel');
  const orderSubmittedRef = useRef(false);
  const { midPrice = '' } = useTradingPrice({
    perpCoin: route.params.coin,
  });
  const accountAddress = account.accountAddress;
  const scopeReady =
    scope === openedScope &&
    instrument.mode === 'perp' &&
    instrument.coin === route.params.coin &&
    asset.coin === route.params.coin &&
    asset.assetId !== undefined &&
    asset.assetId === instrument.assetId &&
    asset.universe?.szDecimals !== undefined &&
    assetData?.coin === route.params.coin &&
    (!assetCtx || assetCtx.coin === route.params.coin) &&
    Boolean(accountAddress) &&
    assetData.accountAddress.toLowerCase() === accountAddress?.toLowerCase() &&
    summary?.accountAddress?.toLowerCase() === accountAddress?.toLowerCase() &&
    !accountLoading.selectAccountLoading;
  const pageRef = useRef({
    scope,
    scopeReady,
    pageActive,
    submitting,
    midPrice,
  });
  pageRef.current = { scope, scopeReady, pageActive, submitting, midPrice };
  useLayoutEffect(() => {
    if (!pageActive || !scopeReady) return;
    const cancelPendingQuote = () => directSubmitLock.current?.abort();
    const unsubscribe = nativeNavigation.addListener(
      'blur',
      cancelPendingQuote,
    );
    return () => {
      unsubscribe();
      cancelPendingQuote();
    };
  }, [nativeNavigation, pageActive, scopeReady, scope, instrument.assetId]);
  useEffect(() => {
    if (!pageActive || (openedScope && scope !== openedScope))
      closePageDialogs();
  }, [closePageDialogs, openedScope, pageActive, scope]);
  const canEditDialog = useCallback((dialogScope: string) => {
    const page = pageRef.current;
    return (
      mountedRef.current &&
      page.pageActive &&
      !page.submitting &&
      page.scope === dialogScope
    );
  }, []);
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
  const [pendingLeverage, setPendingLeverage] =
    usePerpsSimplePendingLeverageAtom();
  const leverageScope = `${accountAddress?.toLowerCase()}:${asset.assetId}`;
  const pending = pendingLeverage[leverageScope];
  const leverageMatchesFeed =
    !pending ||
    (assetData !== pending.previousFrame &&
      assetData?.leverage.value === pending.value &&
      assetData.leverage.type === pending.type);
  // Use a scoped refresh only until the next subscription frame arrives.
  const refreshedCapacity =
    pending?.previousFrame === assetData ? pending?.refresh : undefined;
  const capacity = leverageMatchesFeed ? assetData : refreshedCapacity;
  const sideCapacity = new BigNumber(
    capacity?.maxTradeSzs?.[side === 'long' ? 0 : 1] ?? '',
  );
  const sizingMarkPriceBN = new BigNumber(capacity?.markPx ?? 0);
  const capacityReady =
    sideCapacity.isFinite() &&
    sideCapacity.gte(0) &&
    sizingMarkPriceBN.isFinite() &&
    sizingMarkPriceBN.gt(0);
  const liveLeverage = assetData?.leverage.value;
  const liveMode = assetData?.leverage.type;
  const previouslyObserved = pending?.previous.some(
    (setting) => setting.value === liveLeverage && setting.type === liveMode,
  );
  const verifyExternalChange = Boolean(
    pending &&
    !leverageMatchesFeed &&
    pending.previousFrame !== assetData &&
    (!previouslyObserved || pending.refresh),
  );
  useEffect(() => {
    if (!pending || !scopeReady || !accountAddress || !pageActive) return;
    const clearPending = () => {
      setPendingLeverage((scopes) => {
        if (scopes[leverageScope] !== pending) return scopes;
        const remaining = { ...scopes };
        delete remaining[leverageScope];
        return remaining;
      });
    };
    if (leverageMatchesFeed && capacityReady) {
      clearPending();
      return;
    }
    if (!verifyExternalChange) return;
    // A second client can change leverage before this page sees its own ACK
    // on the subscription. Corroborate the conflicting frame with a scoped read.
    let current = true;
    void backgroundApiProxy.serviceHyperliquid
      .getActiveAssetDataByCoin({
        coin: route.params.coin,
        user: accountAddress,
      })
      .then((snapshot) => {
        if (
          current &&
          snapshot?.coin === route.params.coin &&
          snapshot.user.toLowerCase() === accountAddress.toLowerCase() &&
          snapshot.leverage.value === liveLeverage &&
          snapshot.leverage.type === liveMode
        )
          clearPending();
      })
      .catch(() => {
        // A later matching subscription frame can still release the sizing guard.
      });
    return () => {
      current = false;
    };
  }, [
    accountAddress,
    capacityReady,
    leverageMatchesFeed,
    leverageScope,
    liveLeverage,
    liveMode,
    pageActive,
    pending,
    route.params.coin,
    scopeReady,
    setPendingLeverage,
    verifyExternalChange,
  ]);
  const leverage = pending?.value ?? assetData?.leverage.value ?? 0;
  const mode = pending?.type ?? assetData?.leverage.type;
  const maxSize = computeMaxTradeSize({
    side,
    price: orderPrice,
    markPrice: capacity?.markPx,
    maxTradeSzs: scopeReady ? capacity?.maxTradeSzs : undefined,
    leverageValue: leverage,
    szDecimals: asset.universe?.szDecimals,
  }).toFixed();
  const percent =
    scopedDraft?.source === 'percent' ? scopedDraft.sizePercent : 0;
  const percentTokenAmount = getSimpleSliderAmount({
    percent,
    maxSize,
    price: orderPrice,
    leverage,
    inputUnit: 'token',
    decimals: asset.universe?.szDecimals ?? 0,
  });
  let amount = scopedDraft?.source === 'manual' ? scopedDraft.inputAmount : '';
  if (scopedDraft?.source === 'percent') {
    amount = getSimpleSliderAmount({
      percent: 100,
      maxSize: percentTokenAmount,
      price: orderPrice,
      leverage,
      inputUnit,
      decimals: amountDecimals,
    });
  }
  const displayedAmount =
    scopedDraft?.source === 'percent' && inputUnit !== 'token' && amount !== '0'
      ? new BigNumber(amount || 0).toFixed(amountDecimals)
      : amount || '0';
  const inputAmount = platformEnv.isNative ? displayedAmount : amount;
  // Advance on every accepted key, even before React commits the draft.
  const amountRef = useRef(inputAmount);
  amountRef.current = inputAmount;
  const amountShake = useSharedValue(0);
  const amountShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: amountShake.value }],
  }));
  const validateAmount = useCallback(
    (value: string) => {
      const valid = validateSimpleAmountInput(
        value,
        amountDecimals,
        inputUnit,
        amountRef.current,
      );
      if (!valid) {
        Haptics.warning();
        cancelAnimation(amountShake);
        amountShake.value = 0;
        amountShake.value = withSequence(
          withTiming(-6, { duration: 45 }),
          withTiming(6, { duration: 45 }),
          withTiming(-3, { duration: 45 }),
          withTiming(0, { duration: 45 }),
        );
      }
      return valid;
    },
    [amountDecimals, amountShake, inputUnit],
  );
  const marginBN = new BigNumber(amount || 0)
    .times(inputUnit === 'token' ? orderPriceBN : 1)
    .div(inputUnit === 'margin' ? 1 : leverage || 1);
  const hasPositiveMargin = marginBN.isFinite() && marginBN.gt(0);
  const setAmount = useCallback(
    (value: string) => {
      if (submitting || !validateAmount(value)) return false;
      if (value === amountRef.current) return false;
      amountRef.current = value;
      setDraft({
        scope,
        side,
        source: 'manual',
        inputAmount: value,
        inputUnit,
      });
      return true;
    },
    [inputUnit, scope, setDraft, side, submitting, validateAmount],
  );
  const handleAmountKey = useCallback(
    (key: string) => setAmount(applySimpleAmountKey(amountRef.current, key)),
    [setAmount],
  );
  const clearAmount = useCallback(() => {
    setAmount('');
  }, [setAmount]);
  const showSettings = useCallback(() => {
    if (!canEditDialog(scope)) return;
    openOptionsDialog((onClose) => {
      const dialog = Dialog.show({
        onClose,
        title: intl.formatMessage({ id: ETranslations.global_settings }),
        showFooter: false,
        contentContainerProps: { pb: '$1' },
        renderContent: (
          <YStack gap="$4">
            <SimpleOrderUnitSetting
              value={inputUnit}
              onChange={(unit) => {
                if (!canEditDialog(scope)) return;
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
                if (!mountedRef.current || !nativeNavigation.isFocused())
                  return;
                if (perpsSettings.mobileTradingMode === 'simple') {
                  defaultLogger.perp.common.perpTradingModeSwitch({
                    fromMode: 'simple',
                    toMode: 'pro',
                    source: 'orderSettings',
                  });
                }
                setPerpsSettings((previous) => ({
                  ...previous,
                  mobileTradingMode: 'pro',
                }));
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
      return dialog;
    });
  }, [
    openOptionsDialog,
    canEditDialog,
    inputUnit,
    intl,
    nativeNavigation,
    perpsSettings.mobileTradingMode,
    scope,
    setDraft,
    setPerpsSettings,
    setTradingPreferences,
    side,
    submitting,
  ]);
  const renderHeaderRight = useCallback(
    () => (
      <HeaderIconButton
        icon="SettingsOutline"
        title={intl.formatMessage({ id: ETranslations.global_settings })}
        onPress={showSettings}
        disabled={submitting}
        testID="perps-simple-order-settings"
      />
    ),
    [intl, showSettings, submitting],
  );
  const position = positions.find(
    (item) => item.position.coin === route.params.coin,
  )?.position;
  const preview = getSimpleOrderPreview({
    // The rounded fiat display must not be converted back into the order size.
    inputAmount:
      scopedDraft?.source === 'percent' ? percentTokenAmount : amount,
    inputUnit: scopedDraft?.source === 'percent' ? 'token' : inputUnit,
    price: orderPrice,
    leverage,
    szDecimals: asset.universe?.szDecimals ?? 0,
    maxSize,
  });
  // Keep the form usable during transient disconnects; validate live market
  // data when reviewing an order, just like the professional trading panel.
  const previewReady =
    pageActive &&
    scopeReady &&
    leverage > 0 &&
    Boolean(mode) &&
    orderPriceBN.isFinite() &&
    orderPriceBN.gt(0);
  const ready = previewReady && capacityReady;
  const validation =
    ready && hasPositiveMargin && preview.error
      ? ORDER_VALIDATION[preview.error]
      : undefined;
  const minimumAmount =
    validation === ORDER_VALIDATION.minimumOrderValue
      ? getPerpsMinimumOrderSuggestion({
          price: orderPrice,
          szDecimals: asset.universe?.szDecimals ?? 0,
          minimumNotional: 10,
          inputMode: inputUnit,
          leverage,
          symbol: coinLabel,
        })
      : undefined;
  const validationMessage = validation
    ? intl.formatMessage(
        { id: minimumAmount ? ETranslations.perp_size_least : validation },
        { amount: minimumAmount?.label },
      )
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
  const tradingDisabled = Boolean(
    perpConfigCommon?.disablePerpActionPerp || perpConfigCommon?.ipDisablePerp,
  );
  const tradingDisabledLabel = tradingDisabled
    ? intl.formatMessage({
        id: perpConfigCommon?.ipDisablePerp
          ? ETranslations.trading_unavailable__action
          : ETranslations.perp_button_disable_perp,
      })
    : undefined;
  const canSubmit = ready && !preview.error && !submitting && !tradingDisabled;
  const showDeposit =
    !tradingDisabled && ready && preview.error === 'insufficientMargin';
  const tradeButtonVariant = side === 'long' ? 'accent' : 'destructive';
  const depositLabel = showDeposit
    ? intl.formatMessage({
        id: ETranslations.perp_simple_insufficient_margin_top_up__action,
      })
    : undefined;
  const liqPrice =
    ready && mode && !preview.error
      ? estimateLiquidationPrice({
          orderSize: preview.size,
          priceMode: orderType,
          orderPrice: orderPriceBN,
          markPrice: new BigNumber(
            getValidPerpsPrice(assetCtx?.ctx?.markPrice) ?? sizingMarkPriceBN,
          ),
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
      <PerpsProviderMirror>
        <SimpleOrderHeader
          coin={route.params.coin}
          width={headerWidth}
          onPress={openTokenSelector}
        />
      </PerpsProviderMirror>
    ),
    [headerWidth, route.params.coin, openTokenSelector],
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
      if (
        !mountedRef.current ||
        pageRef.current.scope !== scope ||
        !nativeNavigation.isFocused()
      ) {
        return;
      }
      const state = nativeNavigation.getState();
      const previousRoute = state?.routes[(state?.index ?? 0) - 1];
      const previousMarketParams = previousRoute?.params as
        | IModalPerpParamList[EModalPerpRoutes.MobilePerpSimpleMarket]
        | undefined;
      if (
        previousRoute?.name === EModalPerpRoutes.MobilePerpSimpleMarket &&
        previousMarketParams?.coin === route.params.coin
      ) {
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
      const request = new AbortController();
      directSubmitLock.current = request;
      setDirectSubmitting(true);
      try {
        let executionPrice = orderPrice;
        if (orderType === 'market') {
          const referencePrice = await backgroundApiProxy.serviceHyperliquid
            .getMarketOrderReferencePrice(route.params.coin)
            .catch(() => undefined);
          if (request.signal.aborted || !nativeNavigation.isFocused()) return;
          if (
            !referencePrice ||
            !getCurrentPerpsMarketDataFreshness().isReady
          ) {
            Toast.error({
              title: intl.formatMessage({ id: ETranslations.perp_offline }),
            });
            return;
          }
          executionPrice = referencePrice;
        }
        await actions.current.submitOrder({
          assetId: instrument.assetId,
          expectedAccountAddress: accountAddress,
          tradingUiMode: 'simple',
          formData,
          price: executionPrice,
        });
        onOrderSuccess();
      } catch {
        // submitOrder surfaces errors with a toast; keep the draft for retry.
      } finally {
        directSubmitLock.current = undefined;
        if (mountedRef.current) setDirectSubmitting(false);
      }
      return;
    }
    confirmDialogRef.current = showOrderConfirmDialog({
      sourcePage: { hostKey: sourcePage.hostKey, ownerKey: route.key },
      intl,
      expectedCoin: route.params.coin,
      expectedAccountAddress: accountAddress,
      tradingUiMode: 'simple',
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
  const { textColor: leverageTextColor, ...leverageButtonStyles } =
    getTradingButtonStyleProps(side);
  const leverageControl = (
    <Button
      testID="perps-simple-leverage"
      variant={side === 'long' ? 'accent' : 'destructive'}
      {...leverageButtonStyles}
      borderRadius="$full"
      size="small"
      minHeight={28}
      px="$2"
      py="$0.5"
      hitSlop={8}
      mx="$0"
      my="$0"
      disabled={!scopeReady || submitting || tradingDisabled}
      onPress={() => {
        const assetId = asset.assetId;
        if (
          !canEditDialog(scope) ||
          !scopeReady ||
          tradingDisabled ||
          assetId === undefined ||
          !accountAddress ||
          !mode
        )
          return;
        openOptionsDialog((onClose) =>
          showSimpleLeverageDialog(
            {
              scope: leverageScope,
              awaitingConfirmation: Boolean(pending),
              coin: route.params.coin,
              accountAddress,
              assetId,
              leverage,
              mode,
              maxLeverage: asset.universe?.maxLeverage ?? 1,
              onlyIsolated: Boolean(
                asset.universe?.onlyIsolated ||
                asset.universe?.marginMode === 'noCross' ||
                asset.universe?.marginMode === 'strictIsolated',
              ),
            },
            intl,
            onClose,
          ),
        );
      }}
      childrenAsText={false}
    >
      <SizableText size="$bodyMdMedium" color={leverageTextColor}>
        {scopeReady && mode && leverage > 0
          ? `${marginModeLabel} ${leverage}×`
          : '--'}
      </SizableText>
      <Icon
        name="ChevronTriangleDownSmallSolid"
        size="$3"
        color={leverageTextColor}
        ml="$1"
      />
    </Button>
  );
  const setPercent = (value: number) => {
    if (!ready || submitting) return;
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
  const sliderDraftRef = useRef(draft);
  return (
    <Page backgroundColor={simplePageBackground}>
      <Page.Header
        headerStyle={headerStyle}
        headerContainerBackgroundColor={headerBackgroundColor}
        title={`${directionLabel} ${coinLabel}`}
        headerTitle={renderHeaderTitle}
        headerRight={renderHeaderRight}
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
              <Animated.View style={amountShakeStyle}>
                <SendAutoSizeAmountInput
                  ref={amountInputRef}
                  testID="perps-simple-amount"
                  inputAnimation={
                    scopedDraft?.source === 'percent' ? 'instant' : 'typing'
                  }
                  inlineTextAlignMode="center"
                  value={inputAmount}
                  maxFontSize={
                    platformEnv.isNative ? nativeAmountMaxFontSize : undefined
                  }
                  tokenSymbol={inputUnit === 'token' ? coinLabel : undefined}
                  onChange={(value) => setAmount(value)}
                  validator={validateAmount}
                  inputProps={{
                    editable: !platformEnv.isNative && !submitting,
                    keyboardType: 'decimal-pad',
                    leftAddOnProps:
                      inputUnit === 'token' ? undefined : { label: '$' },
                  }}
                />
              </Animated.View>
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
                disabled={!scopeReady || submitting}
                onPress={() => {
                  if (!canEditDialog(scope) || !pageRef.current.scopeReady)
                    return;
                  openOptionsDialog((onClose) =>
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
                          canEditDialog(scope) && pageRef.current.scopeReady
                            ? pageRef.current.midPrice
                            : '',
                        szDecimals: asset.universe?.szDecimals ?? 0,
                        onConfirm: (value) => {
                          if (
                            !canEditDialog(scope) ||
                            !pageRef.current.scopeReady
                          )
                            return;
                          setOrderSettings({ ...value, scope });
                        },
                      },
                      intl,
                      onClose,
                    ),
                  );
                }}
              />
              <SimpleValue
                compact
                singleLine
                label={intl.formatMessage({
                  id: ETranslations.perp_size_input_usd_order_size,
                })}
                value={
                  previewReady && preview.value.isFinite() && hasPositiveMargin
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
                onSlideStart={() => {
                  sliderDraftRef.current = draft;
                }}
                onSlideCancel={() => {
                  if (scope === openedScope) setDraft(sliderDraftRef.current);
                }}
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
              onKeyPress={handleAmountKey}
              onBackspaceLongPress={clearAmount}
              ctaLabel={intl.formatMessage({ id: ETranslations.global_review })}
              onCtaPress={reviewOrder}
            />
          ) : null}
          <YStack height={48} minHeight={48} flexShrink={0}>
            <TradingGuardWrapper
              buttonSize="large"
              bypassEnableTradingGuard={tradingDisabled}
            >
              <PerpActionButton
                testID={
                  validationMessage
                    ? 'perps-simple-validation'
                    : 'perps-simple-submit'
                }
                size="medium"
                height={48}
                minHeight={48}
                variant={showDeposit ? 'primary' : tradeButtonVariant}
                borderRadius="$full"
                disabled={
                  showDeposit ? submitting || isDepositDisabled : !canSubmit
                }
                loading={submitting}
                accessibilityLabel={
                  tradingDisabledLabel || depositLabel || validationMessage
                }
                onPress={
                  showDeposit
                    ? () => showDepositWithdrawModal('deposit')
                    : reviewOrder
                }
              >
                {tradingDisabledLabel ||
                  depositLabel ||
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
