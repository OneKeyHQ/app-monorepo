import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Checkbox,
  DashText,
  Icon,
  IconButton,
  Input,
  Popover,
  Select,
  SizableText,
  Skeleton,
  Stack,
  Tooltip,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { ICheckedState } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useActiveTradeInstrumentAtom,
  useHyperliquidActions,
  useTradingFormAtom,
  useTradingFormComputedSize,
  useTradingFormEnvAtom,
  useTradingFormSizeInputComputed,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type {
  IBBOPriceMode,
  ITradingFormData,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  type IPerpsLastAdvancedOrderType,
  getPerpsAccountDisplaySnapshotEntry,
  usePerpsAbstractionModeAtom,
  usePerpsAccountDisplayReadyAtom,
  usePerpsAccountDisplaySnapshotAtom,
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountEnableTradingModeAtom,
  usePerpsActiveAccountStatusAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxReadyAtom,
  usePerpsActiveAssetDataAtom,
  usePerpsCustomSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  useSpotActiveAssetAtom,
  useSpotActiveAssetCtxReadyAtom,
  useSpotBalancesAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/spot';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  SCALE_ORDER_MAX_COUNT,
  SCALE_ORDER_MIN_COUNT,
  buildScaleOrderLegs,
  getScaleOrderReferencePrice,
  getScaleOrderSizeSkew,
  validateScaleOrderLegs,
} from '@onekeyhq/shared/src/utils/hyperliquidScaleOrderUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import {
  formatPriceToSignificantDigits,
  formatSpotPriceToValid,
  getSpotTokenDisplayName,
  getTriggerEffectivePrice,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid';
import { PERP_LAYOUT_CONFIG } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import {
  ETriggerOrderType,
  type IScaleOrderSizeDistribution,
} from '@onekeyhq/shared/types/hyperliquid/types';

import { useActiveTradeDisplay } from '../../../hooks/useActiveTradeDisplay';
import { useEnableTradingWithDepositFallback } from '../../../hooks/useEnableTradingWithDepositFallback';
import { useOrderPrice } from '../../../hooks/useOrderPrice';
import { usePerpsAccountScopedActivePositions } from '../../../hooks/usePerpsAccountScopedActivePositions';
import { useShowDepositWithdrawModal } from '../../../hooks/useShowDepositWithdrawModal';
import { useSpotMetaMaps } from '../../../hooks/useSpotMetaMaps';
import { useTradingPrice } from '../../../hooks/useTradingPrice';
import { PerpTestIDs } from '../../../testIDs';
import { isHyperLiquidUnifiedAccountMode } from '../../../utils/accountMode';
import { getPerpsFormLeverage } from '../../../utils/leverageDisplay';
import { getScaleOrderValidationErrorMessage } from '../../../utils/scaleOrderValidation';
import {
  type ITradeSide,
  getTradingSideTextColor,
} from '../../../utils/styleUtils';
import { PerpsSlider } from '../../PerpsSlider';
import { PerpsAccountNumberValue } from '../components/PerpsAccountNumberValue';
import { PriceInput } from '../inputs/PriceInput';
import { SizeInput } from '../inputs/SizeInput';
import { TpSlFormInput } from '../inputs/TpSlFormInput';
import { TradingFormInput } from '../inputs/TradingFormInput';
import { LeverageAdjustModal } from '../modals/LeverageAdjustModal';
import { BBOSelector } from '../selectors/BBOSelector';
import { MarginModeSelector } from '../selectors/MarginModeSelector';
import { MobileOrderTypeSelector } from '../selectors/MobileOrderTypeSelector';
import { TimeInForceSelector } from '../selectors/TimeInForceSelector';
import { TradeSideToggle } from '../selectors/TradeSideToggle';

interface IPerpTradingFormProps {
  isSubmitting?: boolean;
  isMobile?: boolean;
  reserveMobileEnableTradingLayout?: boolean;
}

type IPrimaryOrderType = 'market' | 'limit' | 'trigger';
type ITriggerDropdownValue = ETriggerOrderType | 'scale' | 'twap';
type ITwapDurationInputField = 'hours' | 'minutes';
type IOrderTypeInfoValue = IPrimaryOrderType | ITriggerDropdownValue;
type IOrderTypeInfoItem = {
  description: string;
  helpUrl?: string;
  label: string;
  value: IOrderTypeInfoValue;
};

const DESKTOP_TRADING_HEADER_HEIGHT =
  PERP_LAYOUT_CONFIG.desktop.panelHeaderHeight;

// Migrate old persisted trigger order types to new values
function migrateTriggerOrderType(raw: string): ETriggerOrderType {
  if (raw === 'stopMarket' || raw === 'takeMarket') {
    return ETriggerOrderType.TRIGGER_MARKET;
  }
  if (raw === 'stopLimit' || raw === 'takeLimit') {
    return ETriggerOrderType.TRIGGER_LIMIT;
  }
  return raw as ETriggerOrderType;
}

function resolveAdvancedOrderType({
  lastAdvancedOrderType,
  lastTriggerOrderType,
}: {
  lastAdvancedOrderType?: IPerpsLastAdvancedOrderType;
  lastTriggerOrderType?: ETriggerOrderType;
}): ITriggerDropdownValue {
  if (lastAdvancedOrderType === 'scale' || lastAdvancedOrderType === 'twap') {
    return lastAdvancedOrderType;
  }
  return migrateTriggerOrderType(
    lastAdvancedOrderType ??
      lastTriggerOrderType ??
      ETriggerOrderType.TRIGGER_MARKET,
  );
}

const TRIGGER_MODE_TPSL_RESET: Partial<ITradingFormData> = {
  hasTpsl: false,
  tpTriggerPx: '',
  tpGainPercent: '',
  slTriggerPx: '',
  slLossPercent: '',
  tpType: 'price',
  tpValue: '',
  slType: 'price',
  slValue: '',
};
const USDC_TOKEN_SYMBOL = 'USDC';
const TWAP_MIN_DURATION_MINUTES = 5;
const TWAP_MAX_DURATION_MINUTES = 1440;
const TWAP_ESTIMATED_SLICE_INTERVAL_MINUTES = 0.5;
const TWAP_MIN_SLICE_NOTIONAL_HINT = 10;
const ORDER_TYPE_HELP_CENTER_URL = 'https://help.onekey.so/articles/15442238';
const TWAP_DURATION_PRESET_OPTIONS = [
  { label: '1h', minutes: 60 },
  { label: '6h', minutes: 360 },
  { label: '12h', minutes: 720 },
  { label: '24h', minutes: 1440 },
] as const;

function clampTwapDurationMinutes(minutes: number) {
  if (Number.isNaN(minutes) || minutes <= 0) {
    return 0;
  }
  if (!Number.isFinite(minutes)) {
    return TWAP_MAX_DURATION_MINUTES;
  }
  return Math.min(minutes, TWAP_MAX_DURATION_MINUTES);
}

function splitTwapDurationMinutes(minutes: number) {
  const clampedMinutes = clampTwapDurationMinutes(minutes);
  return {
    hours: Math.floor(clampedMinutes / 60),
    minutes: clampedMinutes % 60,
  };
}

function hasTradingFormOrderSizeInput(
  formData: Pick<ITradingFormData, 'sizeInputMode' | 'size' | 'sizePercent'>,
) {
  if (formData.sizeInputMode === EPerpsSizeInputMode.SLIDER) {
    return (formData.sizePercent ?? 0) > 0;
  }
  return Boolean(formData.size?.trim());
}

function SpotAvailableActionIcon({
  icon,
}: {
  icon: 'DownloadOutline' | 'TradeOutline';
}) {
  return (
    <XStack
      w="$8"
      h="$8"
      borderRadius="$full"
      bg="$bgStrong"
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
    >
      <Icon name={icon} size="$4.5" color="$iconSubdued" />
    </XStack>
  );
}

function useDepositButtonIconProps() {
  return useMemo(
    () =>
      ({
        color: getTradingSideTextColor('long'),
      }) as const,
    [],
  );
}

function MobileDepositButton({ onPress }: { onPress: () => void }) {
  const depositButtonIconProps = useDepositButtonIconProps();

  return (
    <IconButton
      testID={PerpTestIDs.MobileDepositButton}
      size="small"
      variant="tertiary"
      iconSize="$3.5"
      icon="PlusCircleSolid"
      iconProps={depositButtonIconProps}
      onPress={onPress}
      cursor="pointer"
    />
  );
}

