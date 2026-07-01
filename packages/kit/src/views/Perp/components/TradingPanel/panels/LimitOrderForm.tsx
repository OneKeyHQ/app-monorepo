import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { type IntlShape, useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  DashText,
  Dialog,
  SizableText,
  Skeleton,
  Toast,
  XStack,
  YStack,
  resetToRoute,
  useMedia,
} from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorCreateAddressButton } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorCreateAddressButton';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useSelectedAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  type IBBOPriceMode,
  type ITradingFormData,
  useActiveTradeInstrumentAtom,
  useBboForOrderPrice,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  perpsActiveAccountStatusAtom,
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountEnableTradingModeAtom,
  usePerpsActiveAccountIsAgentReadyAtom,
  usePerpsActiveAccountStatusAtom,
  usePerpsActiveAccountSummaryAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
  usePerpsActiveAssetCtxReadyAtom,
  usePerpsActiveAssetDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  useSpotActiveAssetAtom,
  useSpotActiveAssetCtxReadyAtom,
  useSpotBalancesAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/spot';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EOnboardingPages,
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  calculateLiquidationPrice,
  formatPriceToSignificantDigits,
  getSpotTokenDisplayName,
  parseDexCoin,
  resolveTradingSizeBN,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { ITIF } from '@onekeyhq/shared/types/hyperliquid/sdk';
import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  useConfirmHyperliquidTerms,
  useRequestEnableTradingWithDepositFallback,
} from '../../../hooks/useEnableTradingWithDepositFallback';
import { calculateOrderPrice } from '../../../hooks/useOrderPrice';
import { usePerpsAccountScopedActivePositions } from '../../../hooks/usePerpsAccountScopedActivePositions';
import { usePerpsMarketDataFreshness } from '../../../hooks/usePerpsMarketDataFreshness';
import { useShowDepositWithdrawModal } from '../../../hooks/useShowDepositWithdrawModal';
import { useTradingPrice } from '../../../hooks/useTradingPrice';
import { PerpsAccountSelectorProviderMirror } from '../../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../../PerpsProviderMirror';
import { getEnableTradingDialogConfirmDecision } from '../../../utils/enableTradingDialogConfirm';
import { shouldApplyMinimumOrderGuard } from '../../../utils/minimumOrderGuard';
import { shouldBlockPerpsTradingForMarketData } from '../../../utils/perpsMarketDataFreshness';
import { resolveTpSlTriggerPx } from '../../../utils/resolveTpSlTriggerPx';
import {
  PERP_TRADE_BUTTON_COLORS,
  getTradingSideTextColor,
} from '../../../utils/styleUtils';
import { PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS } from '../../PerpDialogLayout';
import { PerpsSlider } from '../../PerpsSlider';
import { PerpsAccountNumberValue } from '../components/PerpsAccountNumberValue';
import { PriceInput } from '../inputs/PriceInput';
import { SizeInput } from '../inputs/SizeInput';
import { TpSlFormInput } from '../inputs/TpSlFormInput';
import { showEnableTradingStepsDialog } from '../modals/EnableTradingStepsDialog';
import { showOrderConfirmDialog } from '../modals/OrderConfirmModal';
import { BBOSelector } from '../selectors/BBOSelector';
import { TimeInForceSelector } from '../selectors/TimeInForceSelector';

import {
  ORDER_TYPE_HELP_CENTER_URL,
  OrderTypeInfoButton,
} from './PerpTradingForm';

interface ILimitOrderFormProps {
  symbol: string;
  seededPrice: string;
  displayCoin?: string;
  onClose: () => void;
}

type ITradeSide = 'long' | 'short';
const accountActionSharedButtonProps = {
  size: 'medium' as const,
  borderRadius: '$full' as const,
  h: 44,
};

