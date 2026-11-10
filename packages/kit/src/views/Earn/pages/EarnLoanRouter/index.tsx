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
  Button,
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
import type { ColorTokens, IBadgeType } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useEarnAtom } from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import {
  EJotaiContextStoreNames,
  useCurrencyPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EModalStakingRoutes,
  ETabEarnRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { formatSwapQuoteDuration } from '@onekeyhq/shared/src/utils/swapQuoteDurationUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { buildBorrowMarketKey } from '../../../Borrow/borrowMarketKey';
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
import { leaveEarnWindowFor } from '../../earnWindowReturn';
import { getEarnAssetClassLabel } from '../EarnAssetSelect/earnAssetClassLabel';
import {
  listAssetSelectNetworks,
  scopeAssetSelectTokens,
} from '../EarnAssetSelect/earnAssetSelect.utils';
import {
  EarnDoneHeader,
  formatDoneAmount,
} from '../EarnRouter/EarnDepositDone';
import {
  EARN_OFFER_ROUTES_COLUMN_WIDTH,
  getEarnSwapFee,
  listEarnNetworkIds,
  listPayTokens,
} from '../EarnRouter/earnRouter.utils';

import { LoanLtvBar } from './LoanLtvBar';
import {
  LOAN_HEALTH_TEXT_COLOR,
  buildLoanRoutesForPicks,
  buildLoanSelectTokens,
  getLoanCardMetrics,
  getLoanDoneLine,
  getLoanForPositionLtv,
  getLoanHealthTone,
  getLoanLtvBar,
  getLoanPayPath,
  getLoanRouteMetrics,
  getLoanSteps,
  isLoanPlanStopped,
  listLoanSelectNetworks,
  pickLoanBorrowPick,
  rankLoanRoutes,
  scopeLoanPick,
} from './loanRouter.utils';
import { EARN_LOAN_MODAL_SIZE } from './loanRouterModal';
import {
  LoanPairTitle,
  LoanPickBar,
  LoanRouteList,
  formatLoanFiat,
  formatLoanLtv,
  formatLoanPercent,
  getLoanBlockText,
  isLendingClosed,
  isLoanLoss,
} from './LoanRouterParts';
import { useLoanToneColors } from './loanToneColors';
import { useLoanModalHeight } from './useLoanModalHeight';
import { useLoanPayWith } from './useLoanPayWith';
import { useLoanRouterAccount, useLoanRouterFacts } from './useLoanRouterFacts';
import { useLoanRouterRun } from './useLoanRouterRun';

import type { ILoanLtvTone } from './loanLtvBar.types';
import type {
  ILoanPayPath,
  ILoanPositionAsset,
  ILoanRoute,
  ILoanRouteBlock,
  ILoanStep,
} from './loanRouter.utils';
import type { ILoanReserveSide, ILoanRouteItem } from './LoanRouterParts';
import type { ILoanRunDone, ILoanRunPlan } from './useLoanRouterRun';
import type { IHealthFactorDetail } from '../../../Borrow/components/healthFactorValueColor';
import type { IEarnOutcome } from '../../../Staking/components/UniversalStake/EarnFormSummary';
import type {
  IEarnAssetPick,
  IEarnAssetSelectNetwork,
} from '../EarnAssetSelect/earnAssetSelect.utils';

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

// Each step's word over the button, the one the button itself uses
const LOAN_STEP_WORDS: Record<ILoanStep, ETranslations> = {
  swap: ETranslations.global_swap,
  bridge: ETranslations.swap_page_bridge,
  approve: ETranslations.global_approve,
  supply: ETranslations.defi_supply,
  borrow: ETranslations.global_borrow,
};

// A network by its id: from the markets where one is there, else the app's
// own list (a network Pay with pays from that no market is on)
const findLoanNetwork = (
  networks: Map<string, IEarnAssetSelectNetwork>,
  networkId?: string,
): IEarnAssetSelectNetwork | undefined => {
  if (!networkId) {
    return undefined;
  }
  const known = networks.get(networkId);
  if (known) {
    return known;
  }
  const local = networkUtils.getLocalNetworkInfo(networkId);
  return local
    ? { id: local.id, name: local.name, logoURI: local.logoURI }
    : undefined;
};

// The larger of two balances, either of which may be unknown
const maxBalance = (a?: string, b?: string) => {
  const known = [a, b].flatMap((value) => {
    const parsed = new BigNumber(value ?? '');
    return parsed.isFinite() ? [parsed] : [];
  });
  return known.length ? BigNumber.max(...known).toFixed() : undefined;
};

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

// A health factor's band as the Borrow page's status badge reads it, and
// the app's word for a band the server hasn't named for this position
const HEALTH_TONE_BADGE: Record<ILoanLtvTone, IBadgeType> = {
  success: 'success',
  caution: 'warning',
  critical: 'critical',
};
const HEALTH_TONE_WORD: Record<ILoanLtvTone, ETranslations> = {
  success: ETranslations.perp_portfolio_health_status_healthy,
  caution: ETranslations.perp_portfolio_health_status_moderate,
  critical: ETranslations.perp_portfolio_health_status_high_risk,
};

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
  const intl = useIntl();
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
  const afterBadge = HEALTH_TONE_BADGE[getLoanHealthTone(after)];
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
      {/* The band it lands in, in the market page's word: the server's own
          where the position stays in its band (demo 10-29) */}
      <Badge badgeType={afterBadge}>
        {current?.status?.tag && current.status.badge === afterBadge
          ? current.status.tag
          : intl.formatMessage({
              id: HEALTH_TONE_WORD[getLoanHealthTone(after)],
            })}
      </Badge>
    </XStack>
  );
}