function SpotAvailableActionPopover({
  onDeposit,
  onTrade,
  tradeLabel,
  tradeToken,
}: {
  onDeposit: () => void;
  onTrade?: () => void;
  tradeLabel?: string;
  tradeToken?: string;
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const depositButtonIconProps = useDepositButtonIconProps();
  const sheetTitle = intl.formatMessage({
    id: ETranslations.perps_spot_add_funds__title,
  });
  const depositTitle = intl.formatMessage({
    id: ETranslations.perps_spot_deposit_to_usdc__title,
  });
  const depositSubtitle = intl.formatMessage({
    id: ETranslations.perps_spot_deposit_to_usdc__desc,
  });
  const tradeTitle = tradeToken
    ? intl.formatMessage(
        {
          id: ETranslations.perps_spot_buy_token_spot__action,
        },
        {
          token: tradeToken,
        },
      )
    : intl.formatMessage({ id: ETranslations.global_trade });
  const listItemTextProps = {
    titleProps: { size: '$bodyMdMedium' as const, color: '$text' as const },
    subtitleProps: {
      size: '$bodySm' as const,
      color: '$textSubdued' as const,
      numberOfLines: 1,
    },
  };
  const listItemProps = {
    minHeight: '$10' as const,
    mx: gtMd ? ('$0' as const) : ('$-3' as const),
    px: gtMd ? ('$2' as const) : ('$3' as const),
    py: '$1.5' as const,
    gap: '$3' as const,
    borderRadius: '$2.5' as const,
    ...listItemTextProps,
  };
  return (
    <Popover
      title={sheetTitle}
      placement="top-end"
      floatingPanelProps={{
        width: 288,
      }}
      renderTrigger={
        <IconButton
          testID="perp-trading-form-spot-available-action-button"
          size="small"
          variant="tertiary"
          iconSize="$3.5"
          icon="PlusCircleSolid"
          iconProps={depositButtonIconProps}
          cursor="pointer"
        />
      }
      renderContent={({ closePopover }) => (
        <YStack
          px={gtMd ? '$1.5' : '$5'}
          pt={gtMd ? '$1.5' : '$0.5'}
          pb={gtMd ? '$1.5' : '$4'}
          gap={gtMd ? '$1' : '$2'}
        >
          <ListItem
            renderIcon={<SpotAvailableActionIcon icon="DownloadOutline" />}
            title={depositTitle}
            subtitle={depositSubtitle}
            drillIn
            onPress={() => {
              closePopover();
              onDeposit();
            }}
            {...listItemProps}
          />
          {tradeLabel ? (
            <ListItem
              renderIcon={<SpotAvailableActionIcon icon="TradeOutline" />}
              title={tradeTitle}
              subtitle={tradeLabel}
              drillIn
              onPress={() => {
                closePopover();
                onTrade?.();
              }}
              {...listItemProps}
            />
          ) : null}
        </YStack>
      )}
    />
  );
}

function OrderTypeInfoContent({
  description,
  helpUrl,
}: {
  description: string;
  helpUrl?: string;
}) {
  const intl = useIntl();
  const handleOpenHelp = useCallback(() => {
    if (helpUrl) {
      openUrlExternal(helpUrl);
    }
  }, [helpUrl]);

  return (
    <YStack maxWidth={260}>
      <SizableText size="$bodySm" color="$textSubdued">
        {description}
        {helpUrl ? ' ' : null}
        {helpUrl ? (
          <SizableText
            size="$bodySm"
            color="$textSuccess"
            textDecorationLine="underline"
            cursor="pointer"
            onPress={handleOpenHelp}
          >
            {intl.formatMessage({ id: ETranslations.global_learn_more })}
          </SizableText>
        ) : null}
      </SizableText>
    </YStack>
  );
}

function OrderTypeInfoButton({
  description,
  helpUrl,
  isMobile,
}: {
  description: string;
  helpUrl?: string;
  isMobile: boolean;
}) {
  const trigger = (
    <IconButton
      testID={PerpTestIDs.OrderTypeInfoButton}
      variant="tertiary"
      size="small"
      icon="InfoCircleOutline"
      iconSize="$4"
      iconProps={{ color: '$iconSubdued' }}
      cursor="pointer"
    />
  );
  const content = (
    <OrderTypeInfoContent description={description} helpUrl={helpUrl} />
  );

  if (isMobile) {
    return (
      <Popover
        title=""
        showHeader={false}
        placement="bottom-end"
        floatingPanelProps={{ width: 360 }}
        renderTrigger={trigger}
        renderContent={<YStack p="$4">{content}</YStack>}
      />
    );
  }

  return (
    <Tooltip
      hovering
      placement="bottom-end"
      renderTrigger={trigger}
      renderContent={<YStack p="$1">{content}</YStack>}
      contentProps={{ maxWidth: 280 }}
    />
  );
}

function PerpTradingForm({
  isSubmitting = false,
  isMobile = false,
  reserveMobileEnableTradingLayout = false,
}: IPerpTradingFormProps) {
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [perpsActiveAccount] = usePerpsActiveAccountAtom();
  const [enableTradingMode] = usePerpsActiveAccountEnableTradingModeAtom();
  const [perpsAccountStatus] = usePerpsActiveAccountStatusAtom();
  const [perpsAbstractionMode] = usePerpsAbstractionModeAtom();
  const [displayReady] = usePerpsAccountDisplayReadyAtom();
  const [displaySnapshot] = usePerpsAccountDisplaySnapshotAtom();
  const { activeAccount: selectedWalletAccount } = useActiveAccount({ num: 0 });

  const [formData] = useTradingFormAtom();
  const isScaleMode = formData.orderMode === 'scale';
  const isTwapMode = formData.orderMode === 'twap';
  const [, setTradingFormEnv] = useTradingFormEnvAtom();
  const tradingComputed = useTradingFormSizeInputComputed();
  const advancedComputedSizeBN = useTradingFormComputedSize();
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const isSpot = activeTradeInstrument.mode === 'spot';
  const shouldUseLiveTradingPrice = Boolean(
    isSpot ||
    formData.bboPriceMode ||
    formData.orderMode !== 'standard' ||
    hasTradingFormOrderSizeInput(formData),
  );
  const shouldSyncTradingFormEnv = shouldUseLiveTradingPrice;
  const tradingPriceSource = shouldUseLiveTradingPrice ? 'live' : 'display';
  const intl = useIntl();
  const actions = useHyperliquidActions();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [isPerpsActiveAssetCtxReady] = usePerpsActiveAssetCtxReadyAtom();
  const [spotActiveAsset] = useSpotActiveAssetAtom();
  const [isSpotActiveAssetCtxReady] = useSpotActiveAssetCtxReadyAtom();
  const [{ balances: spotBalances }] = useSpotBalancesAtom();
  const { baseName: activeBaseName } = useActiveTradeDisplay();
  const { midPrice, midPriceBN } = useTradingPrice({
    source: tradingPriceSource,
  });
  const { price: orderPriceBN } = useOrderPrice(formData.side, {
    priceSource: tradingPriceSource,
  });
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();
  const enableTrading = useEnableTradingWithDepositFallback();
  const { universeByBaseName } = useSpotMetaMaps();
  const perpsPositions = usePerpsAccountScopedActivePositions();
  const [perpsSelectedSymbol] = usePerpsActiveAssetAtom();
  const isBBOActive = !!formData.bboPriceMode;
  const perpsSelectedDisplayName = useMemo(
    () => parseDexCoin(perpsSelectedSymbol.coin).displayName,
    [perpsSelectedSymbol.coin],
  );
  const [activeAssetData] = usePerpsActiveAssetDataAtom();
  const snapshotLookupIndexedAccountId = selectedWalletAccount.ready
    ? selectedWalletAccount.indexedAccount?.id
    : perpsActiveAccount?.indexedAccountId;
  const snapshotLookupAccountId = selectedWalletAccount.ready
    ? selectedWalletAccount.account?.id
    : perpsActiveAccount?.accountId;
  const snapshotLookupAccountAddress =
    !selectedWalletAccount.ready ||
    snapshotLookupIndexedAccountId ||
    snapshotLookupAccountId
      ? perpsActiveAccount?.accountAddress
      : undefined;
  const snapshotEntry = useMemo(
    () =>
      getPerpsAccountDisplaySnapshotEntry({
        snapshot: displaySnapshot,
        accountAddress: snapshotLookupAccountAddress,
        indexedAccountId: snapshotLookupIndexedAccountId,
        accountId: snapshotLookupAccountId,
        deriveType:
          selectedWalletAccount.deriveType ?? perpsActiveAccount.deriveType,
      }),
    [
      displaySnapshot,
      perpsActiveAccount?.deriveType,
      selectedWalletAccount.deriveType,
      snapshotLookupAccountAddress,
      snapshotLookupAccountId,
      snapshotLookupIndexedAccountId,
    ],
  );
  const [perpsCustomSettings, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();

  const spotUniverse = isSpot ? spotActiveAsset?.universe : undefined;
  const sizeSzDecimals = isSpot
    ? (spotUniverse?.baseSzDecimals ?? 2)
    : (activeAsset?.universe?.szDecimals ?? 2);
  const selectedTradeAsset = useMemo(
    () =>
      isSpot
        ? ({
            coin: spotActiveAsset?.coin ?? activeTradeInstrument.coin,
            assetId: spotActiveAsset?.assetId,
            universe: {
              ...spotUniverse,
              szDecimals: sizeSzDecimals,
            },
          } as typeof activeAsset)
        : activeAsset,
    [
      activeAsset,
      activeTradeInstrument.coin,
      isSpot,
      sizeSzDecimals,
      spotActiveAsset?.assetId,
      spotActiveAsset?.coin,
      spotUniverse,
    ],
  );
  const isSelectedTradeAssetCtxReady = isSpot
    ? isSpotActiveAssetCtxReady
    : isPerpsActiveAssetCtxReady;

  const spotAvailableBaseBN = useMemo(() => {
    if (!spotUniverse?.baseName) {
      return new BigNumber(0);
    }
    const balance = spotBalances.find(
      (item) => item.coin === spotUniverse.baseName,
    );
    if (!balance) {
      return new BigNumber(0);
    }
    return BigNumber.max(
      new BigNumber(balance.total).minus(balance.hold ?? 0),
      0,
    );
  }, [spotBalances, spotUniverse?.baseName]);

  const spotAvailableQuoteBN = useMemo(() => {
    if (!spotUniverse?.quoteName) {
      return new BigNumber(0);
    }
    const balance = spotBalances.find(
      (item) => item.coin === spotUniverse.quoteName,
    );
    if (!balance) {
      return new BigNumber(0);
    }
    return BigNumber.max(
      new BigNumber(balance.total).minus(balance.hold ?? 0),
      0,
    );
  }, [spotBalances, spotUniverse?.quoteName]);

  const spotMaxTradeSzs = useMemo(() => {
    if (!isSpot) {
      return undefined;
    }
    let effectiveSpotPriceBN = new BigNumber(0);
    if (orderPriceBN.isFinite() && orderPriceBN.gt(0)) {
      effectiveSpotPriceBN = orderPriceBN;
    } else if (midPriceBN.isFinite() && midPriceBN.gt(0)) {
      effectiveSpotPriceBN = midPriceBN;
    }
    const buyMax = effectiveSpotPriceBN.gt(0)
      ? spotAvailableQuoteBN.dividedBy(effectiveSpotPriceBN)
      : new BigNumber(0);
    return [
      buyMax.decimalPlaces(sizeSzDecimals, BigNumber.ROUND_FLOOR).toFixed(),
      spotAvailableBaseBN
        .decimalPlaces(sizeSzDecimals, BigNumber.ROUND_FLOOR)
        .toFixed(),
    ] as [string, string];
  }, [
    isSpot,
    midPriceBN,
    orderPriceBN,
    sizeSzDecimals,
    spotAvailableBaseBN,
    spotAvailableQuoteBN,
  ]);

  // Derive primaryOrderType from formData.orderMode
  const isAdvancedOrderMode =
    formData.orderMode === 'trigger' || isScaleMode || isTwapMode;
  const shouldShowLimitTif =
    !isSpot && formData.orderMode === 'standard' && formData.type === 'limit';
  const shouldShowScaleTif = !isSpot && isScaleMode;
  const twapDurationLabel = useMemo(
    () =>
      `${intl.formatMessage({
        id: ETranslations.perp_twap_duration__title,
      })} (${TWAP_MIN_DURATION_MINUTES}m - ${TWAP_MAX_DURATION_MINUTES / 60}h)`,
    [intl],
  );
  const twapHelperText = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.perp_twap_duration_helper__desc,
      }),
    [intl],
  );
  const twapSmallSliceHelperText = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.perp_twap_small_slice__msg,
      }),
    [intl],
  );
  const scaleAmountDistributionHelperText = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.perp_scale_amount_distribution__desc,
      }),
    [intl],
  );
  const scaleAmountDistributionOptions = useMemo(
    () =>
      [
        {
          label: intl.formatMessage({
            id: ETranslations.perp_scale_fixed_distribution__action,
          }),
          value: 'fixed',
        },
        {
          label: intl.formatMessage({
            id: ETranslations.perp_scale_increasing_distribution__action,
          }),
          value: 'increasing',
        },
      ] as const satisfies readonly {
        label: string;
        value: IScaleOrderSizeDistribution;
      }[],
    [intl],
  );
  const primaryOrderType: IPrimaryOrderType = isAdvancedOrderMode
    ? 'trigger'
    : formData.type;
  // Trigger order type: prefer formData, fall back to persisted setting (with migration)
  const triggerOrderType = migrateTriggerOrderType(
    formData.triggerOrderType ??
      perpsCustomSettings.lastTriggerOrderType ??
      ETriggerOrderType.TRIGGER_MARKET,
  );
  // Only triggerMenuOpen stays as local state (pure UI)
  const [triggerMenuOpen, setTriggerMenuOpen] = useState(false);
  // Trigger price and reduceOnly from atom
  const triggerPrice = formData.triggerPrice ?? '';
  const triggerReduceOnly = formData.triggerReduceOnly ?? true;
  const updateForm = useCallback(
    (updates: Partial<ITradingFormData>) => {
      actions.current.updateTradingForm(updates);
    },
    [actions],
  );
  const midPriceRef = useRef(midPrice);
  const latestFormDataRef = useRef(formData);

  latestFormDataRef.current = formData;

  useEffect(() => {
    midPriceRef.current = midPrice;
  }, [midPrice]);

  const getFormattedMidPrice = useCallback(async () => {
    const latestMidPrice =
      activeTradeInstrument.mode === 'perp'
        ? (
            await actions.current.getMidPrice({
              coin: activeTradeInstrument.coin,
            })
          ).mid || midPriceRef.current
        : midPriceRef.current;
    if (!latestMidPrice) {
      return undefined;
    }
    return isSpot
      ? formatSpotPriceToValid(latestMidPrice, sizeSzDecimals)
      : formatPriceToSignificantDigits(latestMidPrice, sizeSzDecimals);
  }, [actions, activeTradeInstrument, isSpot, sizeSzDecimals]);

  const handleUseMidPriceForExecutionPrice = useCallback(() => {
    void (async () => {
      const nextPrice = await getFormattedMidPrice();
      if (nextPrice) {
        updateForm({
          executionPrice: nextPrice,
        });
      }
    })();
  }, [getFormattedMidPrice, updateForm]);

  const handleUseMidPriceForPrice = useCallback(() => {
    void (async () => {
      const nextPrice = await getFormattedMidPrice();
      if (nextPrice) {
        updateForm({
          price: nextPrice,
        });
      }
    })();
  }, [getFormattedMidPrice, updateForm]);

  const prevTypeRef = useRef<'market' | 'limit'>(formData.type);

  useEffect(() => {
    const prevType = prevTypeRef.current;
    const currentType = formData.type;
    let didCancel = false;

    if (prevType !== 'limit' && currentType === 'limit') {
      void (async () => {
        const nextPrice = await getFormattedMidPrice();
        const latestFormData = latestFormDataRef.current;
        if (
          nextPrice &&
          !didCancel &&
          latestFormData.type === 'limit' &&
          !latestFormData.price?.trim()
        ) {
          updateForm({
            price: nextPrice,
          });
        }
      })();
    }

    prevTypeRef.current = currentType;

    return () => {
      didCancel = true;
    };
  }, [formData.type, getFormattedMidPrice, updateForm]);

  useEffect(() => {
    if (!shouldSyncTradingFormEnv) {
      setTradingFormEnv((prev) => {
        const prevAvailable = prev.availableToTrade ?? [];
        const prevMaxTradeSzs = prev.maxTradeSzs ?? [];
        if (
          prev.markPrice === undefined &&
          prev.leverageValue === undefined &&
          prev.fallbackLeverage === undefined &&
          prev.szDecimals === undefined &&
          prevAvailable.length === 0 &&
          prevMaxTradeSzs.length === 0
        ) {
          return prev;
        }
        return {};
      });
      return;
    }

    const nextEnv = isSpot
      ? {
          markPrice: midPrice,
          availableToTrade: [
            spotAvailableQuoteBN.toFixed(),
            spotAvailableBaseBN.toFixed(),
          ],
          maxTradeSzs: spotMaxTradeSzs,
          leverageValue: 1,
          fallbackLeverage: 1,
          szDecimals: sizeSzDecimals,
        }
      : (() => {
          const rawAvailable = activeAssetData?.availableToTrade;
          const maxAvailable = rawAvailable
            ? Math.max(
                Number(rawAvailable[0] ?? 0),
                Number(rawAvailable[1] ?? 0),
              )
            : 0;
          return {
            markPrice: midPrice,
            availableToTrade: [maxAvailable, maxAvailable],
            maxTradeSzs: activeAssetData?.maxTradeSzs,
            leverageValue: getPerpsFormLeverage({
              isSpot: false,
              liveLeverage: activeAssetData?.leverage?.value,
            }),
            fallbackLeverage: activeAsset?.universe?.maxLeverage,
            szDecimals: activeAsset?.universe?.szDecimals,
          };
        })();
    setTradingFormEnv((prev) => {
      const prevAvailable = prev.availableToTrade ?? [];
      const nextAvailable = nextEnv.availableToTrade ?? [];
      const prevMaxTradeSzs = prev.maxTradeSzs ?? [];
      const nextMaxTradeSzs = nextEnv.maxTradeSzs ?? [];
      if (
        prev.markPrice === nextEnv.markPrice &&
        prev.leverageValue === nextEnv.leverageValue &&
        prev.fallbackLeverage === nextEnv.fallbackLeverage &&
        prev.szDecimals === nextEnv.szDecimals &&
        prevAvailable[0] === nextAvailable[0] &&
        prevAvailable[1] === nextAvailable[1] &&
        prevMaxTradeSzs[0] === nextMaxTradeSzs[0] &&
        prevMaxTradeSzs[1] === nextMaxTradeSzs[1]
      ) {
        return prev;
      }
      return nextEnv;
    });
    if (formData.leverage !== nextEnv.leverageValue) {
      updateForm({
        leverage: nextEnv.leverageValue,
      });
    }
  }, [
    midPrice,
    isSpot,
    sizeSzDecimals,
    spotAvailableBaseBN,
    spotAvailableQuoteBN,
    spotMaxTradeSzs,
    activeAssetData,
    activeAssetData?.availableToTrade,
    activeAssetData?.maxTradeSzs,
    activeAssetData?.leverage?.value,
    activeAsset?.universe?.maxLeverage,
    activeAsset?.universe?.szDecimals,
    shouldSyncTradingFormEnv,
    setTradingFormEnv,
    formData.leverage,
    updateForm,
  ]);

  useEffect(() => {
    if (!isSpot || formData.orderMode !== 'trigger') {
      return;
    }
    updateForm({
      ...TRIGGER_MODE_TPSL_RESET,
      bboPriceMode: null,
      orderMode: 'standard',
      type: 'market',
      triggerPrice: '',
      executionPrice: '',
    });
  }, [formData.orderMode, isSpot, updateForm]);

  // Reference Price: Get the effective trading price (limit price, market price, or trigger effective price)
  const [, referencePriceString] = useMemo(() => {
    let price = new BigNumber(0);
    if (formData.orderMode === 'trigger' && formData.triggerOrderType) {
      price = getTriggerEffectivePrice({
        triggerOrderType: formData.triggerOrderType,
        triggerPrice: formData.triggerPrice,
        executionPrice: formData.executionPrice,
        midPrice:
          midPriceBN.isFinite() && midPriceBN.gt(0)
            ? midPriceBN.toFixed()
            : undefined,
      });
    } else if (formData.orderMode === 'scale') {
      price = getScaleOrderReferencePrice({
        lowerPrice: formData.scaleLowerPrice,
        upperPrice: formData.scaleUpperPrice,
      });
    } else if (formData.type === 'limit' && formData.price) {
      price = new BigNumber(formData.price);
    } else if (formData.type === 'market') {
      price = midPriceBN;
    }
    return [
      price,
      isSpot
        ? formatSpotPriceToValid(price.toFixed(), sizeSzDecimals)
        : formatPriceToSignificantDigits(price, sizeSzDecimals),
    ];
  }, [
    formData.type,
    formData.price,
    formData.orderMode,
    formData.triggerOrderType,
    formData.triggerPrice,
    formData.executionPrice,
    formData.scaleLowerPrice,
    formData.scaleUpperPrice,
    isSpot,
    midPriceBN,
    sizeSzDecimals,
  ]);

  const scaleOrderInputMessage = useMemo(() => {
    if (!isScaleMode) {
      return undefined;
    }

    const hasPriceInput = Boolean(
      formData.scaleLowerPrice || formData.scaleUpperPrice,
    );
    const hasCountInput = Boolean(formData.scaleOrderCount);
    const hasSizeInput =
      advancedComputedSizeBN.isFinite() && advancedComputedSizeBN.gt(0);

    if (!hasPriceInput && !hasCountInput && !hasSizeInput) {
      return undefined;
    }

    const orderCount = Number(formData.scaleOrderCount ?? 0);
    if (
      !Number.isInteger(orderCount) ||
      orderCount < SCALE_ORDER_MIN_COUNT ||
      orderCount > SCALE_ORDER_MAX_COUNT
    ) {
      return undefined;
    }

    const lowerPrice = new BigNumber(formData.scaleLowerPrice ?? 0);
    const upperPrice = new BigNumber(formData.scaleUpperPrice ?? 0);
    if (
      !lowerPrice.isFinite() ||
      lowerPrice.lte(0) ||
      !upperPrice.isFinite() ||
      upperPrice.lte(0)
    ) {
      if (!hasPriceInput) {
        return undefined;
      }
      return undefined;
    }
    if (lowerPrice.eq(upperPrice)) {
      return {
        text: intl.formatMessage({
          id: ETranslations.perp_scale_price_range_same__msg,
        }),
        tone: 'error' as const,
      };
    }
    if (!hasSizeInput) {
      return undefined;
    }

    const legs = buildScaleOrderLegs({
      totalSize: advancedComputedSizeBN.toFixed(),
      lowerPrice: formData.scaleLowerPrice ?? '',
      upperPrice: formData.scaleUpperPrice ?? '',
      orderCount,
      szDecimals: sizeSzDecimals,
      side: formData.side,
      sizeSkew: getScaleOrderSizeSkew(formData.scaleSizeDistribution),
      assetType: isSpot ? 'spot' : 'perp',
    });
    const validation = validateScaleOrderLegs({ legs });
    if (!validation.isValid) {
      return {
        text: getScaleOrderValidationErrorMessage({
          intl,
          validation,
          fallback: intl.formatMessage({
            id: ETranslations.perp_invalid_scale_order__msg,
          }),
        }),
        tone: 'error' as const,
      };
    }

    return undefined;
  }, [
    formData.scaleLowerPrice,
    formData.scaleOrderCount,
    formData.scaleSizeDistribution,
    formData.scaleUpperPrice,
    formData.side,
    intl,
    isScaleMode,
    isSpot,
    sizeSzDecimals,
    advancedComputedSizeBN,
  ]);

  const twapDurationInputMessage = useMemo(() => {
    if (!isTwapMode) {
      return undefined;
    }

    const rawDuration = formData.twapDurationMinutes ?? '';
    if (!rawDuration) {
      return {
        text: intl.formatMessage({
          id: ETranslations.perp_twap_duration_required__msg,
        }),
        tone: 'error' as const,
      };
    }

    const duration = Number(rawDuration);
    if (
      !Number.isInteger(duration) ||
      duration < TWAP_MIN_DURATION_MINUTES ||
      duration > TWAP_MAX_DURATION_MINUTES
    ) {
      return {
        text: intl.formatMessage(
          { id: ETranslations.perp_twap_duration_range__msg },
          {
            min: TWAP_MIN_DURATION_MINUTES,
            max: TWAP_MAX_DURATION_MINUTES,
          },
        ),
        tone: 'error' as const,
      };
    }
  }, [formData.twapDurationMinutes, intl, isTwapMode]);

  const twapEstimatedSliceNotional = useMemo(() => {
    if (!isTwapMode) {
      return undefined;
    }
    const duration = Number(formData.twapDurationMinutes ?? 0);
    if (
      !Number.isInteger(duration) ||
      duration < TWAP_MIN_DURATION_MINUTES ||
      duration > TWAP_MAX_DURATION_MINUTES ||
      !advancedComputedSizeBN.isFinite() ||
      advancedComputedSizeBN.lte(0) ||
      !midPriceBN.isFinite() ||
      midPriceBN.lte(0)
    ) {
      return undefined;
    }

    const estimatedSlices = Math.max(
      1,
      Math.ceil(duration / TWAP_ESTIMATED_SLICE_INTERVAL_MINUTES),
    );
    const estimatedSliceNotional = advancedComputedSizeBN
      .multipliedBy(midPriceBN)
      .dividedBy(estimatedSlices);
    if (!estimatedSliceNotional.isFinite() || estimatedSliceNotional.lte(0)) {
      return undefined;
    }

    return estimatedSliceNotional;
  }, [
    formData.twapDurationMinutes,
    isTwapMode,
    midPriceBN,
    advancedComputedSizeBN,
  ]);

  const twapEstimatedSliceNotionalDisplay = useMemo(() => {
    if (!twapEstimatedSliceNotional) {
      return undefined;
    }

    return `${numberFormat(twapEstimatedSliceNotional.toFixed(), {
      formatter: 'balance',
    })} ${USDC_TOKEN_SYMBOL}`;
  }, [twapEstimatedSliceNotional]);

  const twapHelperMessage = useMemo(() => {
    if (
      twapEstimatedSliceNotional &&
      twapEstimatedSliceNotional.lt(TWAP_MIN_SLICE_NOTIONAL_HINT)
    ) {
      return twapSmallSliceHelperText;
    }

    return undefined;
  }, [twapEstimatedSliceNotional, twapSmallSliceHelperText]);

  const [twapDurationHoursInput, setTwapDurationHoursInput] = useState('');
  const [twapDurationMinutesInput, setTwapDurationMinutesInput] = useState('');
  const [focusedTwapDurationInput, setFocusedTwapDurationInput] =
    useState<ITwapDurationInputField | null>(null);
  const focusedTwapDurationInputRef = useRef<ITwapDurationInputField | null>(
    null,
  );

  useEffect(() => {
    if (!isTwapMode) {
      return;
    }
    if (focusedTwapDurationInputRef.current) {
      return;
    }
    const rawDuration = formData.twapDurationMinutes ?? '';
    if (!rawDuration) {
      setTwapDurationHoursInput('');
      setTwapDurationMinutesInput('');
      return;
    }
    const totalMinutes = Number(rawDuration);
    if (!Number.isFinite(totalMinutes) || totalMinutes < 0) {
      return;
    }
    const durationParts = splitTwapDurationMinutes(totalMinutes);
    const nextHours = String(durationParts.hours);
    const nextMinutes = String(durationParts.minutes);
    setTwapDurationHoursInput((prev) =>
      prev === nextHours ? prev : nextHours,
    );
    setTwapDurationMinutesInput((prev) =>
      prev === nextMinutes ? prev : nextMinutes,
    );
  }, [formData.twapDurationMinutes, isTwapMode]);

  const [selectedSymbolPositionValue, selectedSymbolPositionSide] =
    useMemo(() => {
      const value = Number(
        perpsPositions.filter(
          (pos) => pos.position.coin === perpsSelectedSymbol.coin,
        )?.[0]?.position.szi || '0',
      );
      const side: ITradeSide = value >= 0 ? 'long' : 'short';

      return [Math.abs(value), side] as const;
    }, [perpsPositions, perpsSelectedSymbol.coin]);
  const selectedSymbolPositionColor = selectedSymbolPositionValue
    ? getTradingSideTextColor(selectedSymbolPositionSide)
    : '$text';

  const availableToTrade = useMemo(() => {
    if (isSpot) {
      // For spot, availableToTrade is used by env/slider calculations (needs USD-like value)
      const availableValue =
        formData.side === 'long'
          ? spotAvailableQuoteBN
          : spotAvailableBaseBN.multipliedBy(
              midPriceBN.isFinite() && midPriceBN.gt(0) ? midPriceBN : 0,
            );
      return availableValue.toFixed(2, BigNumber.ROUND_DOWN);
    }
    const available = activeAssetData?.availableToTrade;
    if (!available) {
      const cachedAvailable = snapshotEntry?.availableToTrade;
      if (cachedAvailable?.coin === activeAsset?.coin) {
        return cachedAvailable.value;
      }
      return '0';
    }
    const longValue = Number(available[0] ?? 0);
    const shortValue = Number(available[1] ?? 0);
    return new BigNumber(Math.min(longValue, shortValue)).toFixed(
      2,
      BigNumber.ROUND_DOWN,
    );
  }, [
    activeAssetData?.availableToTrade,
    activeAsset?.coin,
    formData.side,
    isSpot,
    midPriceBN,
    snapshotEntry?.availableToTrade,
    spotAvailableBaseBN,
    spotAvailableQuoteBN,
  ]);
  const isUsingCachedAvailableToTrade = Boolean(
    !isSpot &&
    !activeAssetData?.availableToTrade &&
    snapshotEntry?.availableToTrade?.coin === activeAsset?.coin,
  );
  const shouldDisplayAvailableToTradeDuringLoading =
    !isSpot &&
    (Boolean(activeAssetData?.availableToTrade) ||
      isUsingCachedAvailableToTrade);

  // Spot: display raw token balance with symbol
  const spotAvailableDisplay = useMemo(() => {
    if (!isSpot) return '';
    if (formData.side === 'long') {
      return `${numberFormat(spotAvailableQuoteBN.toFixed(), {
        formatter: 'balance',
      })} ${spotUniverse?.quoteName ?? ''}`;
    }
    return `${numberFormat(spotAvailableBaseBN.toFixed(), {
      formatter: 'balance',
    })} ${
      spotUniverse?.baseName
        ? getSpotTokenDisplayName(spotUniverse.baseName)
        : ''
    }`;
  }, [
    isSpot,
    formData.side,
    spotAvailableQuoteBN,
    spotAvailableBaseBN,
    spotUniverse?.quoteName,
    spotUniverse?.baseName,
  ]);

  const spotAvailableToken = useMemo(() => {
    if (!isSpot || !spotUniverse) return '';
    return formData.side === 'long'
      ? spotUniverse.quoteName
      : spotUniverse.baseName;
  }, [formData.side, isSpot, spotUniverse]);

  const spotAvailableTradeUniverse = useMemo(() => {
    if (!spotAvailableToken || spotAvailableToken === USDC_TOKEN_SYMBOL) {
      return undefined;
    }
    const targetUniverse = universeByBaseName[spotAvailableToken];
    return targetUniverse?.quoteName === USDC_TOKEN_SYMBOL
      ? targetUniverse
      : undefined;
  }, [spotAvailableToken, universeByBaseName]);

  const spotAvailableTradeToken = useMemo(() => {
    if (!spotAvailableTradeUniverse) return undefined;
    return getSpotTokenDisplayName(spotAvailableTradeUniverse.baseName);
  }, [spotAvailableTradeUniverse]);

  const spotAvailableTradeLabel = useMemo(() => {
    if (!spotAvailableTradeUniverse || !spotAvailableTradeToken) {
      return undefined;
    }
    return `${spotAvailableTradeToken}/${spotAvailableTradeUniverse.quoteName}`;
  }, [spotAvailableTradeToken, spotAvailableTradeUniverse]);

  const handleSpotAvailableTradePress = useCallback(() => {
    if (!spotAvailableTradeUniverse) return;
    void (async () => {
      const switched = await actions.current.switchTradeInstrument({
        mode: 'spot',
        coin: spotAvailableTradeUniverse.name,
        spotUniverse: spotAvailableTradeUniverse,
      });
      if (!switched) return;
      actions.current.updateTradingForm({
        side: 'long',
        size: '',
        sizePercent: 0,
        sizeInputMode: EPerpsSizeInputMode.MANUAL,
      });
    })();
  }, [actions, spotAvailableTradeUniverse]);

  const handleSpotAvailableDepositPress = useCallback(() => {
    void showDepositWithdrawModal('deposit');
  }, [showDepositWithdrawModal]);
  const handleSpotEnableTradingPress = useCallback(() => {
    if (perpsAccountLoading.enableTradingLoading) {
      return;
    }
    void enableTrading();
  }, [enableTrading, perpsAccountLoading.enableTradingLoading]);
  const handleDepositPress = useCallback(() => {
    void showDepositWithdrawModal('deposit');
  }, [showDepositWithdrawModal]);

  const isUnifiedAccountMode = useMemo(
    () =>
      isHyperLiquidUnifiedAccountMode(
        perpsAbstractionMode,
        perpsActiveAccount.accountAddress,
      ),
    [perpsAbstractionMode, perpsActiveAccount.accountAddress],
  );

  const shouldShowEnableTradingLink = useMemo(
    () =>
      !isUnifiedAccountMode &&
      displayReady.statusReady &&
      !perpsAccountStatus.canTrade &&
      !perpsAccountStatus.accountNotSupport &&
      !perpsAccountStatus.canCreateAddress &&
      enableTradingMode.requiresExplicitEnableTrading,
    [
      displayReady.statusReady,
      enableTradingMode.requiresExplicitEnableTrading,
      isUnifiedAccountMode,
      perpsAccountStatus.accountNotSupport,
      perpsAccountStatus.canCreateAddress,
      perpsAccountStatus.canTrade,
    ],
  );

  const spotMaxTradeLabel = useMemo(
    () =>
      intl.formatMessage({
        id:
          formData.side === 'long'
            ? ETranslations.perp_spot_max_buy
            : ETranslations.perp_spot_max_sell,
      }),
    [formData.side, intl],
  );
  const spotMaxTradeTooltip = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.perp_spot_max_buy_sell_tooltip,
      }),
    [intl],
  );

  const spotMaxTradeDisplay = useMemo(() => {
    if (!isSpot) return '';
    if (formData.side === 'long') {
      return `${spotMaxTradeSzs?.[0] ?? '0'} ${
        spotUniverse?.baseName
          ? getSpotTokenDisplayName(spotUniverse.baseName)
          : ''
      }`;
    }
    let effectiveSpotPriceBN = new BigNumber(0);
    if (orderPriceBN.isFinite() && orderPriceBN.gt(0)) {
      effectiveSpotPriceBN = orderPriceBN;
    } else if (midPriceBN.isFinite() && midPriceBN.gt(0)) {
      effectiveSpotPriceBN = midPriceBN;
    }
    const maxSellQuoteBN = effectiveSpotPriceBN.gt(0)
      ? spotAvailableBaseBN.multipliedBy(effectiveSpotPriceBN)
      : new BigNumber(0);
    return `${maxSellQuoteBN.toFixed(2, BigNumber.ROUND_DOWN)} ${
      spotUniverse?.quoteName ?? ''
    }`;
  }, [
    formData.side,
    isSpot,
    midPriceBN,
    orderPriceBN,
    spotAvailableBaseBN,
    spotMaxTradeSzs,
    spotUniverse?.baseName,
    spotUniverse?.quoteName,
  ]);

  const handleSideChange = useCallback(
    (newSide: 'long' | 'short') => {
      if (newSide !== formData.side) {
        updateForm({
          side: newSide,
          size: '',
          sizePercent: 0,
          sizeInputMode: EPerpsSizeInputMode.MANUAL,
        });
      }
    },
    [formData.side, updateForm],
  );

  const switchToManual = useCallback(() => {
    if (tradingComputed.sizeInputMode === EPerpsSizeInputMode.SLIDER) {
      updateForm({
        sizeInputMode: EPerpsSizeInputMode.MANUAL,
        sizePercent: 0,
        size: '',
      });
    }
  }, [tradingComputed.sizeInputMode, updateForm]);

  const handleManualSizeChange = useCallback(
    (value: string) => {
      updateForm({
        size: value,
        sizeInputMode: EPerpsSizeInputMode.MANUAL,
        sizePercent: 0,
      });
    },
    [updateForm],
  );

  const handleSliderPercentChange = useCallback(
    (nextValue: number | number[]) => {
      const raw = Array.isArray(nextValue) ? nextValue[0] : nextValue;
      const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
      const clamped = Math.max(0, Math.min(100, value));
      updateForm({
        sizeInputMode: EPerpsSizeInputMode.SLIDER,
        sizePercent: clamped,
        size: '',
      });
    },
    [updateForm],
  );

  const sliderValue =
    tradingComputed.sizeInputMode === 'slider'
      ? tradingComputed.sizePercent
      : 0;
  const sliderDisabled = isSubmitting || !tradingComputed.sliderEnabled;

  const handleTpslCheckboxChange = useCallback(
    (checked: ICheckedState) => {
      updateForm({ hasTpsl: !!checked });

      if (!checked) {
        updateForm({
          tpTriggerPx: '',
          slTriggerPx: '',
        });
      }
    },
    [updateForm],
  );

  const handleTpValueChange = useCallback(
    (value: string) => {
      updateForm({ tpValue: value });
    },
    [updateForm],
  );

  const handleTpTypeChange = useCallback(
    (type: 'price' | 'percentage') => {
      updateForm({ tpType: type });
    },
    [updateForm],
  );

  const handleSlValueChange = useCallback(
    (value: string) => {
      updateForm({ slValue: value });
    },
    [updateForm],
  );

  const handleSlTypeChange = useCallback(
    (type: 'price' | 'percentage') => {
      updateForm({ slType: type });
    },
    [updateForm],
  );

  const handleBBOToggle = useCallback(() => {
    if (formData.bboPriceMode) {
      updateForm({ bboPriceMode: null });
    } else {
      updateForm({
        bboPriceMode: { type: 'counterparty', level: 1 },
      });
    }
  }, [formData.bboPriceMode, updateForm]);

  const handleBBOChange = useCallback(
    (mode: IBBOPriceMode) => {
      updateForm({ bboPriceMode: mode });
    },
    [updateForm],
  );

  const orderTypeOptions = useMemo(
    () => [
      {
        name: intl.formatMessage({ id: ETranslations.perp_trade_market }),
        value: 'market' as const,
      },
      {
        name: intl.formatMessage({ id: ETranslations.perp_trade_limit }),
        value: 'limit' as const,
      },
    ],
    [intl],
  );

  const triggerTypeOptions = useMemo(() => {
    const algoOrderOptions = [
      {
        label: intl.formatMessage({
          id: ETranslations.perp_scale_order__title,
        }),
        value: 'scale' as ITriggerDropdownValue,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.perp_twap_order__title,
        }),
        value: 'twap' as ITriggerDropdownValue,
      },
    ];
    if (isSpot) {
      return algoOrderOptions;
    }
    return [
      {
        label: intl.formatMessage({
          id: ETranslations.perp_order_trigger_market,
        }),
        value: ETriggerOrderType.TRIGGER_MARKET as ITriggerDropdownValue,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.perp_order_trigger_limit,
        }),
        value: ETriggerOrderType.TRIGGER_LIMIT as ITriggerDropdownValue,
      },
      ...algoOrderOptions,
    ];
  }, [intl, isSpot]);
  const scaleOrderCountValidator = useCallback((value: string) => {
    if (value === '') {
      return true;
    }
    if (!/^\d*$/.test(value)) {
      return false;
    }
    const nextValue = Number(value);
    return Number.isInteger(nextValue) && nextValue <= SCALE_ORDER_MAX_COUNT;
  }, []);
  const updateTwapDurationFromParts = useCallback(
    (hoursValue: string, minutesValue: string) => {
      const nextHours = hoursValue.replace(/[^\d]/g, '');
      const nextMinutes = minutesValue.replace(/[^\d]/g, '');

      const hoursNumber = nextHours ? Number(nextHours) : 0;
      const rawMinutesNumber = nextMinutes ? Number(nextMinutes) : 0;

      if (
        !Number.isInteger(hoursNumber) ||
        !Number.isInteger(rawMinutesNumber)
      ) {
        return false;
      }

      const rawTotalMinutes = hoursNumber * 60 + rawMinutesNumber;
      const totalMinutes = clampTwapDurationMinutes(rawTotalMinutes);

      if (
        rawMinutesNumber >= 60 ||
        rawTotalMinutes > TWAP_MAX_DURATION_MINUTES
      ) {
        const durationParts = splitTwapDurationMinutes(totalMinutes);
        setTwapDurationHoursInput(String(durationParts.hours));
        setTwapDurationMinutesInput(String(durationParts.minutes));
        updateForm({ twapDurationMinutes: String(totalMinutes) });
        return true;
      }

      setTwapDurationHoursInput(nextHours === '' ? '' : String(hoursNumber));
      setTwapDurationMinutesInput(
        nextMinutes === '' ? '' : String(rawMinutesNumber),
      );

      updateForm({
        twapDurationMinutes:
          nextHours === '' && nextMinutes === '' ? '' : String(totalMinutes),
      });
      return true;
    },
    [updateForm],
  );
  const handleTwapHoursChange = useCallback(
    (value: string) => {
      void updateTwapDurationFromParts(value, twapDurationMinutesInput);
    },
    [twapDurationMinutesInput, updateTwapDurationFromParts],
  );
  const handleTwapMinutesChange = useCallback(
    (value: string) => {
      void updateTwapDurationFromParts(twapDurationHoursInput, value);
    },
    [twapDurationHoursInput, updateTwapDurationFromParts],
  );
  const handleTwapDurationPresetPress = useCallback(
    (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const remainderMinutes = minutes % 60;
      setTwapDurationHoursInput(String(hours));
      setTwapDurationMinutesInput(String(remainderMinutes));
      updateForm({ twapDurationMinutes: String(minutes) });
    },
    [updateForm],
  );
  const mobileOrderTypeOptions = useMemo(() => {
    const base = [
      {
        description: intl.formatMessage({
          id: ETranslations.perp_order_type_market_desc__desc,
        }),
        icon: 'MarketOrderOutline' as const,
        label: intl.formatMessage({ id: ETranslations.perp_trade_market }),
        value: 'market' as string,
      },
      {
        description: intl.formatMessage({
          id: ETranslations.perp_order_type_limit_desc__desc,
        }),
        icon: 'LimitOrderOutline' as const,
        label: intl.formatMessage({ id: ETranslations.perp_trade_limit }),
        value: 'limit' as string,
      },
    ];
    const algoOrderOptions = [
      {
        description: intl.formatMessage({
          id: ETranslations.perp_order_type_scale_desc__desc,
        }),
        icon: 'ScaledOrderOutline' as const,
        label: intl.formatMessage({
          id: ETranslations.perp_scale_order__title,
        }),
        value: 'scale',
      },
      {
        description: intl.formatMessage({
          id: ETranslations.perp_order_type_twap_desc__desc,
        }),
        icon: 'TwapOutline' as const,
        label: intl.formatMessage({
          id: ETranslations.perp_twap_order__title,
        }),
        value: 'twap',
      },
    ];
    if (isSpot) return [...base, ...algoOrderOptions];
    return [
      ...base,
      {
        description: intl.formatMessage({
          id: ETranslations.perp_order_type_trigger_market_desc__desc,
        }),
        icon: 'TriggerOrderOutline' as const,
        label: intl.formatMessage({
          id: ETranslations.perp_order_trigger_market,
        }),
        value: ETriggerOrderType.TRIGGER_MARKET as string,
      },
      {
        description: intl.formatMessage({
          id: ETranslations.perp_order_type_trigger_limit_desc__desc,
        }),
        icon: 'AdvancedLimitOutline' as const,
        label: intl.formatMessage({
          id: ETranslations.perp_order_trigger_limit,
        }),
        value: ETriggerOrderType.TRIGGER_LIMIT as string,
      },
      ...algoOrderOptions,
    ];
  }, [intl, isSpot]);
  const orderTypeInfoItems = useMemo(
    () =>
      [
        {
          description: intl.formatMessage({
            id: ETranslations.perp_order_type_market_desc__desc,
          }),
          helpUrl: ORDER_TYPE_HELP_CENTER_URL,
          label: intl.formatMessage({ id: ETranslations.perp_trade_market }),
          value: 'market',
        },
        {
          description: intl.formatMessage({
            id: ETranslations.perp_order_type_limit_desc__desc,
          }),
          helpUrl: ORDER_TYPE_HELP_CENTER_URL,
          label: intl.formatMessage({ id: ETranslations.perp_trade_limit }),
          value: 'limit',
        },
        {
          description: intl.formatMessage({
            id: ETranslations.perp_order_type_trigger_market_desc__desc,
          }),
          helpUrl: ORDER_TYPE_HELP_CENTER_URL,
          label: intl.formatMessage({
            id: ETranslations.perp_order_trigger_market,
          }),
          value: ETriggerOrderType.TRIGGER_MARKET,
        },
        {
          description: intl.formatMessage({
            id: ETranslations.perp_order_type_trigger_limit_desc__desc,
          }),
          helpUrl: ORDER_TYPE_HELP_CENTER_URL,
          label: intl.formatMessage({
            id: ETranslations.perp_order_trigger_limit,
          }),
          value: ETriggerOrderType.TRIGGER_LIMIT,
        },
        {
          description: intl.formatMessage({
            id: ETranslations.perp_order_type_scale_desc__desc,
          }),
          helpUrl: ORDER_TYPE_HELP_CENTER_URL,
          label: intl.formatMessage({
            id: ETranslations.perp_scale_order__title,
          }),
          value: 'scale',
        },
        {
          description: intl.formatMessage({
            id: ETranslations.perp_order_type_twap_desc__desc,
          }),
          helpUrl: ORDER_TYPE_HELP_CENTER_URL,
          label: intl.formatMessage({
            id: ETranslations.perp_twap_order__title,
          }),
          value: 'twap',
        },
      ] as const satisfies readonly IOrderTypeInfoItem[],
    [intl],
  );
  const selectedOrderTypeInfo = useMemo(() => {
    if (isScaleMode) {
      return orderTypeInfoItems.find((item) => item.value === 'scale');
    }
    if (isTwapMode) {
      return orderTypeInfoItems.find((item) => item.value === 'twap');
    }
    if (formData.orderMode === 'trigger') {
      return orderTypeInfoItems.find((item) => item.value === triggerOrderType);
    }
    return orderTypeInfoItems.find((item) => item.value === formData.type);
  }, [
    formData.orderMode,
    formData.type,
    isScaleMode,
    isTwapMode,
    orderTypeInfoItems,
    triggerOrderType,
  ]);

  const lastAdvancedOrderType = useMemo(
    () =>
      resolveAdvancedOrderType({
        lastAdvancedOrderType: perpsCustomSettings.lastAdvancedOrderType,
        lastTriggerOrderType: perpsCustomSettings.lastTriggerOrderType,
      }),
    [
      perpsCustomSettings.lastAdvancedOrderType,
      perpsCustomSettings.lastTriggerOrderType,
    ],
  );
  const lastSelectableAdvancedOrderType: ITriggerDropdownValue =
    isSpot &&
    lastAdvancedOrderType !== 'scale' &&
    lastAdvancedOrderType !== 'twap'
      ? 'scale'
      : lastAdvancedOrderType;

  const applyAdvancedOrderType = useCallback(
    (nextType: ITriggerDropdownValue) => {
      const resolvedNextType =
        isSpot && nextType !== 'scale' && nextType !== 'twap'
          ? 'scale'
          : nextType;
      if (resolvedNextType === 'scale') {
        updateForm({
          ...TRIGGER_MODE_TPSL_RESET,
          orderMode: 'scale',
          type: 'limit',
          bboPriceMode: null,
          hasTpsl: false,
          ...(isSpot ? { scaleReduceOnly: false } : {}),
        });
        setPerpsCustomSettings((prev) => ({
          ...prev,
          lastAdvancedOrderType: 'scale',
        }));
        return;
      }
      if (resolvedNextType === 'twap') {
        updateForm({
          ...TRIGGER_MODE_TPSL_RESET,
          orderMode: 'twap',
          type: 'market',
          bboPriceMode: null,
          hasTpsl: false,
          ...(isSpot ? { twapReduceOnly: false } : {}),
        });
        setPerpsCustomSettings((prev) => ({
          ...prev,
          lastAdvancedOrderType: 'twap',
        }));
        return;
      }
      const migrated = migrateTriggerOrderType(resolvedNextType);
      const isLimitTrigger = migrated === ETriggerOrderType.TRIGGER_LIMIT;
      updateForm({
        ...TRIGGER_MODE_TPSL_RESET,
        orderMode: 'trigger',
        triggerOrderType: migrated,
        type: isLimitTrigger ? 'limit' : 'market',
        bboPriceMode: null,
      });
      setPerpsCustomSettings((prev) => ({
        ...prev,
        lastTriggerOrderType: migrated,
        lastAdvancedOrderType: migrated,
      }));
    },
    [isSpot, setPerpsCustomSettings, updateForm],
  );

  const applyPrimaryOrderType = useCallback(
    (nextType: IPrimaryOrderType) => {
      if (nextType === 'trigger') {
        applyAdvancedOrderType(lastSelectableAdvancedOrderType);
        return;
      }
      updateForm({
        orderMode: 'standard',
        type: nextType,
      });
    },
    [applyAdvancedOrderType, lastSelectableAdvancedOrderType, updateForm],
  );

  const handleTriggerOrderTypeChange = useCallback(
    (nextValue: string | number | boolean | undefined) => {
      if (typeof nextValue !== 'string') {
        return;
      }
      applyAdvancedOrderType(nextValue as ITriggerDropdownValue);
    },
    [applyAdvancedOrderType],
  );

  const isTriggerMode = formData.orderMode === 'trigger';
  const isTriggerLimitOrder =
    triggerOrderType === ETriggerOrderType.TRIGGER_LIMIT;
  const scaleDistributionRadioOuterSize = isMobile ? '$3.5' : '$4';
  const scaleDistributionRadioInnerSize = isMobile ? '$1.5' : '$2';

  const renderScaleAmountDistributionSection = () => {
    if (isScaleMode) {
      const scaleSizeDistribution = formData.scaleSizeDistribution ?? 'fixed';
      return (
        <YStack gap="$1.5">
          <XStack alignItems="center">
            <DashText
              size={isMobile ? '$bodySm' : '$bodyMd'}
              color="$textSubdued"
              dashColor="$textDisabled"
              dashSpacing={0}
              dashThickness={0.5}
              cursor={isMobile ? 'default' : 'help'}
              tooltip={scaleAmountDistributionHelperText}
              tooltipDisplayMode={isMobile ? 'popover' : 'tooltip'}
              tooltipPlacement="bottom-start"
              tooltipTitle={intl.formatMessage({
                id: ETranslations.perp_scale_amount_distribution__title,
              })}
            >
              {intl.formatMessage({
                id: ETranslations.perp_scale_amount_distribution__title,
              })}
            </DashText>
          </XStack>
          <XStack gap="$4" alignItems="center" flexWrap="wrap">
            {scaleAmountDistributionOptions.map((option) => {
              const checked = scaleSizeDistribution === option.value;
              return (
                <XStack
                  key={option.value}
                  alignItems="center"
                  gap="$2"
                  cursor={isSubmitting ? 'default' : 'pointer'}
                  opacity={isSubmitting ? 0.5 : 1}
                  onPress={() => {
                    if (!isSubmitting) {
                      updateForm({ scaleSizeDistribution: option.value });
                    }
                  }}
                >
                  <XStack
                    w={scaleDistributionRadioOuterSize}
                    h={scaleDistributionRadioOuterSize}
                    borderRadius="$full"
                    borderWidth={1.5}
                    borderColor={checked ? '$borderActive' : '$borderStrong'}
                    bg={checked ? '$bgPrimary' : 'transparent'}
                    alignItems="center"
                    justifyContent="center"
                  >
                    {checked ? (
                      <XStack
                        w={scaleDistributionRadioInnerSize}
                        h={scaleDistributionRadioInnerSize}
                        borderRadius="$full"
                        bg="$iconInverse"
                      />
                    ) : null}
                  </XStack>
                  <SizableText
                    size={isMobile ? '$bodySm' : '$bodyMdMedium'}
                    color="$text"
                  >
                    {option.label}
                  </SizableText>
                </XStack>
              );
            })}
          </XStack>
        </YStack>
      );
    }
    return null;
  };

  const renderPriceInputSection = () => {
    if (isScaleMode) {
      return (
        <YStack gap={isMobile ? '$2.5' : '$3'}>
          <PriceInput
            label={intl.formatMessage({
              id: ETranslations.perp_scale_lower_price_label__title,
            })}
            placeholder={intl.formatMessage({
              id: ETranslations.perp_scale_lower_price_placeholder__desc,
            })}
            value={formData.scaleLowerPrice ?? ''}
            onChange={(value) => updateForm({ scaleLowerPrice: value })}
            szDecimals={sizeSzDecimals}
            isSpot={isSpot}
            isMobile={isMobile}
            disabled={isSubmitting}
          />
          <PriceInput
            label={intl.formatMessage({
              id: ETranslations.perp_scale_upper_price_label__title,
            })}
            placeholder={intl.formatMessage({
              id: ETranslations.perp_scale_upper_price_placeholder__desc,
            })}
            value={formData.scaleUpperPrice ?? ''}
            onChange={(value) => updateForm({ scaleUpperPrice: value })}
            szDecimals={sizeSzDecimals}
            isSpot={isSpot}
            isMobile={isMobile}
            disabled={isSubmitting}
          />
          <TradingFormInput
            label={intl.formatMessage(
              {
                id: ETranslations.perp_scale_order_count_with_range__title,
              },
              {
                min: SCALE_ORDER_MIN_COUNT,
                max: SCALE_ORDER_MAX_COUNT,
              },
            )}
            placeholder={`${SCALE_ORDER_MIN_COUNT}-${SCALE_ORDER_MAX_COUNT}`}
            value={formData.scaleOrderCount ?? ''}
            onChange={(value) => {
              const nextValue = value.replace(/[^\d]/g, '');
              updateForm({ scaleOrderCount: nextValue });
            }}
            validator={scaleOrderCountValidator}
            keyboardType="numeric"
            customSuffix={
              isMobile ? (
                <SizableText size="$bodyMdMedium" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.perp_scale_order_quantity__title,
                  })}
                </SizableText>
              ) : undefined
            }
            isMobile={isMobile}
            disabled={isSubmitting}
          />
          {scaleOrderInputMessage ? (
            <SizableText
              size="$bodySm"
              color={
                scaleOrderInputMessage.tone === 'error'
                  ? '$red10'
                  : '$textSubdued'
              }
            >
              {scaleOrderInputMessage.text}
            </SizableText>
          ) : null}
        </YStack>
      );
    }
    if (isTriggerMode) {
      return (
        <YStack gap={isMobile ? '$2.5' : '$3'}>
          <PriceInput
            label={intl.formatMessage({
              id: ETranslations.dexmarket_pro_trigger_price,
            })}
            placeholder={intl.formatMessage({
              id: ETranslations.perps_input_tirgger_price_place_holder,
            })}
            value={triggerPrice}
            onChange={(value) => updateForm({ triggerPrice: value })}
            szDecimals={sizeSzDecimals}
            isSpot={isSpot}
            isMobile={isMobile}
            disabled={isSubmitting}
          />
          {isTriggerLimitOrder ? (
            <PriceInput
              onUseMidPrice={handleUseMidPriceForExecutionPrice}
              placeholder={intl.formatMessage({
                id: ETranslations.perps_input_price_place_holder,
              })}
              value={formData.executionPrice ?? ''}
              onChange={(value) => updateForm({ executionPrice: value })}
              szDecimals={sizeSzDecimals}
              isSpot={isSpot}
              isMobile={isMobile}
              disabled={isSubmitting}
            />
          ) : null}
        </YStack>
      );
    }
    if (formData.type === 'limit' || isMobile) {
      return (
        <XStack
          alignItems="center"
          flex={isMobile ? undefined : 1}
          gap={isMobile ? '$2.5' : '$3'}
        >
          {isBBOActive && formData.type === 'limit' ? (
            <YStack flex={1}>
              <BBOSelector
                value={formData.bboPriceMode ?? null}
                onChange={handleBBOChange}
                disabled={isSubmitting}
                isMobile={isMobile}
              />
            </YStack>
          ) : (
            <YStack flex={1}>
              <PriceInput
                onUseMidPrice={handleUseMidPriceForPrice}
                value={
                  formData.type === 'limit'
                    ? formData.price
                    : intl.formatMessage({
                        id: ETranslations.perp_market_price,
                      })
                }
                onChange={(value) => updateForm({ price: value })}
                szDecimals={sizeSzDecimals}
                isSpot={isSpot}
                isMobile={isMobile}
                disabled={formData.type === 'market'}
              />
            </YStack>
          )}
          {formData.type === 'limit' ? (
            <Badge
              testID={PerpTestIDs.BBOToggleButton}
              borderRadius="$2"
              bg="$bgSubdued"
              borderWidth="$px"
              borderColor={isBBOActive ? '$borderActive' : '$bgSubdued'}
              onPress={handleBBOToggle}
              px="$3"
              h={isMobile ? 38 : 40}
              alignItems="center"
              cursor="default"
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgHover',
              }}
              disabled={isSubmitting}
            >
              {isMobile ? (
                <DashText
                  size="$bodyMdMedium"
                  dashColor="$text"
                  dashThickness={0}
                >
                  {intl.formatMessage({
                    id: ETranslations.Perps_BBO_button_title,
                  })}
                </DashText>
              ) : (
                <Tooltip
                  renderTrigger={
                    <DashText
                      size="$bodyMdMedium"
                      dashColor="$text"
                      dashThickness={0.5}
                    >
                      {intl.formatMessage({
                        id: ETranslations.Perps_BBO_button_title,
                      })}
                    </DashText>
                  }
                  renderContent={intl.formatMessage({
                    id: ETranslations.Perps_BBO_button_desc,
                  })}
                  placement="top-end"
                />
              )}
            </Badge>
          ) : null}
        </XStack>
      );
    }
    return null;
  };

  const renderTimeInForceSection = () => {
    if (shouldShowScaleTif) {
      return (
        <XStack flexShrink={0} justifyContent="flex-end">
          <TimeInForceSelector
            testID="perp-scale-tif-selector"
            value={formData.scaleTif ?? 'Gtc'}
            onChange={(nextTif) => updateForm({ scaleTif: nextTif })}
            disabled={isSubmitting}
            isMobile={isMobile}
          />
        </XStack>
      );
    }

    return null;
  };

  const renderScaleAuxiliarySection = () => {
    if (!isScaleMode) {
      return null;
    }

    return (
      <XStack
        width="100%"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={isMobile ? '$3' : '$4'}
      >
        <YStack flex={1} minWidth={0}>
          {renderScaleAmountDistributionSection()}
        </YStack>
        {renderTimeInForceSection()}
      </XStack>
    );
  };

  const renderTwapDurationSection = () => {
    if (!isTwapMode) {
      return null;
    }

    const quickOptionHeight = isMobile ? 28 : 26;
    const renderTwapHelperMessage = () => {
      if (!twapHelperMessage) {
        return null;
      }

      return (
        <YStack gap="$1">
          <SizableText size="$bodySm" color="$textSubdued">
            {twapHelperMessage}
          </SizableText>
        </YStack>
      );
    };

    if (isMobile) {
      return (
        <YStack gap="$2.5">
          <TradingFormInput
            label={intl.formatMessage({
              id: ETranslations.perp_twap_duration__title,
            })}
            placeholder={twapDurationLabel}
            value={formData.twapDurationMinutes ?? ''}
            onChange={(value) => {
              const nextValue = value.replace(/[^\d]/g, '');
              const nextDuration = nextValue
                ? String(clampTwapDurationMinutes(Number(nextValue)))
                : '';
              updateForm({ twapDurationMinutes: nextDuration });
            }}
            keyboardType="numeric"
            suffix="min"
            isMobile
            disabled={isSubmitting}
          />
          <XStack gap="$2" width="100%">
            {TWAP_DURATION_PRESET_OPTIONS.map((option) => {
              return (
                <XStack
                  key={option.minutes}
                  flex={1}
                  minWidth={0}
                  h={quickOptionHeight}
                  px="$2"
                  bg="$bgSubdued"
                  borderRadius="$2"
                  alignItems="center"
                  justifyContent="center"
                  cursor="pointer"
                  onPress={() => handleTwapDurationPresetPress(option.minutes)}
                  opacity={isSubmitting ? 0.5 : 1}
                  pointerEvents={isSubmitting ? 'none' : 'auto'}
                >
                  <SizableText size="$bodySmMedium" color="$textSubdued">
                    {option.label}
                  </SizableText>
                </XStack>
              );
            })}
          </XStack>
          {renderTwapHelperMessage()}
          {twapDurationInputMessage ? (
            <SizableText size="$bodySm" color="$red10">
              {twapDurationInputMessage.text}
            </SizableText>
          ) : null}
        </YStack>
      );
    }

    const inputHeight = 32;
    const inputWrapperProps = {
      bg: '$bgStrong' as const,
      py: '$1' as const,
      pl: '$1' as const,
      pr: '$2.5' as const,
    };

    const renderTwapDurationInput = ({
      field,
      testID,
      value,
      unit,
      onChangeText,
    }: {
      field: ITwapDurationInputField;
      testID: string;
      value: string;
      unit: 'h' | 'min';
      onChangeText: (text: string) => void;
    }) => (
      <YStack
        flex={1}
        minWidth={0}
        borderRadius="$2"
        borderWidth="$px"
        borderColor={
          focusedTwapDurationInput === field ? '$border' : '$transparent'
        }
        {...inputWrapperProps}
      >
        <Input
          testID={testID}
          size="small"
          h={inputHeight}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => {
            focusedTwapDurationInputRef.current = field;
            setFocusedTwapDurationInput(field);
          }}
          onBlur={() => {
            focusedTwapDurationInputRef.current = null;
            setFocusedTwapDurationInput((currentField) =>
              currentField === field ? null : currentField,
            );
          }}
          keyboardType="numeric"
          disabled={isSubmitting}
          placeholder="0"
          textAlign="right"
          containerProps={{
            bg: 'transparent',
            borderRadius: '$2',
            borderWidth: '$0',
          }}
          InputComponentStyle={{
            bg: 'transparent',
          }}
          addOnsContainerProps={{
            pr: '$0.5',
          }}
          addOns={[
            {
              renderContent: (
                <XStack
                  h="100%"
                  alignItems="center"
                  justifyContent="center"
                  pr="$0.5"
                >
                  <SizableText size="$bodyMdMedium" color="$textSubdued">
                    {unit}
                  </SizableText>
                </XStack>
              ),
            },
          ]}
        />
      </YStack>
    );

    return (
      <YStack gap="$3">
        <DashText
          size="$bodySm"
          color="$textSubdued"
          dashColor="$textDisabled"
          dashThickness={0.5}
          tooltip={twapHelperText}
          tooltipDisplayMode={isMobile ? 'popover' : 'tooltip'}
          tooltipPlacement="bottom-start"
          tooltipTitle={intl.formatMessage({
            id: ETranslations.perp_twap_duration__title,
          })}
        >
          {twapDurationLabel}
        </DashText>
        <XStack gap="$2.5">
          {renderTwapDurationInput({
            field: 'hours',
            testID: 'perp-twap-duration-hours-input',
            value: twapDurationHoursInput,
            unit: 'h',
            onChangeText: handleTwapHoursChange,
          })}
          {renderTwapDurationInput({
            field: 'minutes',
            testID: 'perp-twap-duration-minutes-input',
            value: twapDurationMinutesInput,
            unit: 'min',
            onChangeText: handleTwapMinutesChange,
          })}
        </XStack>
        <XStack gap="$2" width="100%">
          {TWAP_DURATION_PRESET_OPTIONS.map((option) => {
            return (
              <XStack
                key={option.minutes}
                flex={1}
                minWidth={0}
                h={quickOptionHeight}
                px="$2"
                bg="$bgStrong"
                borderRadius="$2"
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                onPress={() => handleTwapDurationPresetPress(option.minutes)}
                opacity={isSubmitting ? 0.5 : 1}
                pointerEvents={isSubmitting ? 'none' : 'auto'}
              >
                <SizableText size="$bodySmMedium" color="$textSubdued">
                  {option.label}
                </SizableText>
              </XStack>
            );
          })}
        </XStack>
        {renderTwapHelperMessage()}
        {twapDurationInputMessage ? (
          <SizableText size="$bodySm" color="$red10">
            {twapDurationInputMessage.text}
          </SizableText>
        ) : null}
      </YStack>
    );
  };

  const checkboxSizeVal = isMobile ? '$3.5' : '$4';
  const tpLabelKey = isMobile
    ? ETranslations.perp_tp
    : ETranslations.perp_trade_tp_price;
  const slLabelKey = isMobile
    ? ETranslations.perp_sl
    : ETranslations.perp_trade_sl_price;
  const reduceOnlyLabel = intl.formatMessage({
    id: ETranslations.perps_reduce_only,
  });

  const renderReduceOnlyCheckbox = ({
    testID,
    value,
    onChange,
  }: {
    testID: string;
    value: boolean;
    onChange: (checked: boolean) => void;
  }) => (
    <Checkbox
      testID={testID}
      value={value}
      onChange={(checked) => onChange(!!checked)}
      disabled={isSubmitting}
      label={reduceOnlyLabel}
      containerProps={{
        p: 0,
        alignItems: 'center',
        cursor: isSubmitting ? 'default' : 'pointer',
      }}
      labelProps={{
        fontSize: isMobile ? '$bodySm' : '$bodyMdMedium',
        fontWeight: isMobile ? '400' : '500',
        color: '$text',
      }}
      width={checkboxSizeVal}
      height={checkboxSizeVal}
      {...(isMobile && { p: '$0' })}
    />
  );

  const renderBottomSection = () => {
    if (reserveMobileEnableTradingLayout) {
      return null;
    }
    if (isSpot && !isTwapMode) {
      return null;
    }
    if (isTwapMode) {
      return (
        <YStack width="100%" gap="$1.5" {...(isMobile && { mt: '$1' })} p="$0">
          <YStack width="100%" alignItems="flex-start" gap="$2.5">
            {isSpot
              ? null
              : renderReduceOnlyCheckbox({
                  testID: 'perp-twap-reduce-only-checkbox',
                  value: formData.twapReduceOnly ?? false,
                  onChange: (checked) =>
                    updateForm({ twapReduceOnly: checked }),
                })}
            <XStack alignItems="center" gap="$2">
              <Checkbox
                testID="perp-twap-randomize-checkbox"
                value={formData.twapRandomize ?? true}
                onChange={(checked) => updateForm({ twapRandomize: !!checked })}
                disabled={isSubmitting}
                containerProps={{
                  p: 0,
                  alignItems: 'center',
                  ...(!isMobile && { cursor: 'pointer' }),
                }}
                width={checkboxSizeVal}
                height={checkboxSizeVal}
                {...(isMobile && { p: '$0' })}
              />
              <Tooltip
                placement="top"
                triggerAsChild="except-style"
                renderContent={intl.formatMessage({
                  id: ETranslations.perp_twap_randomize__desc,
                })}
                renderTrigger={
                  <Stack display="inline-flex" alignSelf="flex-start">
                    <DashText
                      size={isMobile ? '$bodySm' : '$bodyMdMedium'}
                      color="$text"
                      dashColor="$textDisabled"
                      dashThickness={0.5}
                      cursor="help"
                    >
                      {intl.formatMessage({
                        id: ETranslations.perp_twap_randomize__title,
                      })}
                    </DashText>
                  </Stack>
                }
              />
            </XStack>
            {twapEstimatedSliceNotionalDisplay ? (
              <XStack
                width="100%"
                alignItems="center"
                justifyContent="space-between"
                gap="$3"
              >
                <SizableText
                  size={isMobile ? '$bodySm' : '$bodyMdMedium'}
                  color="$textSubdued"
                  flex={1}
                  numberOfLines={1}
                >
                  {intl.formatMessage({
                    id: ETranslations.perp_twap_child_order_size__title,
                  })}
                </SizableText>
                <SizableText
                  size={isMobile ? '$bodySmMedium' : '$bodyMdMedium'}
                  color="$text"
                  numberOfLines={1}
                >
                  {twapEstimatedSliceNotionalDisplay}
                </SizableText>
              </XStack>
            ) : null}
          </YStack>
        </YStack>
      );
    }
    if (isScaleMode) {
      if (isSpot) {
        return null;
      }
      return (
        <YStack gap="$1.5" {...(isMobile && { mt: '$1' })} p="$0">
          <XStack alignItems="center" justifyContent="space-between" gap="$3">
            {renderReduceOnlyCheckbox({
              testID: 'perp-scale-reduce-only-checkbox',
              value: formData.scaleReduceOnly ?? false,
              onChange: (checked) => updateForm({ scaleReduceOnly: checked }),
            })}
          </XStack>
        </YStack>
      );
    }
    if (isTriggerMode) {
      return (
        <YStack gap="$1" {...(isMobile && { mt: '$1' })} p="$0">
          {renderReduceOnlyCheckbox({
            testID: PerpTestIDs.TriggerReduceOnlyCheckbox,
            value: triggerReduceOnly,
            onChange: (checked) => updateForm({ triggerReduceOnly: checked }),
          })}
        </YStack>
      );
    }
    const standardLimitTifSelector = shouldShowLimitTif ? (
      <TimeInForceSelector
        testID="perp-limit-tif-selector"
        value={formData.limitTif ?? 'Gtc'}
        onChange={(nextTif) => updateForm({ limitTif: nextTif })}
        disabled={isSubmitting}
        isMobile={isMobile}
      />
    ) : null;

    return (
      <YStack gap="$1" {...(isMobile && { mt: '$1' })} p="$0">
        <XStack
          width="100%"
          alignItems="center"
          justifyContent="space-between"
          gap="$3"
        >
          <XStack alignItems="center" gap="$2">
            <Checkbox
              testID={PerpTestIDs.TpslCheckbox}
              value={formData.hasTpsl}
              onChange={handleTpslCheckboxChange}
              disabled={isSubmitting}
              containerProps={{
                p: 0,
                alignItems: 'center',
                ...(!isMobile && { cursor: 'pointer' }),
              }}
              width={checkboxSizeVal}
              height={checkboxSizeVal}
              {...(isMobile && { p: '$0' })}
            />

            <XStack alignItems="center" pt="$0.5">
              <DashText
                size={isMobile ? '$bodySm' : '$bodyMd'}
                dashColor="$textDisabled"
                dashThickness={0.5}
                tooltip={intl.formatMessage({
                  id: ETranslations.perp_tp_sl_tooltip,
                })}
                tooltipDisplayMode={isMobile ? 'popover' : 'tooltip'}
                tooltipTitle={intl.formatMessage({
                  id: ETranslations.perp_position_tp_sl,
                })}
              >
                {intl.formatMessage({
                  id: ETranslations.perp_position_tp_sl,
                })}
              </DashText>
            </XStack>
          </XStack>

          {standardLimitTifSelector}
        </XStack>

        {formData.hasTpsl ? (
          <YStack gap="$2">
            <TpSlFormInput
              type="tp"
              label={intl.formatMessage({
                id: tpLabelKey,
              })}
              value={formData.tpValue || ''}
              inputType={formData.tpType || 'price'}
              referencePrice={referencePriceString}
              szDecimals={sizeSzDecimals}
              onChange={handleTpValueChange}
              onTypeChange={handleTpTypeChange}
              disabled={isSubmitting}
              isMobile={isMobile}
            />
            <TpSlFormInput
              type="sl"
              label={intl.formatMessage({
                id: slLabelKey,
              })}
              value={formData.slValue || ''}
              inputType={formData.slType || 'price'}
              referencePrice={referencePriceString}
              szDecimals={sizeSzDecimals}
              onChange={handleSlValueChange}
              onTypeChange={handleSlTypeChange}
              disabled={isSubmitting}
              isMobile={isMobile}
            />
          </YStack>
        ) : null}
      </YStack>
    );
  };

  let activeAdvancedOrderType: ITriggerDropdownValue = triggerOrderType;
  if (isScaleMode) {
    activeAdvancedOrderType = 'scale';
  } else if (isTwapMode) {
    activeAdvancedOrderType = 'twap';
  }
  const triggerTabLabel =
    triggerTypeOptions.find(
      (item) =>
        item.value ===
        (isAdvancedOrderMode
          ? activeAdvancedOrderType
          : lastSelectableAdvancedOrderType),
    )?.label ||
    intl.formatMessage({ id: ETranslations.perp_order_trigger_market });

  let mobileSelectedOrderType: string = primaryOrderType;
  if (isTriggerMode) {
    mobileSelectedOrderType = triggerOrderType;
  }
  if (isTwapMode) {
    mobileSelectedOrderType = 'twap';
  }
  if (isScaleMode) {
    mobileSelectedOrderType = 'scale';
  }
  let triggerSelectValue: ITriggerDropdownValue = isAdvancedOrderMode
    ? triggerOrderType
    : lastSelectableAdvancedOrderType;
  if (isTwapMode) {
    triggerSelectValue = 'twap';
  }
  if (isScaleMode) {
    triggerSelectValue = 'scale';
  }

  const renderSpotTradeSummaryRows = () => (
    <>
      <XStack justifyContent="space-between" alignItems="center" gap="$3">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_available })}
        </SizableText>
        <XStack alignItems="center" gap="$1">
          {shouldShowEnableTradingLink ? (
            <XStack
              cursor="pointer"
              onPress={handleSpotEnableTradingPress}
              alignItems="center"
            >
              <SizableText
                size="$bodySmMedium"
                color={getTradingSideTextColor('long')}
                textDecorationLine="underline"
              >
                {intl.formatMessage({
                  id: ETranslations.perp_trade_button_enable_trading,
                })}
              </SizableText>
            </XStack>
          ) : (
            <>
              <SizableText size="$bodySmMedium">
                {spotAvailableDisplay}
              </SizableText>
              {spotAvailableToken === USDC_TOKEN_SYMBOL ? (
                <MobileDepositButton
                  onPress={handleSpotAvailableDepositPress}
                />
              ) : (
                <SpotAvailableActionPopover
                  onDeposit={handleSpotAvailableDepositPress}
                  onTrade={handleSpotAvailableTradePress}
                  tradeLabel={spotAvailableTradeLabel}
                  tradeToken={spotAvailableTradeToken}
                />
              )}
            </>
          )}
        </XStack>
      </XStack>

      <XStack justifyContent="space-between" alignItems="center" gap="$3">
        <DashText
          size="$bodySm"
          color="$textSubdued"
          dashThickness={0.5}
          tooltip={spotMaxTradeTooltip}
          tooltipDisplayMode={isMobile ? 'popover' : 'tooltip'}
          tooltipPlacement="top"
          tooltipTitle={spotMaxTradeLabel}
        >
          {spotMaxTradeLabel}
        </DashText>
        <SizableText size="$bodySmMedium">{spotMaxTradeDisplay}</SizableText>
      </XStack>
    </>
  );

  return (
    <YStack
      gap={isMobile ? '$2.5' : '$4'}
      pt={isMobile || isSpot ? '$0' : '$2.5'}
      flex={isSpot && isMobile ? 1 : undefined}
    >
      {isMobile ? (
        <YStack gap="$2.5" flexShrink={0}>
          {isSpot ? null : (
            <XStack alignItems="center" gap="$2.5">
              <YStack flex={1}>
                <MarginModeSelector
                  disabled={isSubmitting}
                  isMobile={isMobile}
                />
              </YStack>
              <LeverageAdjustModal isMobile={isMobile} />
            </XStack>
          )}

          <XStack alignItems="center" gap="$2.5">
            <YStack flex={1}>
              <MobileOrderTypeSelector
                value={mobileSelectedOrderType}
                options={mobileOrderTypeOptions}
                disabled={isSubmitting}
                onChange={(nextValue) => {
                  if (typeof nextValue !== 'string') {
                    return;
                  }
                  if (nextValue === 'market' || nextValue === 'limit') {
                    applyPrimaryOrderType(nextValue);
                    return;
                  }
                  handleTriggerOrderTypeChange(nextValue);
                }}
              />
            </YStack>
          </XStack>
          {isSpot ? (
            <TradeSideToggle
              value={formData.side}
              onChange={handleSideChange}
              isMobile={isMobile}
              isSpot
            />
          ) : null}
        </YStack>
      ) : (
        <>
          <YStack gap="$2">
            {isSpot ? null : (
              <XStack alignItems="center" flex={1} gap="$3">
                <YStack flex={1}>
                  <MarginModeSelector
                    disabled={isSubmitting}
                    isMobile={isMobile}
                  />
                </YStack>
                <LeverageAdjustModal isMobile={isMobile} />
              </XStack>
            )}

            <XStack
              h={DESKTOP_TRADING_HEADER_HEIGHT}
              alignItems="center"
              borderBottomWidth="$px"
              borderBottomColor="$borderSubdued"
            >
              {orderTypeOptions.map((option) => {
                const isFocused = primaryOrderType === option.value;
                return (
                  <XStack
                    h={DESKTOP_TRADING_HEADER_HEIGHT}
                    key={option.value}
                    mr="$4"
                    alignItems="center"
                    position="relative"
                    onPress={() => {
                      if (!isSubmitting) {
                        applyPrimaryOrderType(option.value);
                      }
                    }}
                    cursor="pointer"
                  >
                    <SizableText
                      size="$bodyMdMedium"
                      color={isFocused ? '$text' : '$textSubdued'}
                    >
                      {option.name}
                    </SizableText>
                    {isFocused ? (
                      <YStack
                        position="absolute"
                        bottom={0}
                        left={0}
                        right={0}
                        h="$0.5"
                        bg="$text"
                        borderRadius={1}
                      />
                    ) : null}
                  </XStack>
                );
              })}
              <Select
                testID="perp-select"
                items={triggerTypeOptions}
                title={intl.formatMessage({
                  id: ETranslations.perp_trade_order_type,
                })}
                value={triggerSelectValue}
                onOpenChange={setTriggerMenuOpen}
                onChange={handleTriggerOrderTypeChange}
                disabled={isSubmitting}
                placement="bottom-start"
                floatingPanelProps={{ width: 180 }}
                renderTrigger={({ onPress, disabled: disabledTrigger }) => (
                  <XStack
                    h={DESKTOP_TRADING_HEADER_HEIGHT}
                    alignItems="center"
                    position="relative"
                    gap="$1"
                    cursor="pointer"
                    onPress={(e) => {
                      if (disabledTrigger) return;
                      if (!isAdvancedOrderMode) {
                        applyPrimaryOrderType('trigger');
                      } else {
                        (onPress as ((event?: unknown) => void) | undefined)?.(
                          e,
                        );
                      }
                    }}
                  >
                    <SizableText
                      size="$bodyMdMedium"
                      color={isAdvancedOrderMode ? '$text' : '$textSubdued'}
                    >
                      {triggerTabLabel}
                    </SizableText>
                    <Icon
                      name={
                        triggerMenuOpen
                          ? 'ChevronTopSmallOutline'
                          : 'ChevronDownSmallOutline'
                      }
                      color={isAdvancedOrderMode ? '$icon' : '$iconSubdued'}
                      size="$4"
                    />
                    {isAdvancedOrderMode ? (
                      <YStack
                        position="absolute"
                        bottom={0}
                        left={0}
                        right={0}
                        h="$0.5"
                        bg="$text"
                        borderRadius={1}
                      />
                    ) : null}
                  </XStack>
                )}
              />
              {selectedOrderTypeInfo ? (
                <XStack ml="auto" alignItems="center">
                  <OrderTypeInfoButton
                    description={selectedOrderTypeInfo.description}
                    helpUrl={selectedOrderTypeInfo.helpUrl}
                    isMobile={isMobile}
                  />
                </XStack>
              ) : null}
            </XStack>
          </YStack>
        </>
      )}

      {isSpot && !isMobile ? (
        <TradeSideToggle
          value={formData.side}
          onChange={handleSideChange}
          isMobile={isMobile}
          isSpot
        />
      ) : null}

      {isSpot && isMobile ? null : (
        <YStack
          gap={isSpot ? '$1.5' : '$2.5'}
          {...(!isMobile && {
            flex: 1,
            p: '$2.5',
            borderWidth: '$px',
            borderColor: '$borderSubdued',
            borderRadius: '$2',
          })}
        >
          {isSpot ? (
            renderSpotTradeSummaryRows()
          ) : (
            <>
              <XStack justifyContent="space-between">
                <SizableText size="$bodySm" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.perp_trade_account_overview_available,
                  })}
                </SizableText>
                <XStack alignItems="center" gap="$1">
                  {shouldShowEnableTradingLink ? (
                    <XStack
                      cursor="pointer"
                      onPress={handleSpotEnableTradingPress}
                      alignItems="center"
                    >
                      <SizableText
                        size="$bodySmMedium"
                        color={getTradingSideTextColor('long')}
                        textDecorationLine="underline"
                      >
                        {intl.formatMessage({
                          id: ETranslations.perp_trade_button_enable_trading,
                        })}
                      </SizableText>
                    </XStack>
                  ) : (
                    <>
                      <PerpsAccountNumberValue
                        value={availableToTrade}
                        skeletonWidth={60}
                        allowValueDuringAccountLoading={
                          shouldDisplayAvailableToTradeDuringLoading
                        }
                        skipAccountSummaryCheck={
                          shouldDisplayAvailableToTradeDuringLoading
                        }
                      />
                      <MobileDepositButton onPress={handleDepositPress} />
                    </>
                  )}
                </XStack>
              </XStack>

              {isMobile ? null : (
                <XStack justifyContent="space-between">
                  <SizableText size="$bodySm" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.perp_trade_current_position,
                    })}
                  </SizableText>
                  {perpsAccountLoading?.selectAccountLoading ? (
                    <Skeleton width={60} height={16} />
                  ) : (
                    <SizableText
                      size="$bodySmMedium"
                      color={selectedSymbolPositionColor}
                    >
                      {selectedSymbolPositionValue} {perpsSelectedDisplayName}
                    </SizableText>
                  )}
                </XStack>
              )}
            </>
          )}
        </YStack>
      )}

      {isTwapMode ? null : renderPriceInputSection()}

      <SizeInput
        referencePrice={referencePriceString}
        side={formData.side}
        activeAsset={selectedTradeAsset}
        isAssetCtxReady={isSelectedTradeAssetCtxReady}
        symbol={activeBaseName || perpsSelectedDisplayName}
        value={formData.size}
        onChange={handleManualSizeChange}
        sizeInputMode={tradingComputed.sizeInputMode}
        sliderPercent={tradingComputed.sizePercent}
        onRequestManualMode={switchToManual}
        isMobile={isMobile}
        allowMarginInput={!isSpot}
        // Spot has no leverage concept — bypass formData.leverage (perps state)
        // to avoid stale perps leverage affecting spot size calculations.
        leverage={isSpot ? 1 : (formData.leverage ?? 1)}
      />

      <YStack>
        <PerpsSlider
          min={0}
          max={100}
          value={sliderValue}
          showBubble={false}
          onChange={handleSliderPercentChange}
          disabled={sliderDisabled}
          segments={4}
          snapTapToSegment
          sliderHeight={isMobile ? 2 : 4}
        />
      </YStack>

      {renderScaleAuxiliarySection()}

      {isTwapMode ? renderTwapDurationSection() : null}

      {renderBottomSection()}

      {isSpot && isMobile ? (
        <YStack gap="$0.5" pt="$0" pb="$1.5" mt="auto">
          {renderSpotTradeSummaryRows()}
        </YStack>
      ) : null}
    </YStack>
  );
}

const PerpTradingFormMemo = memo(PerpTradingForm);
export { PerpTradingFormMemo as PerpTradingForm };