function getPositiveFiniteNumber(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function getPerpsAccountActionType({
  accountAddress,
  accountNotSupport,
  canCreateAddress,
}: {
  accountAddress?: string | null;
  accountNotSupport?: boolean;
  canCreateAddress?: boolean;
}) {
  if (!accountAddress || accountNotSupport) {
    return canCreateAddress ? 'createAddress' : 'connectWallet';
  }
  return null;
}

export function LimitOrderForm({
  symbol,
  seededPrice,
  displayCoin,
  onClose,
}: ILimitOrderFormProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const themeVariant = useThemeVariant();

  const [perpsAccount] = usePerpsActiveAccountAtom();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const [activeAssetCtx] = usePerpsActiveAssetCtxAtom();
  const [activeAssetData] = usePerpsActiveAssetDataAtom();
  const [isAssetCtxReady] = usePerpsActiveAssetCtxReadyAtom();
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [perpsAccountStatus] = usePerpsActiveAccountStatusAtom();
  const [enableTradingMode] = usePerpsActiveAccountEnableTradingModeAtom();
  const [{ isAgentReady }] = usePerpsActiveAccountIsAgentReadyAtom();
  const perpsPositions = usePerpsAccountScopedActivePositions();
  const { midPrice, midPriceBN } = useTradingPrice();
  const marketDataFreshness = usePerpsMarketDataFreshness();
  const confirmHyperliquidTerms = useConfirmHyperliquidTerms();
  const requestEnableTradingWithDepositFallback =
    useRequestEnableTradingWithDepositFallback();
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();

  // Spot has its own asset/balance atoms; perpsActiveAssetAtom is stale-perp
  // when the active instrument is spot.
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const isSpot = activeTradeInstrument.mode === 'spot';
  const [spotActiveAsset] = useSpotActiveAssetAtom();
  const [isSpotActiveAssetCtxReady] = useSpotActiveAssetCtxReadyAtom();
  const [{ balances: spotBalances }] = useSpotBalancesAtom();
  const spotUniverse = isSpot ? spotActiveAsset?.universe : undefined;

  // Close on coin drift. activeTradeInstrument.coin tracks the live instrument
  // for BOTH spot and perp; perpsActiveAssetAtom.coin is stale-perp on spot and
  // would always mismatch a spot symbol.
  useEffect(() => {
    if (activeTradeInstrument?.coin && activeTradeInstrument.coin !== symbol) {
      onClose();
    }
  }, [activeTradeInstrument?.coin, symbol, onClose]);

  // All form state is local; this never writes tradingFormAtom (the main panel's).
  const [side, setSide] = useState<ITradeSide>('long');
  const [price, setPrice] = useState(seededPrice);
  const [size, setSize] = useState('');
  const [sizeInputMode, setSizeInputMode] = useState<EPerpsSizeInputMode>(
    EPerpsSizeInputMode.MANUAL,
  );
  const [sizePercent, setSizePercent] = useState(0);
  const [limitTif, setLimitTif] = useState<ITIF>('Gtc');
  const [bboPriceMode, setBboPriceMode] = useState<IBBOPriceMode>(null);
  const [hasTpsl, setHasTpsl] = useState(false);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tpType, setTpType] = useState<'price' | 'percentage'>('price');
  const [tpValue, setTpValue] = useState('');
  const [slType, setSlType] = useState<'price' | 'percentage'>('price');
  const [slValue, setSlValue] = useState('');
  // Bumped whenever TP/SL inputs are programmatically re-seeded (TpSlFormInput
  // does not re-sync its internalValue on prop change).
  const [tpslSeedKey, setTpslSeedKey] = useState(0);

  const isBBOActive = Boolean(bboPriceMode);

  const szDecimals = isSpot
    ? (spotUniverse?.baseSzDecimals ?? 2)
    : (activeAsset?.universe?.szDecimals ?? 2);
  const leverage = useMemo(
    () =>
      isSpot
        ? 1
        : (getPositiveFiniteNumber(activeAssetData?.leverage?.value) ??
          getPositiveFiniteNumber(activeAsset?.universe?.maxLeverage) ??
          1),
    [
      isSpot,
      activeAssetData?.leverage?.value,
      activeAsset?.universe?.maxLeverage,
    ],
  );

  // Spot reuses the perps SizeInput via an asset shaped like IPerpsActiveAssetAtom
  // (spot universe + base szDecimals), mirroring the main trading panel.
  const selectedTradeAsset = useMemo(
    () =>
      isSpot
        ? ({
            coin: spotActiveAsset?.coin ?? activeTradeInstrument.coin,
            assetId: spotActiveAsset?.assetId,
            universe: { ...spotUniverse, szDecimals },
          } as typeof activeAsset)
        : activeAsset,
    [
      activeAsset,
      activeTradeInstrument.coin,
      isSpot,
      spotActiveAsset?.assetId,
      spotActiveAsset?.coin,
      spotUniverse,
      szDecimals,
    ],
  );

  const displayName = useMemo(
    () =>
      isSpot && spotUniverse?.baseName
        ? getSpotTokenDisplayName(spotUniverse.baseName)
        : (displayCoin ?? parseDexCoin(symbol).displayName),
    [displayCoin, isSpot, spotUniverse?.baseName, symbol],
  );

  // Track BBO + mid in refs so the side-button press handlers can resolve the
  // concrete price without depending on the latest render closure.
  const bbo = useBboForOrderPrice(isBBOActive);
  const bboRef = useRef(bbo);
  bboRef.current = bbo;
  const midPriceBNRef = useRef(midPriceBN);
  midPriceBNRef.current = midPriceBN;

  // With a BBO mode the price comes from the live orderbook; otherwise the typed input.
  const resolvePriceForSide = useCallback(
    (forSide: ITradeSide) =>
      calculateOrderPrice(
        'limit',
        price,
        bboPriceMode ?? undefined,
        bboRef.current,
        midPriceBNRef.current,
        forSide,
        'standard',
      ),
    [bboPriceMode, price],
  );

  const referencePriceBN = useMemo(
    () => resolvePriceForSide(side).price,
    [resolvePriceForSide, side],
  );
  const referencePriceString = referencePriceBN.gt(0)
    ? referencePriceBN.toFixed()
    : '';

  // Spot available balances (total minus on-hold), mirroring PerpTradingForm.
  const spotAvailableBaseBN = useMemo(() => {
    if (!spotUniverse?.baseName) {
      return new BigNumber(0);
    }
    const balance = spotBalances.find(
      (item) => item.coin === spotUniverse.baseName,
    );
    return balance
      ? BigNumber.max(new BigNumber(balance.total).minus(balance.hold ?? 0), 0)
      : new BigNumber(0);
  }, [spotBalances, spotUniverse?.baseName]);

  const spotAvailableQuoteBN = useMemo(() => {
    if (!spotUniverse?.quoteName) {
      return new BigNumber(0);
    }
    const balance = spotBalances.find(
      (item) => item.coin === spotUniverse.quoteName,
    );
    return balance
      ? BigNumber.max(new BigNumber(balance.total).minus(balance.hold ?? 0), 0)
      : new BigNumber(0);
  }, [spotBalances, spotUniverse?.quoteName]);

  // Full base holding (does NOT subtract `hold`): the position row must show what
  // the user owns, otherwise open sell orders shrink it into "available to sell".
  const spotHoldingBaseBN = useMemo(() => {
    if (!spotUniverse?.baseName) {
      return new BigNumber(0);
    }
    const balance = spotBalances.find(
      (item) => item.coin === spotUniverse.baseName,
    );
    return balance
      ? BigNumber.max(new BigNumber(balance.total), 0)
      : new BigNumber(0);
  }, [spotBalances, spotUniverse?.baseName]);

  // [buyMax, sellMax] in base-token units: buy is bounded by quote balance / price,
  // sell by the base-token balance.
  const computeSpotMaxTradeSzs = useCallback(
    (refPrice: BigNumber): [string, string] => {
      const effectivePriceBN =
        refPrice.isFinite() && refPrice.gt(0) ? refPrice : midPriceBN;
      const buyMax = effectivePriceBN.gt(0)
        ? spotAvailableQuoteBN.dividedBy(effectivePriceBN)
        : new BigNumber(0);
      return [
        buyMax.decimalPlaces(szDecimals, BigNumber.ROUND_FLOOR).toFixed(),
        spotAvailableBaseBN
          .decimalPlaces(szDecimals, BigNumber.ROUND_FLOOR)
          .toFixed(),
      ];
    },
    [midPriceBN, spotAvailableBaseBN, spotAvailableQuoteBN, szDecimals],
  );

  const computeSizeBN = useCallback(
    (forSide: ITradeSide, refPrice: BigNumber) => {
      const refPriceStr = refPrice.gt(0) ? refPrice.toFixed() : '';
      return resolveTradingSizeBN({
        sizeInputMode,
        manualSize: size,
        sizePercent,
        side: forSide,
        price: refPriceStr,
        markPrice: isSpot
          ? refPriceStr || midPrice
          : activeAssetCtx?.ctx?.markPrice,
        maxTradeSzs: isSpot
          ? computeSpotMaxTradeSzs(refPrice)
          : activeAssetData?.maxTradeSzs,
        leverageValue: isSpot ? 1 : activeAssetData?.leverage?.value,
        fallbackLeverage: isSpot ? 1 : activeAsset?.universe?.maxLeverage,
        szDecimals,
      });
    },
    [
      isSpot,
      computeSpotMaxTradeSzs,
      midPrice,
      activeAsset?.universe?.maxLeverage,
      activeAssetCtx?.ctx?.markPrice,
      activeAssetData?.leverage?.value,
      activeAssetData?.maxTradeSzs,
      size,
      sizeInputMode,
      sizePercent,
      szDecimals,
    ],
  );

  const currentCoinPosition = useMemo(
    () =>
      perpsPositions.filter(
        (pos) => pos.position.coin === activeAsset?.coin,
      )?.[0]?.position,
    [perpsPositions, activeAsset?.coin],
  );

  // Available-to-trade / current-position values for the summary card.
  const perpsAvailableToTrade = useMemo(() => {
    const available = activeAssetData?.availableToTrade;
    if (!available) {
      return '0';
    }
    const longValue = Number(available[0] ?? 0);
    const shortValue = Number(available[1] ?? 0);
    return new BigNumber(Math.min(longValue, shortValue)).toFixed(
      2,
      BigNumber.ROUND_DOWN,
    );
  }, [activeAssetData?.availableToTrade]);

  const [perpsPositionSize, perpsPositionSide] = useMemo(() => {
    const szi = Number(currentCoinPosition?.szi ?? 0);
    const positionSide: ITradeSide = szi >= 0 ? 'long' : 'short';
    return [Math.abs(szi), positionSide] as const;
  }, [currentCoinPosition?.szi]);
  const perpsPositionColor =
    perpsPositionSize > 0
      ? getTradingSideTextColor(perpsPositionSide)
      : '$text';

  const spotHoldingDisplay = useMemo(() => {
    if (!isSpot) {
      return '';
    }
    const baseName = spotUniverse?.baseName
      ? getSpotTokenDisplayName(spotUniverse.baseName)
      : '';
    return `${numberFormat(spotHoldingBaseBN.toFixed(), {
      formatter: 'balance',
    })} ${baseName}`;
  }, [isSpot, spotHoldingBaseBN, spotUniverse?.baseName]);
  const sideStats = useMemo(() => {
    const buildStats = (targetSide: ITradeSide) => {
      if (isSpot) {
        return {
          liquidationPriceBN: null,
          marginRequiredBN: new BigNumber(0),
        };
      }

      const sidePriceBN = resolvePriceForSide(targetSide).price;
      const sideSizeBN = computeSizeBN(targetSide, sidePriceBN);
      const sideMarginRequiredBN =
        !sideSizeBN.isFinite() ||
        sideSizeBN.lte(0) ||
        !sidePriceBN.isFinite() ||
        sidePriceBN.lte(0)
          ? new BigNumber(0)
          : sideSizeBN.multipliedBy(sidePriceBN).dividedBy(leverage || 1);

      const sideLiquidationPriceBN =
        !activeAssetData?.leverage?.type ||
        !sideSizeBN.isFinite() ||
        sideSizeBN.lte(0) ||
        !sidePriceBN.isFinite() ||
        sidePriceBN.lte(0)
          ? null
          : calculateLiquidationPrice({
              totalValue: sideSizeBN.multipliedBy(sidePriceBN),
              referencePrice: sidePriceBN,
              clampToCurrentMark: true,
              markPrice: activeAssetCtx?.ctx?.markPrice
                ? new BigNumber(activeAssetCtx.ctx.markPrice)
                : undefined,
              positionSize: sideSizeBN,
              side: targetSide,
              leverage,
              mode: activeAssetData.leverage.type,
              marginTiers: activeAsset?.margin?.marginTiers,
              maxLeverage: activeAsset?.universe?.maxLeverage || 1,
              crossMarginUsed: new BigNumber(
                accountSummary?.crossAccountValue || '0',
              ),
              crossMaintenanceMarginUsed: new BigNumber(
                accountSummary?.crossMaintenanceMarginUsed || '0',
              ),
              existingPositionSize: currentCoinPosition
                ? new BigNumber(currentCoinPosition.szi)
                : undefined,
              existingEntryPrice: currentCoinPosition
                ? new BigNumber(currentCoinPosition.entryPx)
                : undefined,
              newOrderSide: targetSide,
            });

      return {
        liquidationPriceBN: sideLiquidationPriceBN?.gt(0)
          ? sideLiquidationPriceBN
          : null,
        marginRequiredBN: sideMarginRequiredBN,
      };
    };

    return {
      long: buildStats('long'),
      short: buildStats('short'),
    };
  }, [
    accountSummary?.crossAccountValue,
    accountSummary?.crossMaintenanceMarginUsed,
    activeAsset?.margin?.marginTiers,
    activeAsset?.universe?.maxLeverage,
    activeAssetCtx?.ctx?.markPrice,
    activeAssetData?.leverage?.type,
    computeSizeBN,
    currentCoinPosition,
    isSpot,
    leverage,
    resolvePriceForSide,
  ]);

  const shouldShowEnableTrading = useMemo(
    () => isAgentReady === false || !perpsAccountStatus.canTrade,
    [isAgentReady, perpsAccountStatus.canTrade],
  );
  const isTradingActionLoading = Boolean(
    perpsAccountLoading.selectAccountLoading ||
    perpsAccountLoading.enableTradingLoading,
  );
  const shouldDisableActionButtons = Boolean(
    isTradingActionLoading || perpsAccountStatus.accountNotSupport,
  );
  const accountActionType = useMemo(
    () =>
      getPerpsAccountActionType({
        accountAddress: perpsAccount?.accountAddress,
        accountNotSupport: perpsAccountStatus.accountNotSupport,
        canCreateAddress: perpsAccountStatus.canCreateAddress,
      }),
    [
      perpsAccount?.accountAddress,
      perpsAccountStatus.accountNotSupport,
      perpsAccountStatus.canCreateAddress,
    ],
  );
  const shouldDisableAccountActionButtons = isTradingActionLoading;

  const handleConnectWallet = useCallback(async () => {
    onClose();
    if (platformEnv.isWebDappMode) {
      navigation.pushModal(EModalRoutes.OnboardingModal, {
        screen: EOnboardingPages.ConnectWalletOptions,
      });
    } else {
      resetToRoute(ERootRoutes.Onboarding, {
        screen: EOnboardingV2Routes.OnboardingV2,
        params: {
          screen: EOnboardingPagesV2.GetStarted,
        },
      });
    }
  }, [navigation, onClose]);

  const createAddressAccount = useMemo(
    () => ({
      ...selectedAccount,
      deriveType: perpsAccount.deriveType,
      indexedAccountId:
        perpsAccount.indexedAccountId || selectedAccount.indexedAccountId,
      networkId: getNetworkIdsMap().onekeyall,
    }),
    [perpsAccount.deriveType, perpsAccount.indexedAccountId, selectedAccount],
  );

  const ensureEnableTrading = useCallback(async () => {
    if (!shouldShowEnableTrading || shouldDisableActionButtons) {
      return true;
    }
    const closeLimitDialog = () => {
      onClose();
    };

    if (enableTradingMode.requiresExplicitEnableTrading) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await backgroundApiProxy.serviceHyperliquid.checkPerpsAccountStatus();
      } catch (error) {
        errorToastUtils.toastIfError(error);
        return false;
      }
      const latestPerpsAccountStatus =
        (await perpsActiveAccountStatusAtom.get()) ?? perpsAccountStatus;
      const confirmDecision = getEnableTradingDialogConfirmDecision(
        latestPerpsAccountStatus,
      );

      if (confirmDecision === 'continue') {
        return true;
      }

      if (confirmDecision === 'deposit') {
        closeLimitDialog();
        await showDepositWithdrawModal('deposit');
        return false;
      }

      const result = await showEnableTradingStepsDialog({
        accountStatus: latestPerpsAccountStatus,
        onConfirm: async ({ closeDialog }) => {
          const didAcceptTerms = await confirmHyperliquidTerms();
          if (!didAcceptTerms) {
            return {
              shouldContinue: false,
              status: undefined,
            };
          }
          return requestEnableTradingWithDepositFallback({
            beforeDeposit: closeDialog,
          });
        },
      });

      return Boolean(result?.shouldContinue);
    }

    const didAcceptTerms = await confirmHyperliquidTerms();
    if (!didAcceptTerms) {
      return false;
    }

    const result = await requestEnableTradingWithDepositFallback({
      beforeDeposit: closeLimitDialog,
    });
    return Boolean(result.shouldContinue);
  }, [
    confirmHyperliquidTerms,
    enableTradingMode.requiresExplicitEnableTrading,
    onClose,
    perpsAccountStatus,
    requestEnableTradingWithDepositFallback,
    shouldDisableActionButtons,
    shouldShowEnableTrading,
    showDepositWithdrawModal,
  ]);

  const spotOrderValueBN = useMemo(
    () => computeSizeBN(side, referencePriceBN).multipliedBy(referencePriceBN),
    [computeSizeBN, referencePriceBN, side],
  );
  const spotAvailableDisplay = useMemo(() => {
    if (!isSpot) {
      return '';
    }
    return side === 'long'
      ? `${spotAvailableQuoteBN.toFixed(2, BigNumber.ROUND_DOWN)} ${
          spotUniverse?.quoteName ?? ''
        }`.trim()
      : `${spotAvailableBaseBN.toFixed(
          szDecimals,
          BigNumber.ROUND_DOWN,
        )} ${displayName}`.trim();
  }, [
    isSpot,
    side,
    spotAvailableQuoteBN,
    spotAvailableBaseBN,
    spotUniverse?.quoteName,
    szDecimals,
    displayName,
  ]);

  // Size/slider/mode coordination replicates PerpTradingForm, in local state.
  const handleManualSizeChange = useCallback((value: string) => {
    setSize(value);
    setSizeInputMode(EPerpsSizeInputMode.MANUAL);
    setSizePercent(0);
  }, []);

  const switchToManual = useCallback(() => {
    setSizeInputMode((mode) => {
      if (mode === EPerpsSizeInputMode.SLIDER) {
        setSizePercent(0);
        setSize('');
        return EPerpsSizeInputMode.MANUAL;
      }
      return mode;
    });
  }, []);

  const handleSliderPercentChange = useCallback(
    (nextValue: number | number[]) => {
      const raw = Array.isArray(nextValue) ? nextValue[0] : nextValue;
      const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
      const clamped = Math.max(0, Math.min(100, value));
      setSizeInputMode(EPerpsSizeInputMode.SLIDER);
      setSizePercent(clamped);
      setSize('');
    },
    [],
  );

  const sliderValue =
    sizeInputMode === EPerpsSizeInputMode.SLIDER ? sizePercent : 0;
  const sliderEnabled = useMemo(() => {
    const maxBN = computeSizeBN(side, referencePriceBN);
    return referencePriceBN.gt(0) && maxBN.isFinite();
  }, [computeSizeBN, referencePriceBN, side]);

  const handleUseMidPrice = useCallback(() => {
    if (!midPrice) {
      return;
    }
    setPrice(formatPriceToSignificantDigits(midPrice, szDecimals));
  }, [midPrice, szDecimals]);

  const handleBBOToggle = useCallback(() => {
    setBboPriceMode((prev) =>
      prev ? null : { type: 'counterparty', level: 1 },
    );
  }, []);

  const handleTpslCheckboxChange = useCallback((checked: boolean) => {
    setHasTpsl(checked);
    if (!checked) {
      setTpValue('');
      setSlValue('');
      setTpslSeedKey((key) => key + 1);
    }
  }, []);

  const handlePlace = useCallback(
    async (pressedSide: ITradeSide) => {
      const isTradingReady = await ensureEnableTrading();
      if (!isTradingReady) {
        return;
      }

      // Abort if the active coin drifted from the snapshot — the form computes
      // off the live instrument, so a stale ticket must not submit against it.
      if (
        !activeTradeInstrument?.coin ||
        activeTradeInstrument.coin !== symbol
      ) {
        onClose();
        return;
      }

      setSide(pressedSide);

      // Same blocks as the main panel (validateOrderPanelState): the order
      // ticket holds independent state, so it must enforce them itself instead
      // of bypassing straight to submitOrder.
      if (shouldBlockPerpsTradingForMarketData(marketDataFreshness)) {
        Toast.error({
          title: intl.formatMessage({ id: ETranslations.perp_offline }),
          message: intl.formatMessage({
            id: ETranslations.perps_offline_moblie,
          }),
        });
        return;
      }

      const orderPrice = resolvePriceForSide(pressedSide);
      if (orderPrice.error || !orderPrice.isValid || orderPrice.price.lte(0)) {
        Toast.message({
          title: intl.formatMessage({
            id: ETranslations.perp_trade_price_place_holder,
          }),
        });
        return;
      }
      const resolvedPriceBN = orderPrice.price;
      const resolvedPrice = formatPriceToSignificantDigits(
        resolvedPriceBN,
        szDecimals,
      );

      const computedSizeBN = computeSizeBN(pressedSide, resolvedPriceBN);
      if (!computedSizeBN.isFinite() || computedSizeBN.lte(0)) {
        // A slider % resolving to 0 means no funds, so show that rather than the
        // misleading "enter amount" hint.
        const pickedPercentButNoFunds =
          sizeInputMode === EPerpsSizeInputMode.SLIDER && sizePercent > 0;
        let emptySizeMessageId = ETranslations.perp_trade_amount_place_holder;
        if (pickedPercentButNoFunds) {
          emptySizeMessageId = isSpot
            ? ETranslations.dexmarket_insufficient_balance
            : ETranslations.perp_insufficient_margin__title;
        }
        Toast.message({
          title: intl.formatMessage({ id: emptySizeMessageId }),
        });
        return;
      }

      const orderValueBN = computedSizeBN.multipliedBy(resolvedPriceBN);
      if (
        shouldApplyMinimumOrderGuard({
          isSpot,
          orderMode: 'standard',
          orderType: 'limit',
          hasBboPriceMode: Boolean(bboPriceMode),
        }) &&
        orderValueBN.gt(0) &&
        orderValueBN.lt(10)
      ) {
        Toast.message({
          title: intl.formatMessage(
            { id: ETranslations.perp_size_least },
            { amount: '$10' },
          ),
        });
        return;
      }

      let insufficientBalance: boolean;
      if (isSpot) {
        insufficientBalance =
          pressedSide === 'long'
            ? orderValueBN.gt(spotAvailableQuoteBN)
            : computedSizeBN.gt(spotAvailableBaseBN);
      } else if (reduceOnly) {
        // Reduce-only closes an existing position and consumes no new margin, so
        // the available-margin check must not block it (HL bounds it to the
        // position size); otherwise closing at zero free margin is impossible.
        insufficientBalance = false;
      } else {
        const available = activeAssetData?.availableToTrade;
        const sideAvailableBN = new BigNumber(
          (pressedSide === 'long' ? available?.[0] : available?.[1]) ?? 0,
        );
        insufficientBalance = orderValueBN
          .dividedBy(leverage > 0 ? leverage : 1)
          .gt(sideAvailableBN);
      }
      if (insufficientBalance) {
        Toast.message({
          title: intl.formatMessage({
            id: isSpot
              ? ETranslations.dexmarket_insufficient_balance
              : ETranslations.perp_insufficient_margin__title,
          }),
        });
        return;
      }

      const { tpTriggerPx, slTriggerPx } = resolveTpSlTriggerPx({
        hasTpsl,
        tpType,
        tpValue,
        slType,
        slValue,
        referencePrice: resolvedPriceBN,
        side: pressedSide,
        leverage,
      });

      // Normalize to a concrete manual token size so the confirm dialog display
      // and the submitted order stay consistent (slider sizes resolve to 0 in
      // the confirm content otherwise).
      const builtFormData: ITradingFormData = {
        side: pressedSide,
        type: 'limit',
        price: resolvedPrice,
        size: computedSizeBN.toFixed(),
        sizeInputMode: EPerpsSizeInputMode.MANUAL,
        sizePercent: 0,
        leverage,
        bboPriceMode: bboPriceMode ?? null,
        limitTif,
        // Reduce-only is a perps-only concept; spot has no position to reduce.
        reduceOnly: isSpot ? false : reduceOnly,
        hasTpsl: isSpot ? false : hasTpsl,
        tpTriggerPx: tpTriggerPx ?? '',
        tpGainPercent: '',
        slTriggerPx: slTriggerPx ?? '',
        slLossPercent: '',
        tpType,
        tpValue,
        slType,
        slValue,
        orderMode: 'standard',
      };

      showOrderConfirmDialog({
        overrideSide: pressedSide,
        formData: builtFormData,
        price: resolvedPrice,
        expectedCoin: symbol,
        intl,
        onConfirmSuccess: onClose,
      });
    },
    [
      activeTradeInstrument?.coin,
      activeAssetData?.availableToTrade,
      bboPriceMode,
      computeSizeBN,
      ensureEnableTrading,
      hasTpsl,
      intl,
      isSpot,
      leverage,
      limitTif,
      marketDataFreshness,
      onClose,
      reduceOnly,
      resolvePriceForSide,
      sizeInputMode,
      sizePercent,
      slType,
      slValue,
      spotAvailableBaseBN,
      spotAvailableQuoteBN,
      symbol,
      szDecimals,
      tpType,
      tpValue,
    ],
  );

  const longColors =
    themeVariant === 'light'
      ? PERP_TRADE_BUTTON_COLORS.light
      : PERP_TRADE_BUTTON_COLORS.dark;

  const createActionButtonRender = useCallback(
    (props: IButtonProps) => (
      <Button
        {...accountActionSharedButtonProps}
        testID="chart-limit-create-address"
        variant="primary"
        disabled={shouldDisableAccountActionButtons}
        loading={isTradingActionLoading}
        {...props}
      >
        {props.children}
      </Button>
    ),
    [isTradingActionLoading, shouldDisableAccountActionButtons],
  );

  const renderActionButton = useCallback(
    ({
      sideKey,
      bg,
      hoverBg,
      pressBg,
      defaultText,
      onDefaultPress,
    }: {
      sideKey: ITradeSide;
      bg: string;
      hoverBg: string;
      pressBg: string;
      defaultText: string;
      onDefaultPress: () => void;
    }) => {
      return (
        <Button
          testID={`chart-limit-${sideKey}-button`}
          size="medium"
          childrenAsText={false}
          borderRadius="$4"
          bg={bg}
          hoverStyle={shouldDisableActionButtons ? undefined : { bg: hoverBg }}
          pressStyle={shouldDisableActionButtons ? undefined : { bg: pressBg }}
          onPress={onDefaultPress}
          disabled={shouldDisableActionButtons}
          loading={isTradingActionLoading}
          h={36}
        >
          <SizableText size="$bodyMdMedium" color="$textOnColor">
            {defaultText}
          </SizableText>
        </Button>
      );
    },
    [isTradingActionLoading, shouldDisableActionButtons],
  );
  const sharedAccountActionButton = useMemo(() => {
    if (accountActionType === 'createAddress') {
      return (
        <AccountSelectorCreateAddressButton
          autoCreateAddress={false}
          num={0}
          account={createAddressAccount}
          buttonRender={createActionButtonRender}
        />
      );
    }

    if (accountActionType === 'connectWallet') {
      return (
        <Button
          {...accountActionSharedButtonProps}
          testID="chart-limit-connect-wallet"
          variant="primary"
          onPress={() => void handleConnectWallet()}
          disabled={shouldDisableAccountActionButtons}
          loading={isTradingActionLoading}
        >
          {intl.formatMessage({ id: ETranslations.global_connect_wallet })}
        </Button>
      );
    }

    return null;
  }, [
    accountActionType,
    createActionButtonRender,
    createAddressAccount,
    handleConnectWallet,
    intl,
    isTradingActionLoading,
    shouldDisableAccountActionButtons,
  ]);

  return (
    <YStack gap="$2.5">
      {/* Available / Current Position card, same style as the main trading panel. */}
      <YStack
        gap="$2.5"
        p="$2.5"
        borderWidth="$px"
        borderColor="$borderSubdued"
        borderRadius="$2"
      >
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_trade_account_overview_available,
            })}
          </SizableText>
          {isSpot ? (
            <SizableText size="$bodySmMedium" color="$text">
              {spotAvailableDisplay || '--'}
            </SizableText>
          ) : (
            <PerpsAccountNumberValue value={perpsAvailableToTrade} />
          )}
        </XStack>
        <XStack justifyContent="space-between" alignItems="center">
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
              color={isSpot ? '$text' : perpsPositionColor}
            >
              {isSpot
                ? spotHoldingDisplay || '--'
                : `${perpsPositionSize} ${displayName}`}
            </SizableText>
          )}
        </XStack>
      </YStack>

      {/* Price + BBO */}
      <XStack alignItems="center" gap="$2.5">
        {isBBOActive ? (
          <YStack flex={1}>
            <BBOSelector
              value={bboPriceMode}
              onChange={setBboPriceMode}
              inputLike
            />
          </YStack>
        ) : (
          <YStack flex={1}>
            <PriceInput
              value={price}
              onChange={setPrice}
              onUseMidPrice={midPrice ? handleUseMidPrice : undefined}
              szDecimals={szDecimals}
            />
          </YStack>
        )}
        <XStack
          borderRadius="$2"
          bg="$bgStrong"
          borderWidth="$px"
          borderColor="$transparent"
          px="$3"
          h={40}
          alignItems="center"
          cursor="pointer"
          hoverStyle={{ bg: '$bgStrong' }}
          pressStyle={{ bg: '$bgStrong' }}
          onPress={handleBBOToggle}
        >
          <DashText size="$bodyMdMedium" dashColor="$text" dashThickness={0.5}>
            {intl.formatMessage({ id: ETranslations.Perps_BBO_button_title })}
          </DashText>
        </XStack>
      </XStack>

      {/* Size + slider */}
      <SizeInput
        value={size}
        side={side}
        symbol={displayName}
        onChange={handleManualSizeChange}
        activeAsset={selectedTradeAsset}
        isAssetCtxReady={isSpot ? isSpotActiveAssetCtxReady : isAssetCtxReady}
        referencePrice={referencePriceString}
        sizeInputMode={sizeInputMode}
        sliderPercent={sizePercent}
        onRequestManualMode={switchToManual}
        allowMarginInput={!isSpot}
        leverage={leverage}
      />
      <PerpsSlider
        min={0}
        max={100}
        value={sliderValue}
        showBubble={false}
        onChange={handleSliderPercentChange}
        disabled={!sliderEnabled}
        segments={4}
        snapTapToSegment
        sliderHeight={4}
      />

      {!isSpot ? (
        <>
          {/* Reduce-only (perps only), mirroring the standard order panel. */}
          <XStack alignItems="center" mb="$2">
            <Checkbox
              testID="chart-limit-reduce-only-checkbox"
              value={reduceOnly}
              onChange={(checked) => setReduceOnly(!!checked)}
              label={intl.formatMessage({
                id: ETranslations.perps_reduce_only,
              })}
              containerProps={{
                p: 0,
                alignItems: 'center',
                cursor: 'pointer',
              }}
              labelProps={{
                size: '$bodyMd',
                color: '$text',
              }}
            />
          </XStack>

          {/* TP/SL */}
          <XStack
            width="100%"
            alignItems="center"
            justifyContent="space-between"
            gap="$3"
            mb="$2"
          >
            <XStack alignItems="center" gap="$2">
              <Checkbox
                testID="chart-limit-tpsl-checkbox"
                value={hasTpsl}
                onChange={(checked) => handleTpslCheckboxChange(!!checked)}
                containerProps={{
                  p: 0,
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              />
              <DashText
                size="$bodyMd"
                dashColor="$textDisabled"
                dashThickness={0.5}
                tooltip={intl.formatMessage({
                  id: ETranslations.perp_tp_sl_tooltip,
                })}
                tooltipTitle={intl.formatMessage({
                  id: ETranslations.perp_position_tp_sl,
                })}
              >
                {intl.formatMessage({ id: ETranslations.perp_position_tp_sl })}
              </DashText>
            </XStack>
            <TimeInForceSelector value={limitTif} onChange={setLimitTif} />
          </XStack>
          {hasTpsl ? (
            <YStack gap="$2">
              <TpSlFormInput
                key={`tp-${tpslSeedKey}`}
                type="tp"
                label={intl.formatMessage({
                  id: ETranslations.perp_trade_tp_price,
                })}
                value={tpValue}
                inputType={tpType}
                referencePrice={referencePriceString}
                szDecimals={szDecimals}
                onChange={setTpValue}
                onTypeChange={setTpType}
              />
              <TpSlFormInput
                key={`sl-${tpslSeedKey}`}
                type="sl"
                label={intl.formatMessage({
                  id: ETranslations.perp_trade_sl_price,
                })}
                value={slValue}
                inputType={slType}
                referencePrice={referencePriceString}
                szDecimals={szDecimals}
                onChange={setSlValue}
                onTypeChange={setSlType}
              />
            </YStack>
          ) : null}
        </>
      ) : null}

      {isSpot ? (
        <YStack gap="$1.5">
          <XStack justifyContent="space-between">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.perp_trade_order_value })}
            </SizableText>
            <SizableText size="$bodySmMedium" color="$text">
              {spotOrderValueBN.gt(0)
                ? `$${spotOrderValueBN.toFixed(2, BigNumber.ROUND_DOWN)}`
                : '--'}
            </SizableText>
          </XStack>
        </YStack>
      ) : null}

      {/* Buy / Sell */}
      {sharedAccountActionButton ? (
        <YStack gap="$2">{sharedAccountActionButton}</YStack>
      ) : (
        <XStack gap="$2.5">
          <YStack flex={1} gap="$2">
            {renderActionButton({
              sideKey: 'long',
              bg: longColors.long,
              hoverBg: longColors.longHover,
              pressBg: longColors.longPress,
              defaultText: intl.formatMessage({
                id: isSpot
                  ? ETranslations.dexmarket_details_transactions_buy
                  : ETranslations.perp_trade_long,
              }),
              onDefaultPress: () => void handlePlace('long'),
            })}
            {!isSpot ? (
              <YStack gap="$1.5">
                <XStack gap="$2" justifyContent="flex-start">
                  <DashText
                    size="$bodySm"
                    color="$textSubdued"
                    dashColor="$textDisabled"
                    dashThickness={0.5}
                    tooltip={intl.formatMessage({
                      id: ETranslations.perp_trade_margin_required,
                    })}
                    tooltipTitle={intl.formatMessage({
                      id: ETranslations.perp_cost,
                    })}
                  >
                    {intl.formatMessage({ id: ETranslations.perp_cost })}
                  </DashText>
                  <SizableText size="$bodySm" color="$text">
                    {sideStats.long.marginRequiredBN.gt(0)
                      ? `$${sideStats.long.marginRequiredBN.toFixed(
                          2,
                          BigNumber.ROUND_DOWN,
                        )}`
                      : '$0.00'}
                  </SizableText>
                </XStack>
                <XStack gap="$2" justifyContent="flex-start">
                  <DashText
                    size="$bodySm"
                    color="$textSubdued"
                    dashColor="$textDisabled"
                    dashThickness={0.5}
                    tooltip={intl.formatMessage({
                      id: ETranslations.perp_est_liq_price_tooltip,
                    })}
                    tooltipTitle={intl.formatMessage({
                      id: ETranslations.perp_est_liq_price,
                    })}
                  >
                    {intl.formatMessage({
                      id: ETranslations.perp_est_liq_price,
                    })}
                  </DashText>
                  <SizableText size="$bodySm" color="$text">
                    {sideStats.long.liquidationPriceBN
                      ? `$${formatPriceToSignificantDigits(
                          sideStats.long.liquidationPriceBN,
                          szDecimals,
                        )}`
                      : '--'}
                  </SizableText>
                </XStack>
              </YStack>
            ) : null}
          </YStack>
          <YStack flex={1} gap="$2">
            {renderActionButton({
              sideKey: 'short',
              bg: longColors.short,
              hoverBg: longColors.shortHover,
              pressBg: longColors.shortPress,
              defaultText: intl.formatMessage({
                id: isSpot
                  ? ETranslations.dexmarket_details_transactions_sell
                  : ETranslations.perp_trade_short,
              }),
              onDefaultPress: () => void handlePlace('short'),
            })}
            {!isSpot ? (
              <YStack gap="$1.5">
                <XStack gap="$2" justifyContent="flex-end">
                  <DashText
                    size="$bodySm"
                    color="$textSubdued"
                    dashColor="$textDisabled"
                    dashThickness={0.5}
                    tooltip={intl.formatMessage({
                      id: ETranslations.perp_trade_margin_required,
                    })}
                    tooltipTitle={intl.formatMessage({
                      id: ETranslations.perp_cost,
                    })}
                  >
                    {intl.formatMessage({ id: ETranslations.perp_cost })}
                  </DashText>
                  <SizableText size="$bodySm" color="$text">
                    {sideStats.short.marginRequiredBN.gt(0)
                      ? `$${sideStats.short.marginRequiredBN.toFixed(
                          2,
                          BigNumber.ROUND_DOWN,
                        )}`
                      : '$0.00'}
                  </SizableText>
                </XStack>
                <XStack gap="$2" justifyContent="flex-end">
                  <DashText
                    size="$bodySm"
                    color="$textSubdued"
                    dashColor="$textDisabled"
                    dashThickness={0.5}
                    tooltip={intl.formatMessage({
                      id: ETranslations.perp_est_liq_price_tooltip,
                    })}
                    tooltipTitle={intl.formatMessage({
                      id: ETranslations.perp_est_liq_price,
                    })}
                  >
                    {intl.formatMessage({
                      id: ETranslations.perp_est_liq_price,
                    })}
                  </DashText>
                  <SizableText size="$bodySm" color="$text">
                    {sideStats.short.liquidationPriceBN
                      ? `$${formatPriceToSignificantDigits(
                          sideStats.short.liquidationPriceBN,
                          szDecimals,
                        )}`
                      : '--'}
                  </SizableText>
                </XStack>
              </YStack>
            ) : null}
          </YStack>
        </XStack>
      )}
    </YStack>
  );
}

