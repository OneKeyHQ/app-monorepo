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
  Badge,
  HeightTransition,
  Icon,
  Page,
  ScrollView,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import {
  EJotaiContextStoreNames,
  useCurrencyPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { BorrowNavigation } from '../../../Borrow/borrowUtils';
import { resolveHealthFactorValueColor } from '../../../Borrow/components/healthFactorValueColor';
import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import {
  EARN_FULL_WIDTH_BUTTONS,
  EARN_HALF_BUTTON,
  EarnFormActionPlacementContext,
  EarnFormFooter,
} from '../../../Staking/components/EarnFormFooter';
import { useEarnRiskWarningGate } from '../../../Staking/components/EarnRiskWarningDialog';
import { StakeProgress } from '../../../Staking/components/StakeProgress';
import { StakingAmountInput } from '../../../Staking/components/StakingAmountInput';
import { StakingAmountResultLine } from '../../../Staking/components/StakingAmountResultLine';
import {
  EarnFormRow,
  EarnFormSummary,
} from '../../../Staking/components/UniversalStake/EarnFormSummary';
import {
  EARN_DESKTOP_LOAN_LTV,
  isSameLoanAsset,
} from '../../components/desktopHome/earnDesktopHome.utils';
import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';
import { EarnLoanAssetLogos } from '../../components/desktopHome/EarnLoanAssetLogos';
import {
  useEarnDesktopMarkets,
  useEarnDesktopWalletHoldings,
} from '../../components/desktopHome/useEarnDesktopHomeData';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { EarnNavigation } from '../../earnUtils';
import { getEarnAssetClassLabel } from '../EarnAssetSelect/earnAssetClassLabel';
import { EarnAssetPickTrigger } from '../EarnAssetSelect/EarnAssetPickTrigger';
import {
  EarnDoneHeader,
  formatDoneAmount,
} from '../EarnRouter/EarnDepositDone';
import {
  EARN_OFFER_ROUTES_COLUMN_WIDTH,
  listPayTokens,
} from '../EarnRouter/earnRouter.utils';

import { LoanLtvBar } from './LoanLtvBar';
import {
  LOAN_HEALTH_TEXT_COLOR,
  buildLoanRoutesForPicks,
  buildLoanSelectTokens,
  getLoanForLtv,
  getLoanForPositionLtv,
  getLoanHealthTone,
  getLoanLtvBar,
  getLoanRouteMetrics,
  pickLoanBorrowPick,
  rankLoanRoutes,
} from './loanRouter.utils';
import { EARN_LOAN_MODAL_SIZE } from './loanRouterModal';
import {
  LoanPairTitle,
  LoanPickPills,
  LoanRouteList,
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
import { useLoanPayWith } from './useLoanPayWith';
import { useLoanRouterFacts } from './useLoanRouterFacts';
import { useLoanRouterRun } from './useLoanRouterRun';

import type { ILoanPositionAsset, ILoanRoute } from './loanRouter.utils';
import type { ILoanRouteItem } from './LoanRouterParts';
import type { ILoanRunDone, ILoanRunPlan } from './useLoanRouterRun';
import type { IHealthFactorDetail } from '../../../Borrow/components/healthFactorValueColor';
import type { IEarnOutcome } from '../../../Staking/components/UniversalStake/EarnFormSummary';
import type { IEarnAssetPick } from '../EarnAssetSelect/earnAssetSelect.utils';

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

// The line under the Pay with box grows in this long, as the deposit modal's
const SUPPLY_LINE_MS = 200;

// A pick's name: the token, or the kind's ("Stable Tokens", "BTC")
const usePickLabel = () => {
  const intl = useIntl();
  return useCallback(
    (pick: IEarnAssetPick) =>
      pick.kind === 'token'
        ? pick.symbol
        : getEarnAssetClassLabel(intl, pick.assetClass),
    [intl],
  );
};

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

const scaleHealth = (value: number | undefined, scale: number) =>
  value === undefined ? undefined : value * scale;

const healthColorOf = (value: number): ColorTokens =>
  LOAN_HEALTH_TEXT_COLOR[getLoanHealthTone(value)];

// The health factor in the Borrow page's words: the position as it stands is
// the server's figure, color and status; once amounts are typed, the figure
// before and after, each in its band's color
function HealthFactorValue({
  before,
  after,
  current,
}: {
  before?: number;
  after?: number;
  current?: IHealthFactorDetail;
}) {
  if (after === undefined) {
    return <RowValue>–</RowValue>;
  }
  if (before === undefined && current) {
    return (
      <XStack ai="center" gap="$1.5">
        <SizableText
          size="$bodyMdMedium"
          color={resolveHealthFactorValueColor(current)}
          fontVariant={['tabular-nums']}
        >
          {current.value}
        </SizableText>
        {current.status?.tag ? (
          <Badge badgeType={current.status.badge}>{current.status.tag}</Badge>
        ) : null}
      </XStack>
    );
  }
  return (
    <XStack ai="center" gap="$1.5">
      {before !== undefined ? (
        <>
          <SizableText
            size="$bodySm"
            color={
              current
                ? resolveHealthFactorValueColor(current)
                : healthColorOf(before)
            }
          >
            {current ? current.value : formatHealth(before)}
          </SizableText>
          <Icon name="ArrowRightOutline" size="$4" color="$iconDisabled" />
        </>
      ) : null}
      <SizableText
        size="$bodyMdMedium"
        textAlign="right"
        color={healthColorOf(after)}
      >
        {formatHealth(after)}
      </SizableText>
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
      <EarnLoanAssetLogos assets={assets} />
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
    collateralClass: routeCollateralClass,
    borrowClass: routeBorrowClass,
    routeKey,
    wide,
  } = route.params as IRouteParams;
  const { gtLg } = useMedia();
  const reduceMotion = useReducedMotion();
  const currencyInfo = useCurrency();
  const currency = currencyInfo.symbol;
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const pickLabel = usePickLabel();

  // What backs the loan and the loan: each a token, or a kind of token whose
  // markets all compare
  const [collateralPick, setCollateralPick] = useState<IEarnAssetPick>(() =>
    routeCollateralClass
      ? { kind: 'class', assetClass: routeCollateralClass }
      : { kind: 'token', symbol: routeCollateral },
  );
  const [borrowPick, setBorrowPick] = useState<IEarnAssetPick>(() =>
    routeBorrowClass
      ? { kind: 'class', assetClass: routeBorrowClass }
      : { kind: 'token', symbol: routeBorrow },
  );
  const isClassMode =
    collateralPick.kind === 'class' || borrowPick.kind === 'class';
  // What the first box holds: an amount of what Pay with pays with (the
  // collateral itself unless another token is picked or held)
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
  // A swap brought the collateral: the box holds what came in, as the
  // collateral itself, and the press goes on by itself once
  const [handoff, setHandoff] = useState<{
    routeKey: string;
    autoStart: boolean;
  }>();

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

  // The wallet on the markets' networks, for the selector's balances (read
  // fresh unless the home just did)
  const marketNetworkIds = useMemo(
    () =>
      Array.from(
        new Set(markets.map((entry) => entry.market.networkId)),
      ).toSorted(),
    [markets],
  );
  const wallet = useEarnDesktopWalletHoldings({
    isActive: true,
    refreshNetworkIds: marketNetworkIds,
  });
  const holdings = useMemo(() => {
    const byToken = new Map<
      string,
      Map<string, { amount: string; fiatValueUsd: string }>
    >();
    wallet.networkGroups.forEach((group) => {
      listPayTokens({ group, depositSymbol: '' }).forEach((item) => {
        const key = item.token.symbol.toUpperCase();
        const byNetwork = byToken.get(key) ?? new Map();
        const kept = byNetwork.get(group.networkId);
        byNetwork.set(group.networkId, {
          amount: toBigNumber(kept?.amount).plus(item.amount).toFixed(),
          fiatValueUsd: toBigNumber(kept?.fiatValueUsd)
            .plus(item.fiatValueUsd)
            .toFixed(),
        });
        byToken.set(key, byNetwork);
      });
    });
    return byToken;
  }, [wallet.networkGroups]);
  const supplyTokens = useMemo(
    () =>
      buildLoanSelectTokens({
        markets,
        side: 'supply',
        stableSymbols,
        holdings,
      }),
    [holdings, markets, stableSymbols],
  );
  const borrowTokens = useMemo(
    () =>
      buildLoanSelectTokens({
        markets,
        side: 'borrow',
        collateral: collateralPick,
        stableSymbols,
      }),
    [collateralPick, markets, stableSymbols],
  );
  const routes = useMemo(
    () =>
      buildLoanRoutesForPicks({
        markets,
        collateral: collateralPick,
        borrow: borrowPick,
        stableSymbols,
      }),
    [borrowPick, collateralPick, markets, stableSymbols],
  );
  const {
    byRoute,
    isLoaded: isFactsLoaded,
    refresh,
  } = useLoanRouterFacts({ routes });

  // Where Pay with pays: the picked market's network (the first market's
  // until one is picked)
  const payRoute = routes.find((item) => item.key === pickedKey) ?? routes[0];
  const payRouteFacts = payRoute ? byRoute.get(payRoute.key) : undefined;
  const payWith = useLoanPayWith({
    route: payRoute,
    networkAccountId: payRouteFacts?.networkAccountId,
    typedAmount: collateralAmount,
    isLocked: false,
  });
  const { payToken } = payWith;
  // Paid with another token: a swap buys the collateral first. Once it has,
  // the box holds the collateral itself
  const isSwapping = payWith.isSwapping && !handoff;
  // One unit of what pays, in the currency the markets answer in
  const payPrice = (() => {
    const usd = new BigNumber(payToken?.priceUsd ?? '');
    if (!isSwapping || !usd.isFinite() || usd.lte(0)) {
      return undefined;
    }
    const converted = new BigNumber(
      convertFiat({
        value: usd,
        sourceCurrency: USD_CURRENCY_ID,
        targetCurrency: currencyInfo.id,
        currencyMap,
      }),
    );
    return converted.isFinite() && converted.gt(0)
      ? converted.toNumber()
      : undefined;
  })();

  // The prices the boxes go by: the picked market's, else the first known
  const priceRoute = useMemo(() => {
    const withPrices = (item?: ILoanRoute) => {
      const facts = item ? byRoute.get(item.key) : undefined;
      return item && facts?.collateralPrice && facts?.borrowPrice
        ? { route: item, facts }
        : undefined;
    };
    return (
      withPrices(routes.find((item) => item.key === pickedKey)) ??
      routes.map((item) => withPrices(item)).find(Boolean)
    );
  }, [byRoute, pickedKey, routes]);
  const borrowDecimals =
    routes.find((item) => item.key === pickedKey)?.borrow.decimals ??
    routes[0]?.borrow.decimals ??
    6;
  // The token the box is in: what pays, or the collateral itself
  const boxSymbol = isSwapping
    ? (payToken?.token.symbol ?? '')
    : (payRoute?.collateral.symbol ?? '');
  // What the box puts in, in the currency: the swap's estimate where it is
  // quoted (what it brings, at the market's price), else at the pay token's
  // price; the collateral's own at its market's price
  const typedValue = (() => {
    const typed = toBigNumber(collateralAmount);
    if (!typed.gt(0)) {
      return 0;
    }
    if (isSwapping) {
      if (payWith.estimatedSupply && payRouteFacts?.collateralPrice) {
        return toBigNumber(payWith.estimatedSupply)
          .times(payRouteFacts.collateralPrice)
          .toNumber();
      }
      return payPrice ? typed.times(payPrice).toNumber() : 0;
    }
    const price =
      payRouteFacts?.collateralPrice ?? priceRoute?.facts.collateralPrice;
    return price ? typed.times(price).toNumber() : 0;
  })();
  // The collateral each market takes in for it: the amount itself in the
  // box's own token; what the swap brings for the market Pay with pays
  // into; the same value in its token for the others, so the markets
  // compare the same plan
  const supplyAmountOf = useCallback(
    (item?: ILoanRoute) => {
      if (!item || !toBigNumber(collateralAmount).gt(0)) {
        return '';
      }
      if (boxSymbol && isSameLoanAsset(item.collateral.symbol, boxSymbol)) {
        return collateralAmount;
      }
      if (isSwapping && item.key === payRoute?.key && payWith.estimatedSupply) {
        return payWith.estimatedSupply;
      }
      const price = byRoute.get(item.key)?.collateralPrice;
      if (!price || !typedValue) {
        return '';
      }
      return new BigNumber(typedValue)
        .div(price)
        .decimalPlaces(
          Math.min(item.collateral.decimals, 8),
          BigNumber.ROUND_DOWN,
        )
        .toFixed();
    },
    [
      boxSymbol,
      byRoute,
      collateralAmount,
      isSwapping,
      payRoute?.key,
      payWith.estimatedSupply,
      typedValue,
    ],
  );
  const newCollateralValue = typedValue;
  const borrowAmount =
    typedBorrow ??
    (draggedLtv !== undefined
      ? getLoanForPositionLtv({
          ltv: draggedLtv,
          collateralValue: priceRoute?.facts.collateralValue ?? 0,
          debtValue: priceRoute?.facts.debtValue ?? 0,
          newCollateralValue,
          borrowPrice: priceRoute?.facts.borrowPrice,
          decimals: borrowDecimals,
        })
      : getLoanForLtv({
          collateralAmount: supplyAmountOf(priceRoute?.route),
          ltv: EARN_DESKTOP_LOAN_LTV,
          collateralPrice: priceRoute?.facts.collateralPrice,
          borrowPrice: priceRoute?.facts.borrowPrice,
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
              collateralAmount: supplyAmountOf(item),
              borrowAmount,
              ltvStage: typedBorrow ? undefined : previewLtv,
            }),
          };
        }),
      ),
    [borrowAmount, byRoute, previewLtv, routes, supplyAmountOf, typedBorrow],
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
  // Unpicked, the check goes to the best market whose collateral the wallet
  // holds there (no swap first), else to the best one
  const usableItem =
    items.find(
      (item) =>
        !item.metrics.block && toBigNumber(item.facts?.walletBalance).gt(0),
    ) ?? items.find((item) => !item.metrics.block);
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
  // Nothing changes while a press runs: the swap, then the steps after it
  const isLocked = run.phase !== 'idle' || payWith.isSwapRunning;

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
  const findSelectToken = (tokens: typeof supplyTokens, pick: IEarnAssetPick) =>
    pick.kind === 'token'
      ? tokens.find((item) => isSameSymbol(item.symbol, pick.symbol))
      : undefined;
  const collateralLogo =
    collateralToken?.logoURI ??
    findSelectToken(supplyTokens, collateralPick)?.logoURI;
  const borrowLogo =
    borrowToken?.logoURI ?? findSelectToken(borrowTokens, borrowPick)?.logoURI;
  const borrowSymbol =
    borrowToken?.symbol ??
    (borrowPick.kind === 'token' ? borrowPick.symbol : '');
  const networkLogoURI = selectedRoute?.market.network.logoURI;
  // What the box can take: the pay token's balance, or the collateral's
  const boxBalance = isSwapping
    ? payToken?.amount
    : selectedFacts?.walletBalance;
  const boxDecimals = isSwapping
    ? (payToken?.token.decimals ?? 8)
    : (collateralToken?.decimals ?? 8);

  // The box's value: at what pays's price, or the collateral's
  const boxUnitPrice = isSwapping
    ? payPrice
    : priceRoute?.facts.collateralPrice;
  const collateralValue =
    boxUnitPrice !== undefined
      ? toBigNumber(collateralAmount).times(boxUnitPrice)
      : undefined;
  const borrowValue =
    priceRoute?.facts.borrowPrice !== undefined
      ? toBigNumber(borrowAmount).times(priceRoute.facts.borrowPrice)
      : undefined;

  // ---------- The two boxes ----------

  const handleCollateralChange = useCallback((value: string) => {
    setSuppliedNote(undefined);
    setCollateralAmount(value);
  }, []);
  const handleCollateralStage = useCallback(
    (percent: number) => {
      if (!boxBalance) {
        return;
      }
      setSuppliedNote(undefined);
      setCollateralAmount(shareOf(boxBalance, percent, boxDecimals));
    },
    [boxBalance, boxDecimals],
  );
  // Paid with the network's coin, Max keeps the fees of the swap and of the
  // steps after it
  const handleCollateralMax = useCallback(() => {
    if (!boxBalance) {
      return;
    }
    setSuppliedNote(undefined);
    setCollateralAmount(
      isSwapping && payWith.payMax !== undefined
        ? payWith.payMax
        : shareOf(boxBalance, 100, boxDecimals),
    );
  }, [boxBalance, boxDecimals, isSwapping, payWith.payMax]);
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
      setHandoff(undefined);
      setPickedKey(key);
    },
    [borrowAmount, draggedLtv, typedBorrow],
  );

  // The box keeps its value when another market moves Pay with to another
  // token (another network): the same plan in the new token. A pick in Pay
  // with's picker starts it over instead
  const boxTokenKey = `${payRoute?.market.networkId ?? ''}|${boxSymbol}`;
  const boxPrice = isSwapping ? payPrice : payRouteFacts?.collateralPrice;
  const lastBoxRef = useRef({
    key: boxTokenKey,
    symbol: boxSymbol,
    price: boxPrice,
  });
  useEffect(() => {
    const last = lastBoxRef.current;
    lastBoxRef.current = {
      key: boxTokenKey,
      symbol: boxSymbol,
      price: boxPrice,
    };
    if (last.key === boxTokenKey || !toBigNumber(collateralAmount).gt(0)) {
      return;
    }
    if (isSameLoanAsset(last.symbol, boxSymbol)) {
      return;
    }
    if (last.price && boxPrice) {
      setCollateralAmount(
        toBigNumber(collateralAmount)
          .times(last.price)
          .div(boxPrice)
          .precision(6, BigNumber.ROUND_DOWN)
          .toFixed(),
      );
      return;
    }
    setCollateralAmount('');
    // Only when the box's token changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxTokenKey]);

  // The picks, in the shared selector over the window
  const handleCollateralPick = useCallback(
    (pick: IEarnAssetPick) => {
      setCollateralPick(pick);
      setCollateralAmount('');
      setSuppliedNote(undefined);
      setHandoff(undefined);
      setPickedKey(undefined);
      payWith.setPickedKey(undefined);
      resetLoan();
      const nextBorrow = pickLoanBorrowPick({
        markets,
        collateral: pick,
        current: borrowPick,
        stableSymbols,
      });
      if (nextBorrow) {
        setBorrowPick(nextBorrow);
      }
    },
    [borrowPick, markets, payWith, resetLoan, stableSymbols],
  );
  // A loan typed in one token means nothing in another
  const handleBorrowPick = useCallback(
    (pick: IEarnAssetPick) => {
      setBorrowPick(pick);
      setHandoff(undefined);
      setPickedKey(undefined);
      resetLoan();
    },
    [resetLoan],
  );
  const openSelect = useCallback(
    (side: 'supply' | 'borrow') => {
      const isSupply = side === 'supply';
      navigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.EarnRouterAssetSelect,
        params: {
          purpose: isSupply ? 'loanSupply' : 'loanBorrow',
          title: intl.formatMessage({
            id: isSupply
              ? ETranslations.defi_collateral
              : ETranslations.global_borrow,
          }),
          tokens: isSupply ? supplyTokens : borrowTokens,
          selected: isSupply ? collateralPick : borrowPick,
          onSelect: isSupply ? handleCollateralPick : handleBorrowPick,
        },
      });
    },
    [
      borrowPick,
      borrowTokens,
      collateralPick,
      handleBorrowPick,
      handleCollateralPick,
      intl,
      navigation,
      supplyTokens,
    ],
  );
  const openCollateralSelect = useCallback(
    () => openSelect('supply'),
    [openSelect],
  );
  const openBorrowSelect = useCallback(
    () => openSelect('borrow'),
    [openSelect],
  );
  // Pay with's own picker: Swap's, on the market's network
  const handleOpenPayWith = useCallback(() => {
    payWith.openPicker((isNewToken) => {
      if (isNewToken) {
        setCollateralAmount('');
        setHandoff(undefined);
        resetLoan();
      }
    });
  }, [payWith, resetLoan]);

  const hasCollateral = toBigNumber(collateralAmount).gt(0);
  const hasLoan = toBigNumber(borrowAmount).gt(0);
  const isInsufficient =
    hasCollateral &&
    boxBalance !== undefined &&
    toBigNumber(collateralAmount).gt(boxBalance);

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

  // The swap's estimate under the Pay with box: the collateral it brings
  // (the last amount's, dimmed, while this one's is quoted), a dash before
  // an amount or with no route
  const supplyLine =
    isSwapping && hasCollateral && payWith.shownSupply && collateralToken
      ? `≈ ${numberFormat(payWith.shownSupply, { formatter: 'balance' })} ${
          collateralToken.symbol
        }`
      : '–';
  const collateralBox = (
    <YStack>
      <StakingAmountInput
        boxTestID="earn-loan-collateral"
        // Paid with the collateral itself the box is the collateral; paid
        // with another token it is what leaves the wallet
        title={
          isSwapping
            ? EARN_DESKTOP_DEMO_COPY.payWith
            : intl.formatMessage({ id: ETranslations.defi_collateral })
        }
        disabled={isLocked}
        hasError={isInsufficient}
        value={collateralAmount}
        onChange={handleCollateralChange}
        onSelectPercentageStage={handleCollateralStage}
        tokenSelectorTriggerProps={{
          selectedTokenImageUri: isSwapping
            ? payToken?.token.logoURI
            : collateralLogo,
          selectedTokenImageLoading: !collateralLogo && !isMarketsLoaded,
          selectedNetworkImageUri: networkLogoURI,
          selectedTokenSymbol: isSwapping
            ? payToken?.token.symbol
            : (collateralToken?.symbol ?? pickLabel(collateralPick)),
          disabled: isLocked,
          onPress: payRoute ? handleOpenPayWith : undefined,
          ...buildKeyboardPressProps(
            isLocked || !payRoute ? undefined : handleOpenPayWith,
          ),
          testID: 'earn-loan-pay-with-trigger',
        }}
        valueProps={{
          value: collateralValue?.toFixed(),
          currency,
        }}
        balanceProps={{
          value: boxBalance,
          loading: isSwapping
            ? !payWith.isLoaded
            : Boolean(selectedRoute) && !selectedFacts,
          onPress: isLocked ? undefined : handleCollateralMax,
        }}
        enableMaxAmount
        maxAmountText={intl.formatMessage({ id: ETranslations.global_max })}
        inputProps={{ testID: 'earn-loan-collateral-input', placeholder: '0' }}
      />
      {/* What the swap brings and goes in as collateral, under what pays
          for it. It grows in with a pick of another token in Pay with */}
      <HeightTransition duration={SUPPLY_LINE_MS} hide={!isSwapping}>
        <YStack pt="$2" aria-hidden={!isSwapping}>
          <StakingAmountResultLine
            testID="earn-loan-swap-supply-amount"
            label={EARN_DESKTOP_DEMO_COPY.youSupply}
            value={supplyLine}
            isPlaceholder={!supplyLine.startsWith('≈')}
            loading={payWith.isQuoting}
          />
        </YStack>
      </HeightTransition>
    </YStack>
  );
  // The loan's own token: the picked market's. What to borrow is picked in
  // the title
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
        selectedTokenSymbol: borrowSymbol || pickLabel(borrowPick),
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
    ? toBigNumber(supplyAmountOf(selectedRoute))
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
  // A position's health factor is the server's, the Borrow page's figure;
  // the window's own reading of it (from the reserves' prices, a hair off)
  // only scales what typed amounts do to it, so before and after agree with
  // the page
  const serverHealth = selectedFacts?.healthFactorDetail;
  const serverHealthValue = serverHealth ? Number(serverHealth.value) : NaN;
  const ownHealthBefore = selectedMetrics?.healthFactorBefore;
  const healthScale =
    Number.isFinite(serverHealthValue) && ownHealthBefore
      ? serverHealthValue / ownHealthBefore
      : 1;
  // The health factor the bar's LTV leaves, in the Borrow page's bands
  const barTone = getLoanHealthTone(
    ltvBar?.liquidation !== undefined && ltvBar.value > 0
      ? (ltvBar.liquidation / ltvBar.value) * healthScale
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
          before={
            isChanging && ownHealthBefore !== undefined
              ? ownHealthBefore * healthScale
              : undefined
          }
          after={
            isChanging
              ? scaleHealth(selectedMetrics?.healthFactor, healthScale)
              : scaleHealth(ownHealthBefore, healthScale)
          }
          current={serverHealth}
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
  // holds; otherwise the press supplies, then borrows. Paid with another
  // token, a swap brings the collateral first
  let actionLabel = EARN_DESKTOP_DEMO_COPY.supplyAndBorrow;
  if (!hasCollateral && hasLoan) {
    actionLabel = intl.formatMessage({ id: ETranslations.global_borrow });
  } else if (isSwapping) {
    actionLabel = EARN_DESKTOP_DEMO_COPY.swapSupplyAndBorrow;
  }
  const buttonText = isInsufficient
    ? intl.formatMessage({ id: ETranslations.earn_insufficient_balance })
    : actionLabel;
  // The swap needs its quote for exactly this amount, and a route
  const isSwapReady =
    !isSwapping ||
    !hasCollateral ||
    (payWith.canSwap &&
      Boolean(payWith.estimatedSupply) &&
      !payWith.isQuoting &&
      !payWith.hasNoRoute);
  const canStart =
    Boolean(selectedRoute && selectedFacts?.networkAccountId) &&
    hasLoan &&
    !blockText &&
    !isInsufficient &&
    isSwapReady;
  const isPressRunning = run.isRunning || payWith.isSwapRunning;
  const ensureRiskAccepted = useEarnRiskWarningGate();
  const startPlan = useCallback(
    (supplyAmount: string) => {
      if (!selectedRoute || !selectedFacts?.networkAccountId) {
        return;
      }
      void run.start({
        route: selectedRoute,
        networkAccountId: selectedFacts.networkAccountId,
        collateralAmount: supplyAmount,
        borrowAmount,
        marketLogoURI: selectedRoute.market.logoURI,
      });
    },
    [borrowAmount, run, selectedFacts?.networkAccountId, selectedRoute],
  );
  const { swap } = payWith;
  // One press: the market's risk notice, then the swap; once what it bought
  // is in the wallet the box holds it as the collateral and the press goes
  // on by itself (supply, then the loan). A rejected swap changes nothing
  const startSwapPlan = useCallback(async () => {
    if (!selectedRoute) {
      return;
    }
    const accepted = await ensureRiskAccepted({
      provider: selectedRoute.market.provider,
      symbol: selectedRoute.collateral.symbol,
      networkId: selectedRoute.market.networkId,
    });
    if (!accepted) {
      return;
    }
    const swapped = await swap({ payAmount: collateralAmount });
    if (!swapped) {
      return;
    }
    setCollateralAmount(swapped.amount);
    setHandoff({ routeKey: selectedRoute.key, autoStart: true });
    void refresh();
  }, [collateralAmount, ensureRiskAccepted, refresh, selectedRoute, swap]);
  const handlePress = useCallback(() => {
    if (!selectedRoute || !selectedFacts?.networkAccountId) {
      return;
    }
    setSuppliedNote(undefined);
    // The market stays the one pressed on, however the list re-ranks while
    // the steps run or after them
    setPickedKey(selectedRoute.key);
    if (isSwapping && hasCollateral) {
      void startSwapPlan();
      return;
    }
    startPlan(hasCollateral ? supplyAmountOf(selectedRoute) : '0');
  }, [
    hasCollateral,
    isSwapping,
    selectedFacts?.networkAccountId,
    selectedRoute,
    startPlan,
    startSwapPlan,
    supplyAmountOf,
  ]);
  // After the swap: the press goes on once by itself with what came in,
  // unless the market can't take the loan with it (it came in under the
  // quote): then the form shows why, ready to press
  const handoffStartKey =
    handoff?.autoStart && run.phase === 'idle' ? handoff.routeKey : undefined;
  useEffect(() => {
    if (!handoffStartKey) {
      return;
    }
    setHandoff((prev) => (prev ? { ...prev, autoStart: false } : prev));
    if (canStart && selectedRoute?.key === handoffStartKey) {
      startPlan(collateralAmount);
    }
    // Once per hand-off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffStartKey]);

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
  // While the swap runs: its step, then the two after it. Once it is in,
  // the supply's own steps take over (an approval among them where needed)
  let progress: ReactElement | null = null;
  if (payWith.isSwapRunning) {
    progress = (
      <StakeProgress
        currentStep={1}
        step1Label={intl.formatMessage({ id: ETranslations.global_swap })}
        step2Label={intl.formatMessage({ id: ETranslations.defi_supply })}
        step3LabelId={ETranslations.global_borrow}
        isRunning
      />
    );
  } else if (showsProgress) {
    progress = (
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
    );
  }

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
  // The form keeps the routers' fixed size, what it holds scrolling inside;
  // the done view is as tall as it is
  const fitModalRef = useLoanModalHeight(
    EARN_LOAN_MODAL_SIZE.height,
    Boolean(done),
  );
  // The done view names the pair that went in; the form is the Loans
  // window, its picks heading the form
  const renderDoneTitle = useCallback(
    () =>
      done ? (
        <LoanPairTitle
          collateral={{
            symbol: done.plan.route.collateral.symbol,
            logoURI: done.plan.route.collateral.logoURI,
          }}
          borrow={{
            symbol: done.plan.route.borrow.symbol,
            logoURI: done.plan.route.borrow.logoURI,
          }}
        />
      ) : null,
    [done],
  );
  const pickRow = (
    <LoanPickPills
      collateral={
        <EarnAssetPickTrigger
          variant="pill"
          testID="earn-loan-collateral-pick"
          pick={collateralPick}
          tokens={supplyTokens}
          purpose="loanSupply"
          fallbackLogoURI={collateralLogo}
          networkLogoURI={networkLogoURI}
          onPress={openCollateralSelect}
        />
      }
      borrow={
        <EarnAssetPickTrigger
          variant="pill"
          testID="earn-loan-borrow-pick"
          pick={borrowPick}
          tokens={borrowTokens}
          purpose="loanBorrow"
          fallbackLogoURI={borrowLogo}
          networkLogoURI={networkLogoURI}
          onPress={openBorrowSelect}
        />
      }
    />
  );

  // A kind of token on a side: each card names its own pair. A card whose
  // collateral the wallet doesn't hold there (or not the token Pay with was
  // set to) buys it first
  const listItems = useMemo(
    () =>
      items.map((item) => {
        const onPayNetwork =
          Boolean(payRoute) &&
          item.route.market.networkId === payRoute?.market.networkId;
        let needsSwap = false;
        if (item.facts) {
          needsSwap =
            onPayNetwork && payWith.isPicked && payToken
              ? !isSameLoanAsset(
                  payToken.token.symbol,
                  item.route.collateral.symbol,
                )
              : !toBigNumber(item.facts.walletBalance).gt(0);
        }
        return {
          ...item,
          pairLabel: isClassMode
            ? `${item.route.collateral.symbol} / ${item.route.borrow.symbol}`
            : undefined,
          needsSwap:
            needsSwap && !(handoff && item.route.key === handoff.routeKey),
        };
      }),
    [handoff, isClassMode, items, payRoute, payToken, payWith.isPicked],
  );

  const routeList = (
    <LoanRouteList
      items={listItems}
      selectedKey={isPickListed ? pickedKey : undefined}
      isLoading={!isMarketsLoaded}
      isSettled={isFactsLoaded}
      currency={currency}
      emptyText={EARN_DESKTOP_DEMO_COPY.loanNoMarket(
        pickLabel(collateralPick),
        pickLabel(borrowPick),
      )}
      onSelect={isLocked ? noop : handlePickRoute}
    />
  );
  // The button, as Swap's: under the form in a wide window, else the modal's
  // footer
  const action = (
    <EarnFormFooter
      isInModalContext
      progress={progress}
      confirmText={buttonText}
      confirmButtonProps={{
        testID: 'earn-loan-submit',
        onPress: handlePress,
        loading: isPressRunning,
        disabled: !canStart && !isPressRunning,
      }}
    />
  );
  const form = doneView ?? (
    <YStack gap="$5">
      {/* Beside the markets it heads both columns instead */}
      {isBeside ? null : pickRow}
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
          typing or dragging shows its result without a scroll. Beside them
          the button comes right after the result, as on Swap, and the
          account's position under it */}
      {summary}
      {isBeside ? notes : null}
      {isBeside ? action : null}
      {details}
      {isBeside ? null : routeList}
      {isBeside ? null : notes}
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
        buttonContainerProps={EARN_FULL_WIDTH_BUTTONS}
        cancelButtonProps={{
          ...EARN_HALF_BUTTON,
          testID: 'earn-loan-done-portfolio',
        }}
        confirmButtonProps={{
          ...EARN_HALF_BUTTON,
          testID: 'earn-loan-done-finish',
        }}
      />
    </Page.Footer>
  ) : (
    action
  );

  return (
    // Beside the form, each column scrolls by itself and nothing else does
    <Page
      scrollEnabled={!isBeside}
      scrollProps={{ keyboardShouldPersistTaps: 'handled' }}
    >
      <Page.Header
        title={
          done
            ? undefined
            : intl.formatMessage({ id: ETranslations.earn_loans__action })
        }
        headerTitle={done ? renderDoneTitle : undefined}
      />
      <Page.Body>
        {/* What the done view's modal fits its height to; the columns fill
            the form's fixed one */}
        <YStack ref={fitModalRef} flex={isBeside ? 1 : undefined}>
          {isBeside && !done ? (
            // The picks head both columns, so the markets start level with
            // the Supply box. Each column scrolls by itself: the markets move
            // under the pointer while the form and its button stay
            <YStack flex={1}>
              <YStack px="$5" pt="$2.5">
                {pickRow}
              </YStack>
              <XStack testID="earn-loan-router" flex={1} ai="stretch">
                <ScrollView
                  flex={1}
                  minWidth={0}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <EarnFormActionPlacementContext.Provider value="inline">
                    <YStack px="$5" pt="$5" pb="$5">
                      {form}
                    </YStack>
                  </EarnFormActionPlacementContext.Provider>
                </ScrollView>
                <ScrollView
                  testID="earn-loan-routes-column"
                  w={EARN_OFFER_ROUTES_COLUMN_WIDTH}
                  flexShrink={0}
                >
                  <YStack pt="$5" pb="$5" pr="$5">
                    {routeList}
                  </YStack>
                </ScrollView>
              </XStack>
            </YStack>
          ) : (
            <YStack testID="earn-loan-router" px="$5" pt="$2.5" pb="$5">
              {form}
            </YStack>
          )}
        </YStack>
      </Page.Body>
      {isBeside && !done ? null : footer}
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
