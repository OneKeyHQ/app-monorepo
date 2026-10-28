import {
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactElement } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Icon,
  Page,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { BorrowNavigation } from '../../../Borrow/borrowUtils';
import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { StakeProgress } from '../../../Staking/components/StakeProgress';
import { StakingAmountInput } from '../../../Staking/components/StakingAmountInput';
import {
  EarnFormRow,
  EarnFormSummary,
} from '../../../Staking/components/UniversalStake/EarnFormSummary';
import { EARN_DESKTOP_LOAN_LTV } from '../../components/desktopHome/earnDesktopHome.utils';
import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';
import { useEarnDesktopMarkets } from '../../components/desktopHome/useEarnDesktopHomeData';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { EarnNavigation } from '../../earnUtils';
import {
  EarnDoneHeader,
  formatDoneAmount,
} from '../EarnRouter/EarnDepositDone';
import { EARN_OFFER_ROUTES_COLUMN_WIDTH } from '../EarnRouter/earnRouter.utils';

import { LoanLtvBar } from './LoanLtvBar';
import {
  buildLoanRoutes,
  getLoanBorrowOptions,
  getLoanCollateralOptions,
  getLoanForLtv,
  getLoanForPositionLtv,
  getLoanHealthTone,
  getLoanLtvBar,
  getLoanRouteMetrics,
  pickLoanBorrowSymbol,
  rankLoanRoutes,
} from './loanRouter.utils';
import { EARN_LOAN_MODAL_SIZE } from './loanRouterModal';
import {
  LoanPairTitle,
  LoanRouteList,
  LoanTokenList,
  formatLoanFiat,
  formatLoanLtv,
  formatLoanNet,
  formatLoanPercent,
  formatLoanYearly,
  getLoanBlockText,
  isLendingClosed,
  isLoanLoss,
} from './LoanRouterParts';
import { useLoanToneColors } from './loanToneColors';
import { useLoanModalHeight } from './useLoanModalHeight';
import { useLoanRouterFacts } from './useLoanRouterFacts';
import { useLoanRouterRun } from './useLoanRouterRun';

import type { ILoanPositionAsset } from './loanRouter.utils';
import type { ILoanRouteItem } from './LoanRouterParts';
import type { ILoanRunDone, ILoanRunPlan } from './useLoanRouterRun';
import type { IEarnOutcome } from '../../../Staking/components/UniversalStake/EarnFormSummary';

// A collateral and a loan, and every market that takes the pair, as
// LlamaSwap's Borrow tab lays them out: the amounts on the left, the markets
// on the right, each worked out for the amounts. Unlike there, a market is
// picked in place and the loan is taken right here: one press supplies the
// collateral, then borrows

type IRouteParams = IModalStakingParamList[EModalStakingRoutes.EarnLoanRouter];

const toBigNumber = (value?: string) => {
  const parsed = new BigNumber(value ?? '');
  return parsed.isFinite() ? parsed : new BigNumber(0);
};

// The collateral's share of the wallet a chip puts in the box
const shareOf = (balance: string, percent: number, decimals: number) =>
  toBigNumber(balance)
    .times(percent)
    .div(100)
    .decimalPlaces(Math.min(decimals, 8), BigNumber.ROUND_DOWN)
    .toFixed();

const formatHealth = (value: number) =>
  value >= 100 ? '>100' : new BigNumber(value).toFixed(2);

const noop = () => undefined;

const isSameSymbol = (a: string, b: string) =>
  a.toUpperCase() === b.toUpperCase();

const isElement = (node: ReactElement | null): node is ReactElement =>
  isValidElement(node);

// The position's assets with the plan's own, once it is in it
const withAsset = (
  assets: ILoanPositionAsset[],
  token?: { symbol: string; logoURI?: string },
) =>
  token && !assets.some((asset) => isSameSymbol(asset.symbol, token.symbol))
    ? [...assets, { symbol: token.symbol, logoURI: token.logoURI }]
    : assets;

function RowValue({
  children,
  toneColor,
}: {
  children: string;
  toneColor?: string;
}) {
  return (
    <SizableText
      size="$bodyMdMedium"
      textAlign="right"
      style={toneColor ? { color: toneColor } : undefined}
    >
      {children}
    </SizableText>
  );
}

function HealthFactorValue({
  before,
  after,
}: {
  before?: number;
  after?: number;
}) {
  const toneText = useLoanToneColors().text;
  if (after === undefined) {
    return <RowValue>–</RowValue>;
  }
  return (
    <XStack ai="center" gap="$1.5">
      {before !== undefined ? (
        <>
          <SizableText
            size="$bodySm"
            style={{ color: toneText[getLoanHealthTone(before)] }}
          >
            {formatHealth(before)}
          </SizableText>
          <Icon name="ArrowRightOutline" size="$4" color="$iconDisabled" />
        </>
      ) : null}
      <RowValue toneColor={toneText[getLoanHealthTone(after)]}>
        {formatHealth(after)}
      </RowValue>
    </XStack>
  );
}

// The position's LTV, before and after once amounts are typed
function LtvValue({
  before,
  after,
  isChanging,
  color,
}: {
  before?: number;
  after?: number;
  isChanging: boolean;
  color?: string;
}) {
  const shown = isChanging ? after : (before ?? after);
  if (shown === undefined) {
    return <RowValue>–</RowValue>;
  }
  return (
    <XStack ai="center" gap="$1.5">
      {isChanging && before !== undefined ? (
        <>
          <SizableText size="$bodySm" color="$textSubdued">
            {formatLoanLtv(before)}
          </SizableText>
          <Icon name="ArrowRightOutline" size="$4" color="$iconDisabled" />
        </>
      ) : null}
      <RowValue toneColor={color}>{formatLoanLtv(shown)}</RowValue>
    </XStack>
  );
}