// symbol/price are snapshotted at open; LimitOrderForm closes and the confirm
// step re-asserts the live coin still matches, so a later active-asset switch
// cannot submit a stale ticket against another coin.
// Dialog title with the order-type info icon (reuses the panel's OrderTypeInfoButton).
function LimitOrderDialogTitle({ title }: { title: string }) {
  const intl = useIntl();
  const media = useMedia();
  return (
    <XStack alignItems="center" gap="$1.5">
      <Dialog.Title>{title}</Dialog.Title>
      <OrderTypeInfoButton
        description={intl.formatMessage({
          id: ETranslations.perp_order_type_limit_desc__desc,
        })}
        helpUrl={ORDER_TYPE_HELP_CENTER_URL}
        isMobile={!media.gtMd}
      />
    </XStack>
  );
}

export function showLimitOrderDialog({
  symbol,
  price,
  displayPair,
  displayCoin,
  intl,
}: {
  symbol: string;
  price: string;
  displayPair?: string;
  displayCoin?: string;
  intl: IntlShape;
}) {
  const displayName = displayPair ?? parseDexCoin(symbol).displayName;
  const titleText = `${intl.formatMessage({
    id: ETranslations.perp_trade_limit,
  })} · ${displayName}`;
  const dialogInstance = Dialog.show({
    // No `title` here: the custom Dialog.Header below supplies the single header
    // (title + info button); the default BasicDialogHeader renders it + close.
    renderContent: (
      <>
        <Dialog.Header>
          <LimitOrderDialogTitle title={titleText} />
        </Dialog.Header>
        <PerpsAccountSelectorProviderMirror>
          <PerpsProviderMirror>
            <LimitOrderForm
              symbol={symbol}
              seededPrice={price}
              displayCoin={displayCoin}
              onClose={() => {
                void dialogInstance.close();
              }}
            />
          </PerpsProviderMirror>
        </PerpsAccountSelectorProviderMirror>
      </>
    ),
    contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
    showFooter: false,
    onClose: () => {
      void dialogInstance.close();
    },
  });

  return dialogInstance;
}