// The position's LTV, before and after once amounts are typed. While the
// market's figures load, a placeholder as the figures under it have
function LtvValue({
  before,
  after,
  isChanging,
  isLoading,
  color,
}: {
  before?: number;
  after?: number;
  isChanging: boolean;
  isLoading?: boolean;
  color?: string;
}) {
  if (isLoading) {
    return <Skeleton.BodyMd w={56} />;
  }
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

// The way from the loan's market here to its card in My portfolio, where
// the whole position is managed: repaying, withdrawing, collateral, E-Mode
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
    networkId: routeNetworkId,
    routeKey,
    wide,
    collateralAmount: startCollateralAmount,
    borrowAmount: startBorrowAmount,
    ltv: startLtv,
    payKey: startPayKey,
  } = route.params as IRouteParams;
  const { gtLg } = useMedia();
  const reduceMotion = useReducedMotion();
  const loanAccount = useLoanRouterAccount();
  const hasNoWallet = !loanAccount.accountId && !loanAccount.indexedAccountId;
  const { showAccountSelector } = useAccountSelectorTrigger({
    num: 0,
    showConnectWalletModalInDappMode: true,
  });
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
  // The one network both sides are on, a loan being one market's: picked on
  // either side, it is both sides'. None: every network (11-05)
  const [scopeNetworkId, setScopeNetworkId] = useState<string | undefined>(
    routeNetworkId,
  );
  const collateralScoped = useMemo(
    () => scopeLoanPick(collateralPick, scopeNetworkId),
    [collateralPick, scopeNetworkId],
  );
  const borrowScoped = useMemo(
    () => scopeLoanPick(borrowPick, scopeNetworkId),
    [borrowPick, scopeNetworkId],
  );
  const isClassMode =
    collateralPick.kind === 'class' || borrowPick.kind === 'class';
  // What the first box holds: an amount of what Pay with pays with (the
  // collateral itself unless another token is picked or held)
  const [collateralAmount, setCollateralAmount] = useState(
    startCollateralAmount ?? '',
  );
  // The loan typed by hand, an emptied box included; otherwise it follows
  // the LTV bar
  const [typedBorrow, setTypedBorrow] = useState<string | undefined>(
    startBorrowAmount,
  );
  // The market position's LTV the bar was dragged to. Until the bar moves or
  // a loan is typed there is none: borrowing is up to the user
  const [draggedLtv, setDraggedLtv] = useState<number | undefined>(startLtv);
  // The loan an LTV gives where there is collateral to hold one (in the
  // market already, or typed), else none
  const loanAtLtvRef = useRef<((ltv: number) => string) | undefined>(undefined);
  // Max LTV on the bar, and the loan the Borrow box says is available there
  const ltvCapRef = useRef<number | undefined>(undefined);
  const availableRef = useRef<string | undefined>(undefined);
  const toneColors = useLoanToneColors();
  // While the bar is dragged the markets keep their order
  const [isSliding, setIsSliding] = useState(false);
  const slideOrderRef = useRef<string[]>([]);
  const [pickedKey, setPickedKey] = useState<string | undefined>(routeKey);
  const [done, setDone] = useState<ILoanRunDone>();
  // After a press whose supply went in and whose loan didn't
  const [suppliedNote, setSuppliedNote] = useState<string>();
  // A swap or a bridge brought the collateral: the box holds what came in,
  // as the collateral itself, and the press goes on by itself once. The
  // balance it left there counts until the market's own figures catch up
  const [handoff, setHandoff] = useState<{
    routeKey: string;
    autoStart: boolean;
    balance?: string;
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

  // The wallet for the selector's balances, on the markets' networks and
  // every one Earn offers on, as Pay with reads it: a collateral held where
  // no market takes it is bridged to one (11-05). Read fresh unless the
  // home or Pay with just did
  const [{ availableAssetsByType = {} }] = useEarnAtom();
  const walletNetworkIds = useMemo(
    () =>
      listEarnNetworkIds({
        assets: Object.values(availableAssetsByType).flatMap(
          (list) => list ?? [],
        ),
        marketNetworkIds: markets.map((entry) => entry.market.networkId),
      }),
    [availableAssetsByType, markets],
  );
  const wallet = useEarnDesktopWalletHoldings({
    isActive: true,
    refreshNetworkIds: walletNetworkIds,
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
  // What is lent against the collateral on any network: the selector's
  // network column narrows it
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
  // Each side's network column, in one order: where the wallet holds the
  // most collateral first, then by name
  const supplyNetworks = useMemo(
    () => listAssetSelectNetworks(supplyTokens),
    [supplyTokens],
  );
  const borrowNetworks = useMemo(
    () =>
      listLoanSelectNetworks({ order: supplyNetworks, tokens: borrowTokens }),
    [borrowTokens, supplyNetworks],
  );
  // Every network a market is on, by id
  const loanNetworkById = useMemo(() => {
    const byId = new Map<string, IEarnAssetSelectNetwork>();
    markets.forEach(({ market }) => {
      if (!byId.has(market.networkId)) {
        byId.set(market.networkId, {
          id: market.networkId,
          name: market.network.name,
          logoURI: market.network.logoURI,
        });
      }
    });
    return byId;
  }, [markets]);
  const scopeNetwork = findLoanNetwork(loanNetworkById, scopeNetworkId);
  const routes = useMemo(
    () =>
      buildLoanRoutesForPicks({
        markets,
        collateral: collateralScoped,
        borrow: borrowScoped,
        stableSymbols,
      }),
    [borrowScoped, collateralScoped, markets, stableSymbols],
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
    loanAccount,
    typedAmount: collateralAmount,
    isLocked: false,
    startKey: startPayKey,
  });
  const { payToken } = payWith;
  // Paid with another token, or from another network: a swap or a bridge
  // brings the collateral first. Once it has, the box holds the collateral
  // itself
  const isSwapping = payWith.isSwapping && !handoff;
  let conversion: Exclude<ILoanPayPath, 'direct'> | undefined;
  if (isSwapping) {
    conversion = payWith.isBridging ? 'bridge' : 'swap';
  }
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
  // The collateral each market takes in for it: what the swap or the bridge
  // brings for the market Pay with pays into (the collateral itself bridged
  // from another network arrives less the bridge's cost); the amount itself
  // in the box's own token; the same value in its token for the others, so
  // the markets compare the same plan
  const supplyAmountOf = useCallback(
    (item?: ILoanRoute) => {
      if (!item || !toBigNumber(collateralAmount).gt(0)) {
        return '';
      }
      if (isSwapping && item.key === payRoute?.key && payWith.estimatedSupply) {
        return payWith.estimatedSupply;
      }
      if (boxSymbol && isSameLoanAsset(item.collateral.symbol, boxSymbol)) {
        return collateralAmount;
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
  // The loan as typed, or as the bar was moved to; none otherwise, a supply
  // alone
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
      : '');
  const hasCollateral = toBigNumber(collateralAmount).gt(0);
  const hasLoan = toBigNumber(borrowAmount).gt(0);
  const isSupplyAlone = hasCollateral && !hasLoan;
  // Until a loan is typed or the bar moved, the markets compare the pair at
  // the Loans list's reference loan, not at none
  const isReferencePlan = !hasLoan && draggedLtv === undefined;
  // The loan a let-go of the bar writes in the box: the amount it showed
  // while held
  const positionCollateralValue = priceRoute?.facts.collateralValue ?? 0;
  const positionDebtValue = priceRoute?.facts.debtValue ?? 0;
  const priceBorrow = priceRoute?.facts.borrowPrice;
  loanAtLtvRef.current =
    priceBorrow && positionCollateralValue + newCollateralValue > 0
      ? (ltv: number) =>
          getLoanForPositionLtv({
            ltv,
            collateralValue: positionCollateralValue,
            debtValue: positionDebtValue,
            newCollateralValue,
            borrowPrice: priceBorrow,
            decimals: borrowDecimals,
          })
      : undefined;
  // Before amounts are typed the plan sits at the bar's LTV: none until it
  // is moved
  const previewLtv = draggedLtv ?? 0;
  const ltvStage = typedBorrow ? undefined : previewLtv;

  const rankedItems = useMemo<ILoanRouteItem[]>(
    () =>
      rankLoanRoutes(
        routes.map((item) => {
          const facts = byRoute.get(item.key);
          return {
            route: item,
            facts,
            metrics: getLoanCardMetrics({
              route: item,
              facts,
              collateralAmount: supplyAmountOf(item),
              borrowAmount,
              ltvStage,
              isReference: isReferencePlan,
            }),
          };
        }),
      ),
    [borrowAmount, byRoute, isReferencePlan, ltvStage, routes, supplyAmountOf],
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
  // What a market's reason stops: any loan, and a supply alone only where
  // the account can't use the network
  const stopsPlan = (block?: ILoanRouteBlock) =>
    isLoanPlanStopped(block, isSupplyAlone);
  // How Pay with pays for a market's collateral: as it is, or after a swap
  // or a bridge
  const { payTokenFor } = payWith;
  const payPathOf = useCallback(
    (item: ILoanRoute): ILoanPayPath => {
      const token = payTokenFor(item.collateral.symbol);
      return getLoanPayPath({
        payToken: token && {
          networkId: token.networkId,
          symbol: token.token.symbol,
        },
        collateral: item.collateral,
      });
    },
    [payTokenFor],
  );
  // The wallet pays with the collateral there: no swap or bridge first
  const paysDirectly = (item: ILoanRouteItem) =>
    Boolean(payTokenFor(item.route.collateral.symbol)) &&
    payPathOf(item.route) === 'direct';
  // Unpicked, the check goes to the best market Pay with pays directly
  // (the wallet's largest holding of the collateral is there), else to the
  // best one: one that lends the pair first, then one that takes a supply
  // alone
  const usableItem =
    items.find((item) => !item.metrics.block && paysDirectly(item)) ??
    items.find((item) => !item.metrics.block) ??
    items.find(
      (item) => !stopsPlan(item.metrics.block) && paysDirectly(item),
    ) ??
    items.find((item) => !stopsPlan(item.metrics.block));
  // The market of the row the modal opened from (or one picked while the
  // figures loaded) that doesn't lend the token to the account at all gives
  // way to the best one that can take the plan. A supply alone stays
  const isPickClosed =
    isFactsLoaded &&
    isLendingClosed(pickedItem?.metrics.block) &&
    stopsPlan(pickedItem?.metrics.block);
  const selected =
    (isPickClosed ? usableItem : undefined) ??
    pickedItem ??
    usableItem ??
    items[0];
  // With no market picked, the best one is checked once every market's
  // figures are in, and the wallet's tokens (which market Pay with pays
  // directly), and stays checked: typing never moves the check to another
  // market or network. One it can't take any more shows why
  const isPickListed =
    pickedKey !== undefined && routes.some((item) => item.key === pickedKey);
  const autoPickKey =
    (!isPickListed || isPickClosed) && isFactsLoaded && payWith.isLoaded
      ? selected?.route.key
      : undefined;
  useEffect(() => {
    if (autoPickKey) {
      setPickedKey(autoPickKey);
    }
  }, [autoPickKey]);
  const selectedRoute = selected?.route;
  const selectedFacts = selected?.facts;
  // What the plan as typed does in the picked market: the form's own
  // figures, whatever loan the cards compare at
  const planMetrics = selectedRoute
    ? getLoanRouteMetrics({
        route: selectedRoute,
        facts: selectedFacts,
        collateralAmount: supplyAmountOf(selectedRoute),
        borrowAmount,
        ltvStage,
      })
    : undefined;
  const planBlock = planMetrics?.block;
  // The market doesn't lend the token to the account (or the account can't
  // use the network): no loan to plan there, the bar holds still
  const isLendClosed = isLendingClosed(planBlock);
  // Nothing to show of the plan: it can't go in at all. A supply alone
  // still goes in where only the loan is closed
  const isClosed = isLendClosed && stopsPlan(planBlock);

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
  // The box's token carries its network: what pays, from wherever it is
  const boxNetworkLogoURI = isSwapping
    ? findLoanNetwork(loanNetworkById, payToken?.networkId)?.logoURI
    : networkLogoURI;
  // What the box can take: the pay token's balance, or the collateral's,
  // with what a swap or a bridge just brought until the market's figures
  // count it
  const boxBalance = isSwapping
    ? payToken?.amount
    : maxBalance(
        selectedFacts?.walletBalance,
        handoff && handoff.routeKey === selectedRoute?.key
          ? handoff.balance
          : undefined,
      );
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
  // A token changed starts the loan over: none
  const resetLoan = useCallback(() => {
    setTypedBorrow(undefined);
    setDraggedLtv(undefined);
  }, []);
  // A typed loan is the plan, an emptied box none: the bar follows either
  const handleBorrowChange = useCallback((value: string) => {
    setTypedBorrow(value);
    setDraggedLtv(undefined);
  }, []);
  // Where the bar starts (what is borrowed in the market already), read at
  // the press
  const ltvStartRef = useRef(0);
  const handleLtvChange = useCallback((ltv: number, isFinal: boolean) => {
    // At the start there is no loan: kept as none, not as the LTV the start
    // sat at, so a price move can't make one up
    const value = ltv <= ltvStartRef.current + 1e-9 ? 0 : ltv;
    const loanAt = loanAtLtvRef.current;
    // At Max LTV the loan is what the Borrow box says is available, to its
    // last place, not a rounded amount a hair under it
    const cap = ltvCapRef.current;
    const available = availableRef.current;
    if (loanAt && cap !== undefined && available && value >= cap - 1e-9) {
      setTypedBorrow(available);
      setDraggedLtv(undefined);
      return;
    }
    // Let go, the loan the bar set is the plan, as if typed: a price move or
    // more collateral then moves the bar, not the amount. With nothing to
    // borrow against yet, the bar stays the LTV the loan follows once
    // collateral is typed
    if (isFinal && loanAt) {
      setTypedBorrow(value > 0 ? loanAt(value) : '');
      setDraggedLtv(undefined);
      return;
    }
    setTypedBorrow(undefined);
    setDraggedLtv(value);
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
  const boxNetworkId = isSwapping
    ? payToken?.networkId
    : payRoute?.market.networkId;
  const boxTokenKey = `${boxNetworkId ?? ''}|${boxSymbol}`;
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
    // A box whose token wasn't known yet (the markets still loading, as when
    // the window reopens with its amount) keeps that amount. So does what a
    // swap or a bridge brought: it came in as the collateral, not as a value
    // to work out again in it
    if (
      handoff ||
      last.key === boxTokenKey ||
      !last.symbol ||
      !toBigNumber(collateralAmount).gt(0)
    ) {
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

  // The picks, in the shared selector over the window. Either side's network
  // (or All Networks) becomes both sides'
  const handleCollateralPick = useCallback(
    (pick: IEarnAssetPick) => {
      setScopeNetworkId(pick.networkId);
      setCollateralPick(scopeLoanPick(pick));
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
        networkId: pick.networkId,
      });
      if (nextBorrow) {
        setBorrowPick(nextBorrow);
      }
    },
    [borrowPick, markets, payWith, resetLoan, stableSymbols],
  );
  // A loan typed in one token means nothing in another. The borrow list
  // offers a network only where a market takes the collateral too
  const handleBorrowPick = useCallback(
    (pick: IEarnAssetPick) => {
      setScopeNetworkId(pick.networkId);
      setBorrowPick(scopeLoanPick(pick));
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
              ? ETranslations.defi_supply
              : ETranslations.global_borrow,
          }),
          tokens: isSupply ? supplyTokens : borrowTokens,
          networks: isSupply ? supplyNetworks : borrowNetworks,
          selected: isSupply ? collateralScoped : borrowScoped,
          onSelect: isSupply ? handleCollateralPick : handleBorrowPick,
        },
      });
    },
    [
      borrowNetworks,
      borrowScoped,
      borrowTokens,
      collateralScoped,
      handleBorrowPick,
      handleCollateralPick,
      intl,
      navigation,
      supplyNetworks,
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
  // Pay with's own picker: Swap's, opening on the market's network with the
  // others beside it
  const handleOpenPayWith = useCallback(() => {
    payWith.openPicker((isNewToken) => {
      if (isNewToken) {
        setCollateralAmount('');
        setHandoff(undefined);
        resetLoan();
      }
    });
  }, [payWith, resetLoan]);

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
      (!hasMarketCollateral && !hasCollateral) ||
      planMetrics?.maxBorrow === undefined ||
      isLendClosed ||
      !selectedFacts?.borrowPrice
    ) {
      return undefined;
    }
    const byLiquidity =
      selectedFacts.liquidity !== undefined
        ? selectedFacts.liquidity / selectedFacts.borrowPrice
        : Number.POSITIVE_INFINITY;
    return new BigNumber(
      Math.max(0, Math.min(planMetrics.maxBorrow, byLiquidity)),
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
  // A bridge says before the press how long it takes and what the network
  // charges, from the same quote, as the Swap page's route does. The fee
  // comes in the currency the app asks the swap service in: the app's own
  const bridgeQuote =
    conversion === 'bridge' && hasCollateral ? payWith.shownQuote : undefined;
  const bridgeDuration = bridgeQuote
    ? formatSwapQuoteDuration(bridgeQuote)
    : undefined;
  const bridgeFeeValue = getEarnSwapFee(bridgeQuote);
  const bridgeFee =
    bridgeFeeValue === undefined
      ? undefined
      : numberFormat(String(bridgeFeeValue), {
          formatter: 'value',
          formatterOptions: { currency },
        });
  const collateralBox = (
    <YStack>
      <StakingAmountInput
        boxTestID="earn-loan-collateral"
        // Paid with the collateral itself the box is the supply, in the
        // picks' and the steps' word; paid with another token it is what
        // leaves the wallet
        title={
          isSwapping
            ? EARN_DESKTOP_DEMO_COPY.payWith
            : intl.formatMessage({ id: ETranslations.defi_supply })
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
          selectedNetworkImageUri: boxNetworkLogoURI,
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
      {/* What the swap or the bridge brings and goes in as collateral,
          under what pays for it; a bridge's time and fee under that. It
          grows in with a pick of another token in Pay with */}
      <HeightTransition duration={SUPPLY_LINE_MS} hide={!isSwapping}>
        <YStack pt="$2" aria-hidden={!isSwapping}>
          <StakingAmountResultLine
            testID="earn-loan-swap-supply-amount"
            label={EARN_DESKTOP_DEMO_COPY.youSupply}
            value={supplyLine}
            isPlaceholder={!supplyLine.startsWith('≈')}
            loading={payWith.isQuoting}
          />
          {conversion === 'bridge' ? (
            <YStack pt="$1">
              <StakingAmountResultLine
                testID="earn-loan-bridge-duration"
                label={intl.formatMessage({
                  id: ETranslations.provider_swap_duration,
                })}
                value={bridgeDuration ?? '–'}
                isPlaceholder={!bridgeDuration}
                loading={payWith.isQuoting}
              />
              <StakingAmountResultLine
                testID="earn-loan-bridge-fee"
                label={intl.formatMessage({
                  id: ETranslations.provider_network_fee,
                })}
                value={bridgeFee ?? '–'}
                isPlaceholder={!bridgeFee}
                loading={payWith.isQuoting}
              />
            </YStack>
          ) : null}
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
  const ltvBar =
    selectedRoute && selectedFacts
      ? getLoanLtvBar({
          route: selectedRoute,
          facts: selectedFacts,
          maxLtv: isLendClosed ? undefined : planMetrics?.maxLtv,
          newCollateralValue: selectedNewCollateralValue,
          loanValue: selectedLoanValue,
          previewLtv,
        })
      : undefined;
  ltvStartRef.current = ltvBar && !ltvBar.isPreview ? ltvBar.used : 0;
  ltvCapRef.current = isLendClosed ? undefined : ltvBar?.cap;
  availableRef.current = availableToBorrow;
  // Until the picked market's own figures are in (and the markets, while
  // they load), the form holds their places: the LTV's, the Net APY's and
  // the position's. A preview rate shown meanwhile would turn into a dash
  // once the market turned out not to lend the token
  const isFiguresLoading =
    !isMarketsLoaded || (Boolean(selectedRoute) && !selectedFacts);
  // A position's health factor is the server's, the Borrow page's figure;
  // the window's own reading of it (from the reserves' prices, a hair off)
  // only scales what typed amounts do to it, so before and after agree with
  // the page
  const serverHealth = selectedFacts?.healthFactorDetail;
  const serverHealthValue = serverHealth ? Number(serverHealth.value) : NaN;
  const ownHealthBefore = planMetrics?.healthFactorBefore;
  const healthScale =
    Number.isFinite(serverHealthValue) && ownHealthBefore
      ? serverHealthValue / ownHealthBefore
      : 1;
  const hasPosition = Boolean(
    selectedFacts &&
    (selectedFacts.collateralValue > 0 || selectedFacts.debtValue > 0),
  );
  const isChanging = hasLoan || hasCollateral;
  // The market's LTV as it stands, where the account has collateral there
  const currentLtv =
    selectedFacts && selectedFacts.collateralValue > 0
      ? selectedFacts.debtValue / selectedFacts.collateralValue
      : undefined;
  // A market that doesn't lend the token here (or no market at all) has no
  // loan to draw: the bar keeps only what is borrowed there already, at the
  // LTV a supply alone leaves it
  const isBarInert = !isFiguresLoading && (isLendClosed || !selectedRoute);
  let barShown = ltvBar;
  if (isClosed) {
    barShown =
      currentLtv !== undefined
        ? { used: currentLtv, value: currentLtv, isPreview: false }
        : undefined;
  } else if (isLendClosed) {
    barShown =
      ltvBar && !ltvBar.isPreview
        ? { used: ltvBar.value, value: ltvBar.value, isPreview: false }
        : undefined;
  }
  // A fresh pair before any amount: the bar is the plan's LTV, and what the
  // plan leaves follows from it alone, the health factor and the price that
  // would sell the collateral. The rows under the bar show them, as its
  // color already does
  const planPreview =
    !isClosed &&
    !hasPosition &&
    !isChanging &&
    ltvBar?.isPreview &&
    ltvBar.liquidation !== undefined &&
    ltvBar.value > 0
      ? {
          health: ltvBar.liquidation / ltvBar.value,
          liquidationPrice: selectedFacts?.collateralPrice
            ? (selectedFacts.collateralPrice * ltvBar.value) /
              ltvBar.liquidation
            : undefined,
        }
      : undefined;
  // The health factor the bar's LTV leaves, in the Borrow page's bands;
  // where the market doesn't lend, the position's own
  const barTone = isClosed
    ? getLoanHealthTone(
        Number.isFinite(serverHealthValue) ? serverHealthValue : undefined,
      )
    : getLoanHealthTone(
        ltvBar?.liquidation !== undefined && ltvBar.value > 0
          ? (ltvBar.liquidation / ltvBar.value) * healthScale
          : undefined,
      );
  const isLtvChanging = isChanging && !isClosed;

  // Before anything is typed the bar is the position as it stands, not a
  // loan on offer
  const ltvLabel =
    hasPosition && !isLtvChanging
      ? EARN_DESKTOP_DEMO_COPY.loanCurrentLtv
      : EARN_DESKTOP_DEMO_COPY.loanLtv;
  const ltvBlock = (
    <YStack testID="earn-loan-ltv" px="$3.5" pt="$3" gap="$1">
      <XStack jc="space-between" ai="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          {ltvLabel}
        </SizableText>
        <LtvValue
          before={currentLtv}
          after={isClosed ? undefined : ltvBar?.value}
          isChanging={isLtvChanging}
          isLoading={isFiguresLoading}
          color={toneColors.text[barTone]}
        />
      </XStack>
      <LoanLtvBar
        testID="earn-loan-ltv-bar"
        bar={barShown}
        isInert={isBarInert}
        tone={barTone}
        disabled={isLocked || isLendClosed}
        onChange={handleLtvChange}
        onSlideStart={handleSlideStart}
        onSlideEnd={handleSlideEnd}
        valueText={
          ltvBar ? `${ltvLabel} ${formatLoanLtv(ltvBar.value)}` : undefined
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

  let healthAfter = scaleHealth(ownHealthBefore, healthScale);
  if (isChanging) {
    healthAfter = scaleHealth(planMetrics?.healthFactor, healthScale);
  } else if (planPreview) {
    healthAfter = planPreview.health;
  }
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
          after={healthAfter}
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
  // The plan's, once amounts are typed; before, a fresh pair's at the bar's
  // LTV. None where the market doesn't lend, or with nothing borrowed
  let liquidationPrice: number | undefined;
  if (!isClosed) {
    liquidationPrice = isChanging
      ? planMetrics?.liquidationPrice
      : planPreview?.liquidationPrice;
  }
  const liquidationRow =
    !hasPosition || isSinglePair ? (
      <EarnFormRow
        key="liquidation"
        testID="earn-loan-liquidation"
        label={EARN_DESKTOP_DEMO_COPY.loanLiquidationPrice}
        value={
          <RowValue>
            {liquidationPrice !== undefined
              ? numberFormat(String(liquidationPrice), {
                  formatter: 'price',
                  formatterOptions: { currency },
                })
              : '–'}
          </RowValue>
        }
        // Only while the price is still above it: past it, the health
        // factor in red says so
        note={
          liquidationPrice !== undefined &&
          selectedFacts?.collateralPrice &&
          liquidationPrice < selectedFacts.collateralPrice ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {EARN_DESKTOP_DEMO_COPY.loanBelowNow(
                `${new BigNumber(1)
                  .minus(
                    new BigNumber(liquidationPrice).div(
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

  // Figures that land after the form shows fade in
  const fadeInProps = reduceMotion
    ? undefined
    : {
        transition: 'quick' as const,
        animateOnly: ANIMATE_ONLY_OPACITY,
        enterStyle: FADE_IN,
      };

  // The position's Net APY in the market, as its page reads it: as it is,
  // then with the plan in it, the way LTV and Health Factor read. A fresh
  // market's is the plan's own (a supply alone's is its supply APY). Always
  // a rate (demo 10-29). A plan the market can't take has no result: a dash
  const netApyLabel = intl.formatMessage({ id: ETranslations.defi_net_apy });
  const netApyAfter = isClosed ? undefined : planMetrics?.netApy;
  const netApyBefore = isClosed ? undefined : planMetrics?.netApyBefore;
  let outcome: IEarnOutcome;
  if (isFiguresLoading) {
    outcome = { label: netApyLabel, values: [] };
  } else {
    outcome = {
      label: netApyLabel,
      // A gain keeps the text's color, as on the Loans list and the loan
      // card: green read as borrowing to earn more. A loss in the cards' red
      isCost: isLoanLoss(netApyAfter),
      values:
        netApyAfter === undefined
          ? []
          : [
              {
                before:
                  isChanging && netApyBefore !== undefined
                    ? formatLoanPercent(netApyBefore)
                    : undefined,
                main: formatLoanPercent(netApyAfter),
              },
            ],
    };
  }
  const summary =
    selectedRoute || isFiguresLoading ? (
      <EarnFormSummary outcome={outcome} isOutcomeLoading={isFiguresLoading} />
    ) : null;

  // The window closes for one of the market's pages. Back from that page
  // opens the window again as it was left: the pair or kinds, their network,
  // the market, the amounts and Pay with's token (demo 10-30)
  const payPickedKey = payWith.pickedKey;
  const leaveWindowFor = useCallback(
    (page: ETabEarnRoutes, marketRouteKey?: string) => {
      leaveEarnWindowFor(page, {
        screen: EModalStakingRoutes.EarnLoanRouter,
        params: {
          collateral:
            collateralPick.kind === 'token'
              ? collateralPick.symbol
              : routeCollateral,
          collateralClass:
            collateralPick.kind === 'class'
              ? collateralPick.assetClass
              : undefined,
          borrow: borrowPick.kind === 'token' ? borrowPick.symbol : routeBorrow,
          borrowClass:
            borrowPick.kind === 'class' ? borrowPick.assetClass : undefined,
          networkId: scopeNetworkId,
          routeKey: marketRouteKey,
          wide,
          collateralAmount: collateralAmount || undefined,
          borrowAmount: typedBorrow,
          ltv: draggedLtv,
          payKey: payPickedKey,
        },
      });
      navigation.popStack();
    },
    [
      borrowPick,
      collateralAmount,
      collateralPick,
      draggedLtv,
      navigation,
      payPickedKey,
      routeBorrow,
      routeCollateral,
      scopeNetworkId,
      typedBorrow,
      wide,
    ],
  );
  // The market's card in My portfolio, the whole position there (demo
  // 11-10: the market's own page is retired); back opens this window again
  const positionMarket = selectedRoute?.market;
  const handleManagePosition = useCallback(() => {
    if (!positionMarket) {
      return;
    }
    leaveWindowFor(ETabEarnRoutes.EarnPositions, selectedRoute?.key);
    EarnNavigation.pushToEarnPositions(navigation, {
      focusMarket: buildBorrowMarketKey(positionMarket),
    });
  }, [leaveWindowFor, navigation, positionMarket, selectedRoute?.key]);
  // The picked market's transactions, where the Earn window has its History
  // (demo 11-10): the market's own page had it
  const historyAccountId = selectedFacts?.networkAccountId;
  const hasHistory = Boolean(
    positionMarket && historyAccountId && selectedFacts?.hasHistory,
  );
  const historyLabel = intl.formatMessage({ id: ETranslations.global_history });
  const handleOpenHistory = useCallback(() => {
    if (!positionMarket || !historyAccountId) {
      return;
    }
    BorrowNavigation.pushToBorrowHistory(navigation, {
      accountId: historyAccountId,
      networkId: positionMarket.networkId,
      provider: positionMarket.provider,
      marketAddress: positionMarket.marketAddress,
      title: historyLabel,
      isModal: true,
    });
  }, [historyAccountId, historyLabel, navigation, positionMarket]);
  // The picked market's page for one of its tokens, its form on that side
  // with the amount typed here. Paid with another token, the supply isn't
  // the collateral yet: that form opens empty
  const indexedAccountId = loanAccount.indexedAccountId;
  const handleOpenReserve = useCallback(
    (loanRoute: ILoanRoute, side: ILoanReserveSide) => {
      const isSupply = side === 'supply';
      const token = isSupply ? loanRoute.collateral : loanRoute.borrow;
      let amount: string | undefined;
      if (isSupply) {
        amount =
          hasCollateral && !isSwapping
            ? supplyAmountOf(loanRoute) || undefined
            : undefined;
      } else if (hasLoan && loanRoute.key === selectedRoute?.key) {
        amount = borrowAmount;
      }
      const { market } = loanRoute;
      leaveWindowFor(ETabEarnRoutes.BorrowReserveDetails, loanRoute.key);
      BorrowNavigation.pushToBorrowReserveDetails(navigation, {
        networkId: market.networkId,
        provider: market.provider,
        marketAddress: market.marketAddress,
        // A native token's is empty, as the market page's own rows pass it
        reserveAddress: token.reserveAddress,
        symbol: token.symbol,
        logoURI: token.logoURI,
        accountId: byRoute.get(loanRoute.key)?.networkAccountId,
        indexedAccountId,
        tab: side,
        amount,
      });
    },
    [
      borrowAmount,
      byRoute,
      hasCollateral,
      hasLoan,
      indexedAccountId,
      isSwapping,
      leaveWindowFor,
      navigation,
      selectedRoute?.key,
      supplyAmountOf,
    ],
  );

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

  // Why the market can't take the plan shows under its card only; here it
  // holds the button. A supply alone goes in where only a loan can't
  const blockText =
    selectedRoute && planBlock && stopsPlan(planBlock)
      ? getLoanBlockText({
          block: planBlock,
          route: selectedRoute,
          currency,
        })
      : undefined;
  // The steps the press runs and the button names. A loan typed with no
  // collateral borrows against what the market already holds; a supply
  // with no loan typed is all a press does. Paid with another token, a swap
  // brings the collateral first; from another network, a bridge
  const pressSteps = getLoanSteps({
    hasCollateral,
    hasLoan,
    conversion,
    hasApproval: false,
  });
  const supplyWord = intl.formatMessage({ id: ETranslations.defi_supply });
  let actionLabel = EARN_DESKTOP_DEMO_COPY.supplyAndBorrow;
  if (conversion === 'swap') {
    actionLabel = EARN_DESKTOP_DEMO_COPY.swapSupplyAndBorrow;
  } else if (conversion === 'bridge') {
    actionLabel = EARN_DESKTOP_DEMO_COPY.loanBridgeSupplyAndBorrow;
  }
  if (!pressSteps.includes('supply')) {
    actionLabel = intl.formatMessage({ id: ETranslations.global_borrow });
  } else if (!pressSteps.includes('borrow')) {
    actionLabel = supplyWord;
    if (conversion === 'swap') {
      actionLabel = EARN_DESKTOP_DEMO_COPY.swapAnd(supplyWord);
    } else if (conversion === 'bridge') {
      actionLabel = EARN_DESKTOP_DEMO_COPY.bridgeAnd(supplyWord);
    }
  }
  const buttonText = isInsufficient
    ? intl.formatMessage({ id: ETranslations.earn_insufficient_balance })
    : actionLabel;
  // The swap or the bridge needs its quote for exactly this amount, and a
  // route
  const isSwapReady =
    !isSwapping ||
    !hasCollateral ||
    (payWith.canSwap &&
      Boolean(payWith.estimatedSupply) &&
      !payWith.isQuoting &&
      !payWith.hasNoRoute);
  const canStart =
    Boolean(selectedRoute && selectedFacts?.networkAccountId) &&
    (hasLoan || hasCollateral) &&
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
  // One press: the market's risk notice, then the swap or the bridge; once
  // what it brought is in the wallet on the market's network, the box holds
  // it as the collateral and the press goes on by itself (the supply, then
  // any loan). A rejected swap or bridge changes nothing
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
    setHandoff({
      routeKey: selectedRoute.key,
      autoStart: true,
      balance: swapped.balance,
    });
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
  // After the swap or the bridge: the press goes on once by itself with
  // what came in, unless the market can't take the loan with it (it came in
  // under the quote): then the form shows why, ready to press
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

  // The step a running press is at
  let runStep: ILoanStep | undefined;
  if (run.phase === 'approving') {
    runStep = 'approve';
  } else if (run.phase === 'supplying' || run.phase === 'landing') {
    runStep = 'supply';
  } else if (run.phase === 'borrowing') {
    runStep = 'borrow';
  }

  // What the press leads to, over the button: the steps show in the footer
  const notes = (() => {
    const lines = [
      run.phase === 'landing' ? (
        <SizableText key="landing" size="$bodyMd" color="$textSubdued">
          {hasLoan
            ? EARN_DESKTOP_DEMO_COPY.loanLanding
            : EARN_DESKTOP_DEMO_COPY.loanSupplyLanding}
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
  // The steps over the button where a press runs more than one (one step is
  // the button's own word)
  const renderSteps = (
    steps: ILoanStep[],
    currentStep: number,
    isRunning: boolean,
  ) => {
    const [first, second, third] = steps;
    if (!first || !second) {
      return null;
    }
    return (
      <StakeProgress
        currentStep={currentStep}
        step1Label={intl.formatMessage({ id: LOAN_STEP_WORDS[first] })}
        step2Label={intl.formatMessage({ id: LOAN_STEP_WORDS[second] })}
        step3LabelId={third ? LOAN_STEP_WORDS[third] : undefined}
        isRunning={isRunning}
      />
    );
  };
  // While the swap or the bridge runs: its step, then those after it. Once
  // it is in, the supply's own steps take over (an approval among them where
  // needed). Before the press, the steps it will run
  let progress: ReactElement | null;
  if (payWith.isSwapRunning) {
    progress = renderSteps(
      getLoanSteps({
        hasCollateral: true,
        hasLoan,
        conversion: conversion ?? 'swap',
        hasApproval: false,
      }),
      1,
      true,
    );
  } else if (runStep) {
    const runSteps = getLoanSteps({
      hasCollateral,
      hasLoan,
      conversion,
      hasApproval: run.hasApprovalStep,
    });
    progress = renderSteps(
      runSteps,
      Math.max(1, runSteps.indexOf(runStep) + 1),
      true,
    );
  } else {
    progress = renderSteps(pressSteps, 1, false);
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
        line={getLoanDoneLine({
          plan: done.plan,
          supplied: done.supplied,
          formatAmount: formatDoneAmount,
        })}
      />
    </YStack>
  ) : null;
  // A press with no loan supplied alone
  const isDoneSupplyAlone =
    done !== undefined && !toBigNumber(done.plan.borrowAmount).gt(0);

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
  // The Earn window's History button, in the same place
  const renderHistory = useCallback(
    () => (
      <Button
        testID="earn-loan-history"
        h="$8"
        mr="unset"
        variant="tertiary"
        icon="ClockTimeHistoryOutline"
        size="small"
        onPress={handleOpenHistory}
      >
        {historyLabel}
      </Button>
    ),
    [handleOpenHistory, historyLabel],
  );
  // The done view names what went in (a supply alone, its token only); the
  // form is the Loans window, its picks heading the form
  const renderDoneTitle = useCallback(
    () =>
      done ? (
        <LoanPairTitle
          collateral={{
            symbol: done.plan.route.collateral.symbol,
            logoURI: done.plan.route.collateral.logoURI,
          }}
          borrow={
            isDoneSupplyAlone
              ? undefined
              : {
                  symbol: done.plan.route.borrow.symbol,
                  logoURI: done.plan.route.borrow.logoURI,
                }
          }
        />
      ) : null,
    [done, isDoneSupplyAlone],
  );
  // The picks as their network sees them: a kind's logos are its tokens
  // there
  const supplyTokensShown = useMemo(
    () => scopeAssetSelectTokens(supplyTokens, scopeNetworkId),
    [scopeNetworkId, supplyTokens],
  );
  const borrowTokensShown = useMemo(
    () => scopeAssetSelectTokens(borrowTokens, scopeNetworkId),
    [borrowTokens, scopeNetworkId],
  );
  // Each half in the steps' word, so the bar reads as the press runs, with
  // the network both picks are on
  const pickRow = (
    <LoanPickBar
      supply={{
        testID: 'earn-loan-collateral-pick',
        caption: supplyWord,
        pick: collateralPick,
        tokens: supplyTokensShown,
        purpose: 'loanSupply',
        fallbackLogoURI: collateralLogo,
        onPress: openCollateralSelect,
      }}
      borrow={{
        testID: 'earn-loan-borrow-pick',
        caption: intl.formatMessage({ id: ETranslations.global_borrow }),
        pick: borrowPick,
        tokens: borrowTokensShown,
        purpose: 'loanBorrow',
        fallbackLogoURI: borrowLogo,
        onPress: openBorrowSelect,
      }}
      network={scopeNetwork}
    />
  );

  // A kind of token on a side: each card names its own pair. A card Pay
  // with's token (the one picked, else the wallet's largest holding of the
  // card's collateral) doesn't pay for as it is says what comes first: a
  // swap there, or a bridge from another network
  const isPayLoaded = payWith.isLoaded;
  // The market of the row the window opened from, where it doesn't lend the
  // token to the account (a home row's Aave Core under an E-Mode that leaves
  // the loan out): the check goes to the best market that can, and that
  // row's card leads the list, saying why
  const openedItem = routeKey
    ? items.find((item) => item.route.key === routeKey)
    : undefined;
  const leadingKey =
    isFactsLoaded &&
    openedItem &&
    isLendingClosed(openedItem.metrics.block) &&
    stopsPlan(openedItem.metrics.block)
      ? openedItem.route.key
      : undefined;
  const listItems = useMemo(() => {
    const listed = items.map((item) => {
      const payPath = isPayLoaded ? payPathOf(item.route) : 'direct';
      const isHandedOff = Boolean(
        handoff && item.route.key === handoff.routeKey,
      );
      return {
        ...item,
        pairLabel: isClassMode
          ? `${item.route.collateral.symbol} / ${item.route.borrow.symbol}`
          : undefined,
        payPath: payPath === 'direct' || isHandedOff ? undefined : payPath,
        isBlocked: isLoanPlanStopped(item.metrics.block, isSupplyAlone),
      };
    });
    const lead = leadingKey
      ? listed.find((item) => item.route.key === leadingKey)
      : undefined;
    return lead ? [lead, ...listed.filter((item) => item !== lead)] : listed;
  }, [
    handoff,
    isClassMode,
    isPayLoaded,
    isSupplyAlone,
    items,
    leadingKey,
    payPathOf,
  ]);

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
      // Named for the loan it is worked out at, as the Loans list's column
      netApyLabel={
        isReferencePlan
          ? EARN_DESKTOP_DEMO_COPY.loanNetApyHeader(
              `${EARN_DESKTOP_LOAN_LTV * 100}%`,
            )
          : netApyLabel
      }
      onSelect={isLocked ? noop : handlePickRoute}
      onOpenReserve={isLocked ? noop : handleOpenReserve}
    />
  );
  // The button, as Swap's: under the form in a wide window, else the modal's
  // footer. With no wallet the window still shows every market's rates, and
  // the button connects one, as the deposit window's does (demo 10-29)
  const action = hasNoWallet ? (
    <EarnFormFooter
      isInModalContext
      confirmText={intl.formatMessage({
        id: ETranslations.global_connect_wallet,
      })}
      confirmButtonProps={{
        testID: 'earn-loan-connect-wallet',
        onPress: showAccountSelector,
      }}
    />
  ) : (
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
      {/* The picks top the boxes' stack; beside the markets they head both
          columns instead */}
      <YStack gap="$2">
        {isBeside ? null : pickRow}
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
          the button comes after the result and the account's position, so
          the Health Factor it leaves is read before the press (demo 10-29) */}
      {summary}
      {details}
      {isBeside ? notes : null}
      {isBeside ? action : null}
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
        headerRight={hasHistory && !done ? renderHistory : undefined}
      />
      <Page.Body>
        {/* What the done view's modal fits its height to; the columns fill
            the form's fixed one */}
        <YStack ref={fitModalRef} flex={isBeside ? 1 : undefined}>
          {isBeside && !done ? (
            // The picks head both columns, so the markets start level with
            // the Supply box, over the form's own width as the top of its
            // stack. Each column scrolls by itself: the markets move under
            // the pointer while the form and its button stay
            <YStack flex={1}>
              <XStack px="$5" pt="$2.5">
                <YStack flex={1} minWidth={0}>
                  {pickRow}
                </YStack>
                <Stack w={EARN_OFFER_ROUTES_COLUMN_WIDTH} flexShrink={0} />
              </XStack>
              <XStack testID="earn-loan-router" flex={1} ai="stretch">
                <ScrollView
                  flex={1}
                  minWidth={0}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <EarnFormActionPlacementContext.Provider value="inline">
                    <YStack px="$5" pt="$2" pb="$5">
                      {form}
                    </YStack>
                  </EarnFormActionPlacementContext.Provider>
                </ScrollView>
                <ScrollView
                  testID="earn-loan-routes-column"
                  w={EARN_OFFER_ROUTES_COLUMN_WIDTH}
                  flexShrink={0}
                >
                  <YStack pt="$2" pb="$5" pr="$5">
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