// A position's assets, overlapping, the first on top
const LOGOS_SHOWN = 4;
function AssetLogos({ assets }: { assets: ILoanPositionAsset[] }) {
  if (!assets.length) {
    return null;
  }
  const shown = assets.slice(0, LOGOS_SHOWN);
  return (
    <XStack ai="center">
      {shown.map((asset, index) => (
        <Stack
          key={asset.symbol}
          ml={index ? '$-1.5' : undefined}
          zIndex={shown.length - index}
          borderRadius="$full"
          borderWidth={2}
          borderColor="$bgApp"
        >
          <Token size="xs" tokenImageUri={asset.logoURI} />
        </Stack>
      ))}
      {assets.length > LOGOS_SHOWN ? (
        <SizableText size="$bodySm" color="$textSubdued" ml="$1">
          {`+${assets.length - LOGOS_SHOWN}`}
        </SizableText>
      ) : null}
    </XStack>
  );
}

function PositionValue({
  assets,
  before,
  after,
  isChanging,
  currency,
}: {
  assets: ILoanPositionAsset[];
  before: number;
  after: number;
  isChanging: boolean;
  currency: string;
}) {
  return (
    <XStack ai="center" gap="$2">
      <AssetLogos assets={assets} />
      {isChanging ? (
        <>
          <SizableText size="$bodySm" color="$textSubdued">
            {formatLoanFiat(before, currency)}
          </SizableText>
          <Icon name="ArrowRightOutline" size="$4" color="$iconDisabled" />
        </>
      ) : null}
      <RowValue>
        {formatLoanFiat(isChanging ? after : before, currency)}
      </RowValue>
    </XStack>
  );
}

// A block's line, its label on the left and its value on the right, as a
// placeholder of the line's height
function SkeletonFormRow({
  height,
  hasNote,
}: {
  height: number;
  hasNote?: boolean;
}) {
  return (
    <XStack h={height} jc="space-between" ai="flex-start">
      <Skeleton.BodyMd w={88} />
      <YStack ai="flex-end">
        <Skeleton.BodyMd w={56} />
        {hasNote ? <Skeleton.BodySm w={96} /> : null}
      </YStack>
    </XStack>
  );
}

// The way from the loan's market here to the market's own page, where the
// whole position is managed: repaying, collateral, borrowing more
function PositionManageLink({ onPress }: { onPress: () => void }) {
  const intl = useIntl();
  const [isHovered, setIsHovered] = useState(false);
  return (
    <XStack
      testID="earn-loan-position-manage"
      role="button"
      ai="center"
      gap="$0.5"
      ml="auto"
      flexShrink={0}
      cursor="pointer"
      userSelect="none"
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      pressStyle={{ opacity: 0.5 }}
      onPress={onPress}
      {...buildKeyboardPressProps(onPress, 2)}
    >
      <SizableText
        size="$bodyMdMedium"
        color={isHovered ? '$text' : '$textSubdued'}
      >
        {intl.formatMessage({ id: ETranslations.global_manage })}
      </SizableText>
      <Icon
        name="ChevronRightSmallOutline"
        size="$5"
        color={isHovered ? '$icon' : '$iconSubdued'}
      />
    </XStack>
  );
}

// While the market's figures load, the place of the account's position
// there, line for line (its title, Collateral, Borrowed and the health
// factor with its note), so the modal opens at the size it settles at
// where the account has a position, and shrinks once if it has none
function PositionSkeleton() {
  return (
    <YStack testID="earn-loan-position-loading" px="$3.5" gap="$3" aria-hidden>
      <XStack h={20} ai="center" gap="$2">
        <Skeleton w="$5" h="$5" radius="round" />
        <Skeleton.BodyMd w={160} />
      </XStack>
      <SkeletonFormRow height={24} />
      <SkeletonFormRow height={24} />
      <SkeletonFormRow height={36} hasNote />
    </YStack>
  );
}

const FADE_IN = { opacity: 0 } as const;

function EarnLoanRouterPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.EarnLoanRouter
  >();
  const {
    collateral: routeCollateral,
    borrow: routeBorrow,
    routeKey,
    wide,
  } = route.params as IRouteParams;
  const { gtLg } = useMedia();
  const reduceMotion = useReducedMotion();
  const currencyInfo = useCurrency();
  const currency = currencyInfo.symbol;

  const [collateralSymbol, setCollateralSymbol] = useState(routeCollateral);
  const [borrowSymbol, setBorrowSymbol] = useState(routeBorrow);
  const [collateralAmount, setCollateralAmount] = useState('');
  // The loan typed by hand, an emptied box included; otherwise it follows
  // the LTV bar
  const [typedBorrow, setTypedBorrow] = useState<string>();
  // The market position's LTV the bar was dragged to. Until then the loan is
  // half the collateral's value, as the Loans list works its Net APY out
  const [draggedLtv, setDraggedLtv] = useState<number>();
  const toneColors = useLoanToneColors();
  // While the bar is dragged the markets keep their order
  const [isSliding, setIsSliding] = useState(false);
  const slideOrderRef = useRef<string[]>([]);
  const [pickedKey, setPickedKey] = useState<string | undefined>(routeKey);
  const [done, setDone] = useState<ILoanRunDone>();
  // After a press whose supply went in and whose loan didn't
  const [suppliedNote, setSuppliedNote] = useState<string>();

  const { markets, isLoaded: isMarketsLoaded } = useEarnDesktopMarkets({
    isActive: true,
  });
  const { result: stableAssets } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getAvailableAssets({
        type: EAvailableAssetsTypeEnum.StableCoins,
      }),
    [],
    { undefinedResultIfError: true },
  );
  const stableSymbols = useMemo(
    () =>
      new Set((stableAssets ?? []).map((asset) => asset.symbol.toUpperCase())),
    [stableAssets],
  );

  const collateralOptions = useMemo(
    () =>
      getLoanCollateralOptions({ markets, stableSymbols, isHeld: () => false }),
    [markets, stableSymbols],
  );
  const borrowOptions = useMemo(
    () => getLoanBorrowOptions({ markets, collateralSymbol, stableSymbols }),
    [collateralSymbol, markets, stableSymbols],
  );
  const routes = useMemo(
    () => buildLoanRoutes({ markets, collateralSymbol, borrowSymbol }),
    [borrowSymbol, collateralSymbol, markets],
  );
  const {
    byRoute,
    isLoaded: isFactsLoaded,
    refresh,
  } = useLoanRouterFacts({ routes });

  // The prices the boxes go by: the picked market's, else the first known
  const priceRoute = useMemo(() => {
    const picked = routes.find((item) => item.key === pickedKey);
    const withPrices = (key?: string) => {
      const facts = key ? byRoute.get(key) : undefined;
      return facts?.collateralPrice && facts?.borrowPrice ? facts : undefined;
    };
    return (
      withPrices(picked?.key) ??
      routes.map((item) => withPrices(item.key)).find(Boolean)
    );
  }, [byRoute, pickedKey, routes]);
  const borrowDecimals =
    routes.find((item) => item.key === pickedKey)?.borrow.decimals ??
    routes[0]?.borrow.decimals ??
    6;
  const newCollateralValue = priceRoute?.collateralPrice
    ? toBigNumber(collateralAmount).times(priceRoute.collateralPrice).toNumber()
    : 0;
  const borrowAmount =
    typedBorrow ??
    (draggedLtv !== undefined
      ? getLoanForPositionLtv({
          ltv: draggedLtv,
          collateralValue: priceRoute?.collateralValue ?? 0,
          debtValue: priceRoute?.debtValue ?? 0,
          newCollateralValue,
          borrowPrice: priceRoute?.borrowPrice,
          decimals: borrowDecimals,
        })
      : getLoanForLtv({
          collateralAmount,
          ltv: EARN_DESKTOP_LOAN_LTV,
          collateralPrice: priceRoute?.collateralPrice,
          borrowPrice: priceRoute?.borrowPrice,
          decimals: borrowDecimals,
        }));
  // Before amounts are typed, every market is worked out at the bar's LTV
  const previewLtv = draggedLtv ?? EARN_DESKTOP_LOAN_LTV;

  const rankedItems = useMemo<ILoanRouteItem[]>(
    () =>
      rankLoanRoutes(
        routes.map((item) => {
          const facts = byRoute.get(item.key);
          return {
            route: item,
            facts,
            metrics: getLoanRouteMetrics({
              route: item,
              facts,
              collateralAmount,
              borrowAmount,
              ltvStage: typedBorrow ? undefined : previewLtv,
            }),
          };
        }),
      ),
    [borrowAmount, byRoute, collateralAmount, previewLtv, routes, typedBorrow],
  );
  // A drag re-ranks the markets once it ends, not under the pointer
  const items = useMemo(() => {
    if (!isSliding) {
      return rankedItems;
    }
    const order = slideOrderRef.current;
    const at = (key: string) => {
      const index = order.indexOf(key);
      return index < 0 ? order.length : index;
    };
    return rankedItems.toSorted((a, b) => at(a.route.key) - at(b.route.key));
  }, [isSliding, rankedItems]);
  const pickedItem = items.find((item) => item.route.key === pickedKey);
  const usableItem = items.find((item) => !item.metrics.block);
  // The market of the row the modal opened from (or one picked while the
  // figures loaded) that doesn't lend the token to the account at all gives
  // way to the best one that can take the loan
  const isPickClosed =
    isFactsLoaded && isLendingClosed(pickedItem?.metrics.block);
  const selected =
    (isPickClosed ? usableItem : undefined) ??
    pickedItem ??
    usableItem ??
    items[0];
  // With no market picked, the best one is checked once every market's
  // figures are in, and stays checked: typing never moves the check to
  // another market or network. One it can't take any more shows why
  const isPickListed =
    pickedKey !== undefined && routes.some((item) => item.key === pickedKey);
  const autoPickKey =
    (!isPickListed || isPickClosed) && isFactsLoaded
      ? selected?.route.key
      : undefined;
  useEffect(() => {
    if (autoPickKey) {
      setPickedKey(autoPickKey);
    }
  }, [autoPickKey]);
  const selectedRoute = selected?.route;
  const selectedFacts = selected?.facts;
  const selectedMetrics = selected?.metrics;

  const handleDone = useCallback((info: ILoanRunDone) => {
    setSuppliedNote(undefined);
    setDone(info);
  }, []);
  const run = useLoanRouterRun({
    route: selectedRoute,
    networkAccountId: selectedFacts?.networkAccountId,
    onDone: handleDone,
  });
  const isLocked = run.phase !== 'idle';

  // A supply that went in without its loan: the collateral now counts in
  // the market, so the form goes on with the loan alone
  const { phase, pendingPlan, reset: resetRun } = run;
  const handledPendingRef = useRef<ILoanRunPlan | undefined>(undefined);
  useEffect(() => {
    if (
      phase !== 'borrowReady' ||
      !pendingPlan ||
      handledPendingRef.current === pendingPlan
    ) {
      return;
    }
    handledPendingRef.current = pendingPlan;
    setSuppliedNote(
      EARN_DESKTOP_DEMO_COPY.loanSupplied(
        formatDoneAmount(
          pendingPlan.collateralAmount,
          pendingPlan.route.collateral.symbol,
        ),
        pendingPlan.route.marketLabel,
      ),
    );
    setCollateralAmount('');
    setTypedBorrow(pendingPlan.borrowAmount);
    setDraggedLtv(undefined);
    resetRun();
    void refresh();
  }, [pendingPlan, phase, refresh, resetRun]);

  const collateralToken = selectedRoute?.collateral;
  const borrowToken = selectedRoute?.borrow;
  const collateralLogo =
    collateralToken?.logoURI ??
    collateralOptions.find((item) => item.symbol === collateralSymbol)?.logoURI;
  const borrowLogo =
    borrowToken?.logoURI ??
    borrowOptions.find((item) => item.symbol === borrowSymbol)?.logoURI;
  const networkLogoURI = selectedRoute?.market.network.logoURI;
  const walletBalance = selectedFacts?.walletBalance;

  const collateralValue =
    priceRoute?.collateralPrice !== undefined
      ? toBigNumber(collateralAmount).times(priceRoute.collateralPrice)
      : undefined;
  const borrowValue =
    priceRoute?.borrowPrice !== undefined
      ? toBigNumber(borrowAmount).times(priceRoute.borrowPrice)
      : undefined;

  // ---------- The two boxes ----------

  const handleCollateralChange = useCallback((value: string) => {
    setSuppliedNote(undefined);
    setCollateralAmount(value);
  }, []);
  const handleCollateralStage = useCallback(
    (percent: number) => {
      if (!walletBalance) {
        return;
      }
      setSuppliedNote(undefined);
      setCollateralAmount(
        shareOf(walletBalance, percent, collateralToken?.decimals ?? 8),
      );
    },
    [collateralToken?.decimals, walletBalance],
  );
  const handleCollateralMax = useCallback(() => {
    if (!walletBalance) {
      return;
    }
    setSuppliedNote(undefined);
    setCollateralAmount(
      shareOf(walletBalance, 100, collateralToken?.decimals ?? 8),
    );
  }, [collateralToken?.decimals, walletBalance]);
  // A token changed starts the loan over: half the collateral's value
  const resetLoan = useCallback(() => {
    setTypedBorrow(undefined);
    setDraggedLtv(undefined);
  }, []);
  // An emptied box stays empty: no loan until one is typed or the bar is
  // moved. Handed back to the bar, it filled itself again at once
  const handleBorrowChange = useCallback((value: string) => {
    setTypedBorrow(value);
  }, []);
  // Where the bar starts (what is borrowed in the market already), read at
  // the press
  const ltvStartRef = useRef(0);
  const handleLtvChange = useCallback((ltv: number) => {
    setTypedBorrow(undefined);
    // At the start there is no loan: kept as none, not as the LTV the start
    // sat at, so a price move can't make one up
    setDraggedLtv(ltv <= ltvStartRef.current + 1e-9 ? 0 : ltv);
  }, []);
  const handleSlideStart = useCallback(() => {
    slideOrderRef.current = items.map((item) => item.route.key);
    setIsSliding(true);
  }, [items]);
  const handleSlideEnd = useCallback(() => {
    setIsSliding(false);
  }, []);
  // Another market keeps the amounts, so the markets compare the same loan:
  // one the bar set stays as it is, and the bar shows it in that market
  const handlePickRoute = useCallback(
    (key: string) => {
      if (
        typedBorrow === undefined &&
        draggedLtv !== undefined &&
        borrowAmount
      ) {
        setTypedBorrow(borrowAmount);
        setDraggedLtv(undefined);
      }
      setPickedKey(key);
    },
    [borrowAmount, draggedLtv, typedBorrow],
  );

  const handleCollateralPick = useCallback(
    (symbol: string) => {
      setCollateralSymbol(symbol);
      setCollateralAmount('');
      setSuppliedNote(undefined);
      setPickedKey(undefined);
      resetLoan();
      const nextOptions = getLoanBorrowOptions({
        markets,
        collateralSymbol: symbol,
        stableSymbols,
      });
      const nextBorrow = pickLoanBorrowSymbol({
        options: nextOptions,
        current: borrowSymbol,
      });
      if (nextBorrow) {
        setBorrowSymbol(nextBorrow);
      }
    },
    [borrowSymbol, markets, resetLoan, stableSymbols],
  );
  // A loan typed in one token means nothing in another
  const handleBorrowPick = useCallback(
    (symbol: string) => {
      setBorrowSymbol(symbol);
      setPickedKey(undefined);
      resetLoan();
    },
    [resetLoan],
  );

  const collateralPopover = useMemo(
    () => ({
      title: intl.formatMessage({ id: ETranslations.defi_collateral }),
      content: function CollateralList({
        isOpen,
        closePopover,
      }: {
        isOpen?: boolean;
        closePopover: () => void;
      }) {
        return (
          <LoanTokenList
            testID="earn-loan-collateral-list"
            isOpen={isOpen}
            options={collateralOptions}
            selectedSymbol={collateralSymbol}
            onSelect={handleCollateralPick}
            closePopover={closePopover}
          />
        );
      },
    }),
    [collateralOptions, collateralSymbol, handleCollateralPick, intl],
  );
  const borrowPopover = useMemo(
    () => ({
      title: intl.formatMessage({ id: ETranslations.global_borrow }),
      content: function BorrowList({
        isOpen,
        closePopover,
      }: {
        isOpen?: boolean;
        closePopover: () => void;
      }) {
        return (
          <LoanTokenList
            testID="earn-loan-borrow-list"
            isOpen={isOpen}
            options={borrowOptions}
            selectedSymbol={borrowSymbol}
            onSelect={handleBorrowPick}
            closePopover={closePopover}
          />
        );
      },
    }),
    [borrowOptions, borrowSymbol, handleBorrowPick, intl],
  );

  const hasCollateral = toBigNumber(collateralAmount).gt(0);
  const hasLoan = toBigNumber(borrowAmount).gt(0);
  const isInsufficient =
    hasCollateral &&
    walletBalance !== undefined &&
    toBigNumber(collateralAmount).gt(walletBalance);

  // The most the picked market lends of the token with this collateral.
  // Where the account has nothing there yet, only once collateral is typed:
  // before, it would only say 0
  const availableToBorrow = (() => {
    const hasMarketCollateral = Boolean(
      selectedFacts &&
      (selectedFacts.collateralValue > 0 || selectedFacts.debtValue > 0),
    );
    if (
      !selectedRoute ||
      (!hasMarketCollateral && !toBigNumber(collateralAmount).gt(0)) ||
      selectedMetrics?.maxBorrow === undefined ||
      isLendingClosed(selectedMetrics.block) ||
      !selectedFacts?.borrowPrice
    ) {
      return undefined;
    }
    const byLiquidity =
      selectedFacts.liquidity !== undefined
        ? selectedFacts.liquidity / selectedFacts.borrowPrice
        : Number.POSITIVE_INFINITY;
    return new BigNumber(
      Math.max(0, Math.min(selectedMetrics.maxBorrow, byLiquidity)),
    )
      .decimalPlaces(
        Math.min(selectedRoute.borrow.decimals, 8),
        BigNumber.ROUND_DOWN,
      )
      .toFixed();
  })();

  const collateralBox = (
    <StakingAmountInput
      boxTestID="earn-loan-collateral"
      title={intl.formatMessage({ id: ETranslations.defi_collateral })}
      disabled={isLocked}
      hasError={isInsufficient}
      value={collateralAmount}
      onChange={handleCollateralChange}
      onSelectPercentageStage={handleCollateralStage}
      tokenSelectorTriggerProps={{
        selectedTokenImageUri: collateralLogo,
        selectedTokenImageLoading: !collateralLogo && !isMarketsLoaded,
        selectedNetworkImageUri: networkLogoURI,
        selectedTokenSymbol: collateralSymbol,
        popover: collateralOptions.length ? collateralPopover : undefined,
      }}
      valueProps={{
        value: collateralValue?.toFixed(),
        currency,
      }}
      balanceProps={{
        value: walletBalance,
        loading: Boolean(selectedRoute) && !selectedFacts,
        onPress: handleCollateralMax,
      }}
      enableMaxAmount
      maxAmountText={intl.formatMessage({ id: ETranslations.global_max })}
      inputProps={{ testID: 'earn-loan-collateral-input', placeholder: '0' }}
    />
  );
  const borrowBox = (
    <StakingAmountInput
      boxTestID="earn-loan-borrow"
      title={intl.formatMessage({ id: ETranslations.global_borrow })}
      hideStages
      disabled={isLocked}
      value={borrowAmount}
      onChange={handleBorrowChange}
      onSelectPercentageStage={noop}
      tokenSelectorTriggerProps={{
        selectedTokenImageUri: borrowLogo,
        selectedTokenImageLoading: !borrowLogo && !isMarketsLoaded,
        selectedNetworkImageUri: networkLogoURI,
        selectedTokenSymbol: borrowSymbol,
        popover: borrowOptions.length ? borrowPopover : undefined,
      }}
      valueProps={{
        value: borrowValue?.toFixed(),
        currency,
      }}
      balanceProps={
        availableToBorrow !== undefined
          ? {
              value: availableToBorrow,
              iconText: intl.formatMessage({
                id: ETranslations.global_available,
              }),
              testID: 'earn-loan-available',
            }
          : undefined
      }
      inputProps={{ testID: 'earn-loan-borrow-input', placeholder: '0' }}
    />
  );

  // ---------- The market position: the LTV bar ----------

  const selectedNewCollateralValue = selectedFacts?.collateralPrice
    ? toBigNumber(collateralAmount)
        .times(selectedFacts.collateralPrice)
        .toNumber()
    : 0;
  const selectedLoanValue = selectedFacts?.borrowPrice
    ? toBigNumber(borrowAmount).times(selectedFacts.borrowPrice).toNumber()
    : 0;
  const isClosed = isLendingClosed(selectedMetrics?.block);
  const ltvBar =
    selectedRoute && selectedFacts
      ? getLoanLtvBar({
          route: selectedRoute,
          facts: selectedFacts,
          maxLtv: isClosed ? undefined : selectedMetrics?.maxLtv,
          newCollateralValue: selectedNewCollateralValue,
          loanValue: selectedLoanValue,
          previewLtv,
        })
      : undefined;
  ltvStartRef.current = ltvBar && !ltvBar.isPreview ? ltvBar.used : 0;
  // The health factor the bar's LTV leaves, in the Borrow pages' colors
  const barTone = getLoanHealthTone(
    ltvBar?.liquidation !== undefined && ltvBar.value > 0
      ? ltvBar.liquidation / ltvBar.value
      : undefined,
  );
  const hasPosition = Boolean(
    selectedFacts &&
    (selectedFacts.collateralValue > 0 || selectedFacts.debtValue > 0),
  );
  const isChanging = hasLoan || hasCollateral;

  const ltvBlock = (
    <YStack testID="earn-loan-ltv" px="$3.5" pt="$3" gap="$1">
      <XStack jc="space-between" ai="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          {EARN_DESKTOP_DEMO_COPY.loanLtv}
        </SizableText>
        <LtvValue
          before={
            hasPosition && selectedFacts && selectedFacts.collateralValue > 0
              ? selectedFacts.debtValue / selectedFacts.collateralValue
              : undefined
          }
          after={ltvBar?.value}
          isChanging={isChanging}
          color={toneColors.text[barTone]}
        />
      </XStack>
      <LoanLtvBar
        testID="earn-loan-ltv-bar"
        bar={ltvBar}
        tone={barTone}
        disabled={isLocked || isClosed}
        onChange={handleLtvChange}
        onSlideStart={handleSlideStart}
        onSlideEnd={handleSlideEnd}
        valueText={
          ltvBar
            ? `${EARN_DESKTOP_DEMO_COPY.loanLtv} ${formatLoanLtv(ltvBar.value)}`
            : undefined
        }
        capLabel={
          ltvBar?.cap !== undefined
            ? EARN_DESKTOP_DEMO_COPY.loanMaxShort(formatLoanLtv(ltvBar.cap))
            : undefined
        }
        liquidationLabel={
          ltvBar?.liquidation !== undefined
            ? `${intl.formatMessage({
                id: ETranslations.defi_liquidation_ltv,
              })} ${formatLoanLtv(ltvBar.liquidation)}`
            : undefined
        }
      />
    </YStack>
  );

  // ---------- What the picked market makes of it ----------

  const healthRow = (
    <EarnFormRow
      key="health"
      testID="earn-loan-health"
      label={intl.formatMessage({ id: ETranslations.defi_health_factor })}
      value={
        <HealthFactorValue
          before={isChanging ? selectedMetrics?.healthFactorBefore : undefined}
          after={
            isChanging
              ? selectedMetrics?.healthFactor
              : selectedMetrics?.healthFactorBefore
          }
        />
      }
      note={
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.defi_liquidation_at_less_than_1_00,
          })}
        </SizableText>
      }
    />
  );
  // One asset's liquidation price holds only while nothing else is in the
  // position: with other assets it would take their prices as fixed
  const isSinglePair = Boolean(
    selectedRoute &&
    selectedFacts &&
    selectedFacts.collateralAssets.every((asset) =>
      isSameSymbol(asset.symbol, selectedRoute.collateral.symbol),
    ) &&
    selectedFacts.debtAssets.every((asset) =>
      isSameSymbol(asset.symbol, selectedRoute.borrow.symbol),
    ),
  );
  const liquidationRow =
    !hasPosition || isSinglePair ? (
      <EarnFormRow
        key="liquidation"
        testID="earn-loan-liquidation"
        label={EARN_DESKTOP_DEMO_COPY.loanLiquidationPrice}
        value={
          <RowValue>
            {selectedMetrics?.liquidationPrice !== undefined && isChanging
              ? numberFormat(String(selectedMetrics.liquidationPrice), {
                  formatter: 'price',
                  formatterOptions: { currency },
                })
              : '–'}
          </RowValue>
        }
        // Only while the price is still above it: past it, the health
        // factor in red says so
        note={
          selectedMetrics?.liquidationPrice !== undefined &&
          selectedFacts?.collateralPrice &&
          selectedMetrics.liquidationPrice < selectedFacts.collateralPrice &&
          isChanging ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {EARN_DESKTOP_DEMO_COPY.loanBelowNow(
                `${new BigNumber(1)
                  .minus(
                    new BigNumber(selectedMetrics.liquidationPrice).div(
                      selectedFacts.collateralPrice,
                    ),
                  )
                  .times(100)
                  .toFixed(0, BigNumber.ROUND_DOWN)}%`,
              )}
            </SizableText>
          ) : undefined
        }
      />
    ) : null;

  // Until the picked market's own figures are in (and the markets, while
  // they load), the form holds their places: the Net APY's and the
  // position's. A preview rate shown meanwhile would turn into a dash once
  // the market turned out not to lend the token
  const isFiguresLoading =
    !isMarketsLoaded || (Boolean(selectedRoute) && !selectedFacts);
  // Figures that land after the form shows fade in
  const fadeInProps = reduceMotion
    ? undefined
    : {
        transition: 'quick' as const,
        animateOnly: ANIMATE_ONLY_OPACITY,
        enterStyle: FADE_IN,
      };

  // The loan's own result: what this collateral earns less what this loan
  // costs, as a rate while the collateral could carry the loan alone; past
  // that (the market's position carries the rest) as money a year. Where
  // the account has nothing in the market, its risk too. A market that
  // doesn't lend the token has no result: a dash
  const netYearly =
    !isClosed && selectedMetrics?.netApy === undefined
      ? selectedMetrics?.annualNet
      : undefined;
  const netApyLabel = intl.formatMessage({ id: ETranslations.defi_net_apy });
  let outcome: IEarnOutcome;
  if (isFiguresLoading) {
    outcome = { label: netApyLabel, values: [] };
  } else if (netYearly !== undefined) {
    outcome = {
      label: EARN_DESKTOP_DEMO_COPY.loanNetPerYear,
      isEarning: netYearly >= 0.01,
      // In the cards' red, so a cost under a cent reads as one too
      isCost: isLoanLoss(netYearly),
      values: [{ main: formatLoanNet(netYearly, currency) }],
    };
  } else {
    outcome = {
      label: netApyLabel,
      isEarning: !isClosed && (selectedMetrics?.netApy ?? 0) > 0,
      isCost: !isClosed && isLoanLoss(selectedMetrics?.netApy),
      values:
        isClosed || selectedMetrics?.netApy === undefined
          ? []
          : [
              {
                main: formatLoanPercent(selectedMetrics.netApy),
                suffix:
                  isChanging && selectedMetrics.annualNet !== undefined
                    ? formatLoanYearly(selectedMetrics.annualNet, currency)
                    : undefined,
              },
            ],
    };
  }
  const summary =
    selectedRoute || isFiguresLoading ? (
      <EarnFormSummary outcome={outcome} isOutcomeLoading={isFiguresLoading} />
    ) : null;

  // The window closes and the market's own page opens, the whole position
  // there
  const positionMarket = selectedRoute?.market;
  const handleManagePosition = useCallback(() => {
    if (!positionMarket) {
      return;
    }
    navigation.popStack();
    BorrowNavigation.pushToBorrowHome(navigation, positionMarket);
  }, [navigation, positionMarket]);

  // Where the account already has a position, the loan joins it: what backs
  // every loan there, what is borrowed, and the health factor, before and
  // after
  const positionBlock =
    hasPosition && selectedRoute && selectedFacts ? (
      <YStack testID="earn-loan-position" px="$3.5" gap="$3" {...fadeInProps}>
        <XStack ai="center" gap="$2">
          <Token size="xs" tokenImageUri={selectedRoute.market.logoURI} />
          <SizableText size="$bodyMdMedium" flexShrink={1} numberOfLines={1}>
            {EARN_DESKTOP_DEMO_COPY.loanPositionTitle(
              selectedRoute.marketLabel,
            )}
          </SizableText>
          <PositionManageLink onPress={handleManagePosition} />
        </XStack>
        <EarnFormRow
          testID="earn-loan-position-collateral"
          label={intl.formatMessage({ id: ETranslations.defi_collateral })}
          tooltip={{
            type: 'text',
            data: {
              description: { text: EARN_DESKTOP_DEMO_COPY.loanPoolInfo },
            },
          }}
          value={
            <PositionValue
              assets={withAsset(
                selectedFacts.collateralAssets,
                hasCollateral ? selectedRoute.collateral : undefined,
              )}
              before={selectedFacts.collateralValue}
              after={selectedFacts.collateralValue + selectedNewCollateralValue}
              isChanging={hasCollateral}
              currency={currency}
            />
          }
        />
        <EarnFormRow
          testID="earn-loan-position-borrowed"
          label={intl.formatMessage({
            id: ETranslations.wallet_defi_asset_type_borrowed,
          })}
          value={
            <PositionValue
              assets={withAsset(
                selectedFacts.debtAssets,
                hasLoan ? selectedRoute.borrow : undefined,
              )}
              before={selectedFacts.debtValue}
              after={selectedFacts.debtValue + selectedLoanValue}
              isChanging={hasLoan}
              currency={currency}
            />
          }
        />
        {healthRow}
        {liquidationRow}
      </YStack>
    ) : null;

  // Under the Net APY: the position's place while the figures load, then
  // the position, or where the account has none there, its risk. One part
  // in one place, so the form changes height once as the figures land
  let details: ReactElement | null = null;
  if (isFiguresLoading) {
    details = <PositionSkeleton />;
  } else if (positionBlock) {
    details = positionBlock;
  } else if (selectedRoute) {
    const riskRows = [healthRow, liquidationRow].filter(isElement);
    details = riskRows.length ? (
      // As close under the Net APY as the summary's own rows sit
      <YStack px="$3.5" mt="$-2" gap="$3" {...fadeInProps}>
        {riskRows}
      </YStack>
    ) : null;
  }

  // ---------- The press ----------

  // Why the market can't take the loan shows under its card only; here it
  // holds the button
  const blockText =
    selectedRoute && selectedMetrics?.block
      ? getLoanBlockText({
          block: selectedMetrics.block,
          route: selectedRoute,
          currency,
        })
      : undefined;
  // A loan typed with no collateral borrows against what the market already
  // holds; otherwise the press supplies, then borrows
  const actionLabel =
    !hasCollateral && hasLoan
      ? intl.formatMessage({ id: ETranslations.global_borrow })
      : EARN_DESKTOP_DEMO_COPY.supplyAndBorrow;
  const buttonText = isInsufficient
    ? intl.formatMessage({ id: ETranslations.earn_insufficient_balance })
    : actionLabel;
  const canStart =
    Boolean(selectedRoute && selectedFacts?.networkAccountId) &&
    hasLoan &&
    !blockText &&
    !isInsufficient;
  const handlePress = useCallback(() => {
    if (!selectedRoute || !selectedFacts?.networkAccountId) {
      return;
    }
    setSuppliedNote(undefined);
    // The market stays the one pressed on, however the list re-ranks while
    // the steps run or after them
    setPickedKey(selectedRoute.key);
    void run.start({
      route: selectedRoute,
      networkAccountId: selectedFacts.networkAccountId,
      collateralAmount: hasCollateral ? collateralAmount : '0',
      borrowAmount,
      marketLogoURI: selectedRoute.market.logoURI,
    });
  }, [
    borrowAmount,
    collateralAmount,
    hasCollateral,
    run,
    selectedFacts?.networkAccountId,
    selectedRoute,
  ]);

  const progressStep = (() => {
    if (run.hasApprovalStep) {
      if (run.phase === 'approving') return 1;
      if (run.phase === 'supplying' || run.phase === 'landing') return 2;
      return 3;
    }
    if (run.phase === 'supplying' || run.phase === 'landing') return 1;
    return 2;
  })();
  const showsProgress =
    hasCollateral &&
    (run.phase === 'approving' ||
      run.phase === 'supplying' ||
      run.phase === 'landing' ||
      run.phase === 'borrowing');

  // What the press leads to, over the button: the steps show in the footer
  const notes = (() => {
    const lines = [
      run.phase === 'landing' ? (
        <SizableText key="landing" size="$bodyMd" color="$textSubdued">
          {EARN_DESKTOP_DEMO_COPY.loanLanding}
        </SizableText>
      ) : null,
      suppliedNote && !isLocked ? (
        <SizableText
          key="supplied"
          testID="earn-loan-supplied-note"
          size="$bodyMd"
          color="$textSubdued"
        >
          {suppliedNote}
        </SizableText>
      ) : null,
    ].filter(isElement);
    return lines.length ? <YStack gap="$3">{lines}</YStack> : null;
  })();
  const progress = showsProgress ? (
    <StakeProgress
      currentStep={progressStep}
      step1Label={
        run.hasApprovalStep
          ? intl.formatMessage({ id: ETranslations.global_approve })
          : intl.formatMessage({ id: ETranslations.defi_supply })
      }
      step2Label={
        run.hasApprovalStep
          ? intl.formatMessage({ id: ETranslations.defi_supply })
          : intl.formatMessage({ id: ETranslations.global_borrow })
      }
      step3LabelId={
        run.hasApprovalStep ? ETranslations.global_borrow : undefined
      }
      isRunning
    />
  ) : null;

  // ---------- Done ----------

  // Both close the modal, as the deposit modal's do
  const handleFinish = useCallback(() => {
    navigation.popStack();
  }, [navigation]);
  const handleOpenPortfolio = useCallback(() => {
    navigation.popStack();
    if (platformEnv.isNative) {
      EarnNavigation.pushToEarnPositions(navigation);
      return;
    }
    void EarnNavigation.popToEarnHome(navigation, { tab: 'portfolio' });
  }, [navigation]);
  const doneView = done ? (
    <YStack testID="earn-loan-done" py="$6">
      <EarnDoneHeader
        line={EARN_DESKTOP_DEMO_COPY.loanDone(
          formatDoneAmount(
            done.plan.borrowAmount,
            done.plan.route.borrow.symbol,
          ),
          done.plan.route.marketLabel,
          done.supplied
            ? formatDoneAmount(
                done.plan.collateralAmount,
                done.plan.route.collateral.symbol,
              )
            : undefined,
        )}
      />
    </YStack>
  ) : null;

  // ---------- The modal ----------

  // The markets beside the form where the window holds them; under the
  // form's figures otherwise, as on a phone, in a modal of the usual width.
  // The done view is one column at the usual width too
  const isBeside = gtLg && !done;
  useEffect(() => {
    if ((wide !== false) !== isBeside) {
      navigation.setParams({ wide: isBeside });
    }
  }, [isBeside, navigation, wide]);
  const fitModalRef = useLoanModalHeight(EARN_LOAN_MODAL_SIZE.height);
  const renderTitle = useCallback(
    () => (
      <LoanPairTitle
        collateral={{ symbol: collateralSymbol, logoURI: collateralLogo }}
        borrow={{ symbol: borrowSymbol, logoURI: borrowLogo }}
      />
    ),
    [borrowLogo, borrowSymbol, collateralLogo, collateralSymbol],
  );

  const routeList = (
    <LoanRouteList
      items={items}
      selectedKey={isPickListed ? pickedKey : undefined}
      isLoading={!isMarketsLoaded}
      isSettled={isFactsLoaded}
      currency={currency}
      emptyText={EARN_DESKTOP_DEMO_COPY.loanNoMarket(
        collateralSymbol,
        borrowSymbol,
      )}
      onSelect={isLocked ? noop : handlePickRoute}
    />
  );
  const form = doneView ?? (
    <YStack gap="$5">
      <YStack gap="$2">
        {collateralBox}
        {/* The loan comes out of the collateral above it */}
        <XStack jc="center" my="$-4" zIndex={1}>
          <Stack
            w="$8"
            h="$8"
            ai="center"
            jc="center"
            borderRadius="$full"
            bg="$bgApp"
          >
            <Stack
              w="$7"
              h="$7"
              ai="center"
              jc="center"
              borderRadius="$full"
              bg="$bgSubdued"
            >
              <Icon name="ArrowBottomOutline" size="$4" color="$iconSubdued" />
            </Stack>
          </Stack>
        </XStack>
        {borrowBox}
        {ltvBlock}
      </YStack>
      {/* In one column the markets come after what the amounts make, so
          typing or dragging shows its result without a scroll */}
      {summary}
      {details}
      {isBeside ? null : routeList}
      {notes}
    </YStack>
  );

  const footer = done ? (
    <Page.Footer>
      <Page.FooterActions
        onCancelText={intl.formatMessage({
          id: ETranslations.earn_my_portfolio__title,
        })}
        onCancel={handleOpenPortfolio}
        onConfirmText={intl.formatMessage({ id: ETranslations.global_done })}
        onConfirm={handleFinish}
        cancelButtonProps={{ testID: 'earn-loan-done-portfolio' }}
        confirmButtonProps={{ testID: 'earn-loan-done-finish' }}
      />
    </Page.Footer>
  ) : (
    // As the deposit modal's: the steps on the left while they run, the
    // button on the right
    <Page.Footer>
      <Stack
        bg="$bgApp"
        flexDirection="column"
        $gtMd={{
          flexDirection: 'row',
          alignItems: 'center',
          jc: 'space-between',
        }}
      >
        {progress ? (
          <Stack pl="$5" $md={{ pt: '$5' }}>
            {progress}
          </Stack>
        ) : (
          <Stack />
        )}
        <Page.FooterActions
          onConfirmText={buttonText}
          confirmButtonProps={{
            testID: 'earn-loan-submit',
            onPress: handlePress,
            loading: run.isRunning,
            disabled: !canStart && !run.isRunning,
          }}
        />
      </Stack>
    </Page.Footer>
  );

  return (
    <Page scrollEnabled scrollProps={{ keyboardShouldPersistTaps: 'handled' }}>
      <Page.Header headerTitle={renderTitle} />
      <Page.Body>
        {/* What the modal fits its height to, up to its size */}
        <YStack ref={fitModalRef}>
          {isBeside && !done ? (
            <XStack testID="earn-loan-router" ai="flex-start">
              <YStack flex={1} minWidth={0} px="$5" pt="$2.5" pb="$5">
                {form}
              </YStack>
              <YStack
                w={EARN_OFFER_ROUTES_COLUMN_WIDTH}
                flexShrink={0}
                pt="$2.5"
                pb="$5"
                pr="$5"
              >
                {routeList}
              </YStack>
            </XStack>
          ) : (
            <YStack testID="earn-loan-router" px="$5" pt="$2.5" pb="$5">
              {form}
            </YStack>
          )}
        </YStack>
      </Page.Body>
      {footer}
    </Page>
  );
}

function EarnLoanRouterPageWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <DiscoveryBrowserProviderMirror>
          <EarnLoanRouterPage />
        </DiscoveryBrowserProviderMirror>
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default EarnLoanRouterPageWithProvider;
