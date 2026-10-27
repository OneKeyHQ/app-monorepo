import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type {
  ETabEarnRoutes,
  ITabEarnParamList,
} from '@onekeyhq/shared/src/routes';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { StakeProgress } from '../../../Staking/components/StakeProgress';
import { StakingAmountInput } from '../../../Staking/components/StakingAmountInput';
import {
  EarnFormRow,
  EarnFormSummary,
} from '../../../Staking/components/UniversalStake/EarnFormSummary';
import { EARN_DESKTOP_LOAN_LTV } from '../../components/desktopHome/earnDesktopHome.utils';
import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';
import { useEarnDesktopMarkets } from '../../components/desktopHome/useEarnDesktopHomeData';
import { EarnPageContainer } from '../../components/EarnPageContainer';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { EarnNavigation } from '../../earnUtils';
import {
  EarnDoneHeader,
  formatDoneAmount,
} from '../EarnRouter/EarnDepositDone';

import {
  buildLoanRoutes,
  getLoanBorrowOptions,
  getLoanCollateralOptions,
  getLoanForLtv,
  getLoanRouteMetrics,
  pickLoanBorrowSymbol,
  rankLoanRoutes,
} from './loanRouter.utils';
import {
  LoanPairTitle,
  LoanRouteList,
  LoanTokenList,
  formatLoanFiat,
  formatLoanLtv,
  formatLoanPercent,
  getLoanBlockText,
} from './LoanRouterParts';
import { useLoanRouterFacts } from './useLoanRouterFacts';
import { useLoanRouterRun } from './useLoanRouterRun';

import type { ILoanRouteItem } from './LoanRouterParts';
import type { ILoanRunDone, ILoanRunPlan } from './useLoanRouterRun';

// A collateral and a loan, and every market that takes the pair, as
// LlamaSwap's Borrow tab lays them out: the amounts on the left, the markets
// on the right, each worked out for the amounts. Unlike there, a market is
// picked in place and the loan is taken right here: one press supplies the
// collateral, then borrows

type IRouteParams = ITabEarnParamList[ETabEarnRoutes.EarnLoanRouter];

// The form's column beside the markets
const FORM_WIDTH = 440;

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

// A health factor's color, as the Borrow pages read one
const healthColor = (value?: number) => {
  if (value === undefined) {
    return undefined;
  }
  if (value >= 2) {
    return '$textSuccess' as const;
  }
  if (value >= 1.25) {
    return '$textCaution' as const;
  }
  return '$textCritical' as const;
};

const formatHealth = (value: number) =>
  value >= 100 ? '>100' : new BigNumber(value).toFixed(2);

function RowValue({
  children,
  color,
}: {
  children: string;
  color?: '$textSuccess' | '$textCaution' | '$textCritical' | '$textSubdued';
}) {
  return (
    <SizableText size="$bodyMdMedium" color={color} textAlign="right">
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
  if (after === undefined) {
    return <RowValue>–</RowValue>;
  }
  return (
    <XStack ai="center" gap="$1.5">
      {before !== undefined ? (
        <>
          <SizableText size="$bodySm" color={healthColor(before)}>
            {formatHealth(before)}
          </SizableText>
          <Icon name="ArrowRightOutline" size="$4" color="$iconDisabled" />
        </>
      ) : null}
      <RowValue color={healthColor(after)}>{formatHealth(after)}</RowValue>
    </XStack>
  );
}

// The position's LTV, before and after once amounts are typed
function LtvValue({
  before,
  after,
  isChanging,
}: {
  before?: number;
  after?: number;
  isChanging: boolean;
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
      <RowValue>{formatLoanLtv(shown)}</RowValue>
    </XStack>
  );
}

function EarnLoanRouterPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route = useAppRoute<ITabEarnParamList, ETabEarnRoutes.EarnLoanRouter>();
  const {
    collateral: routeCollateral,
    borrow: routeBorrow,
    routeKey,
  } = route.params as IRouteParams;
  const { gtLg } = useMedia();
  const currencyInfo = useCurrency();
  const currency = currencyInfo.symbol;

  const [collateralSymbol, setCollateralSymbol] = useState(routeCollateral);
  const [borrowSymbol, setBorrowSymbol] = useState(routeBorrow);
  const [collateralAmount, setCollateralAmount] = useState('');
  // The loan typed by hand; otherwise it follows the chosen LTV
  const [typedBorrow, setTypedBorrow] = useState<string>();
  const [ltvStage, setLtvStage] = useState<number | undefined>(
    EARN_DESKTOP_LOAN_LTV,
  );
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
  const { byRoute, refresh } = useLoanRouterFacts({ routes });

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
  const borrowAmount =
    typedBorrow ??
    getLoanForLtv({
      collateralAmount,
      ltv: ltvStage ?? EARN_DESKTOP_LOAN_LTV,
      collateralPrice: priceRoute?.collateralPrice,
      borrowPrice: priceRoute?.borrowPrice,
      decimals: borrowDecimals,
    });

  const items = useMemo<ILoanRouteItem[]>(
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
              ltvStage: typedBorrow === undefined ? ltvStage : undefined,
            }),
          };
        }),
      ),
    [borrowAmount, byRoute, collateralAmount, ltvStage, routes, typedBorrow],
  );
  const selected =
    items.find((item) => item.route.key === pickedKey) ??
    items.find((item) => !item.metrics.block) ??
    items[0];
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
    setLtvStage(undefined);
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
  const handleBorrowChange = useCallback((value: string) => {
    setTypedBorrow(value);
    setLtvStage(undefined);
  }, []);
  const handleLtvStage = useCallback((percent: number) => {
    setTypedBorrow(undefined);
    setLtvStage(percent / 100);
  }, []);

  const handleCollateralPick = useCallback(
    (symbol: string) => {
      setCollateralSymbol(symbol);
      setCollateralAmount('');
      setSuppliedNote(undefined);
      setPickedKey(undefined);
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
    [borrowSymbol, markets, stableSymbols],
  );
  const handleBorrowPick = useCallback((symbol: string) => {
    setBorrowSymbol(symbol);
    setPickedKey(undefined);
  }, []);

  const collateralPopover = useMemo(
    () => ({
      title: intl.formatMessage({ id: ETranslations.defi_collateral }),
      content: function CollateralList({
        closePopover,
      }: {
        isOpen?: boolean;
        closePopover: () => void;
      }) {
        return (
          <LoanTokenList
            testID="earn-loan-collateral-list"
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
        closePopover,
      }: {
        isOpen?: boolean;
        closePopover: () => void;
      }) {
        return (
          <LoanTokenList
            testID="earn-loan-borrow-list"
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
      stagesLabel={EARN_DESKTOP_DEMO_COPY.loanLtv}
      disabled={isLocked}
      value={borrowAmount}
      onChange={handleBorrowChange}
      onSelectPercentageStage={handleLtvStage}
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
      inputProps={{ testID: 'earn-loan-borrow-input', placeholder: '0' }}
    />
  );

  // ---------- What the picked market makes of it ----------

  const summary = selectedRoute ? (
    <EarnFormSummary
      outcome={{
        label: intl.formatMessage({ id: ETranslations.defi_net_apy }),
        isEarning: (selectedMetrics?.netApy ?? 0) > 0,
        values:
          selectedMetrics?.netApy === undefined
            ? []
            : [
                {
                  main: formatLoanPercent(selectedMetrics.netApy),
                  suffix:
                    hasCollateral && selectedMetrics.annualNet !== undefined
                      ? `≈ ${formatLoanFiat(
                          selectedMetrics.annualNet,
                          currency,
                        )} ${EARN_DESKTOP_DEMO_COPY.aYear}`
                      : undefined,
                },
              ],
      }}
      rows={[
        <EarnFormRow
          key="health"
          testID="earn-loan-health"
          label={intl.formatMessage({ id: ETranslations.defi_health_factor })}
          value={
            <HealthFactorValue
              before={selectedMetrics?.healthFactorBefore}
              after={
                hasLoan || hasCollateral
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
        />,
        <EarnFormRow
          key="liquidation"
          testID="earn-loan-liquidation"
          label={EARN_DESKTOP_DEMO_COPY.loanLiquidationPrice}
          value={
            <RowValue>
              {selectedMetrics?.liquidationPrice !== undefined &&
              (hasLoan || hasCollateral)
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
            (hasLoan || hasCollateral) ? (
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
        />,
        <EarnFormRow
          key="ltv"
          testID="earn-loan-ltv"
          label={EARN_DESKTOP_DEMO_COPY.loanLtv}
          value={
            <LtvValue
              before={selectedMetrics?.ltvBefore}
              after={selectedMetrics?.ltv}
              isChanging={hasLoan || hasCollateral}
            />
          }
          note={
            selectedMetrics?.maxLtv !== undefined ? (
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage(
                  { id: ETranslations.defi_emode_max_ltv },
                  {
                    ltv: new BigNumber(selectedMetrics.maxLtv * 100)
                      .decimalPlaces(2, BigNumber.ROUND_DOWN)
                      .toFixed(),
                  },
                )}
              </SizableText>
            ) : undefined
          }
        />,
      ]}
    />
  ) : null;

  // ---------- The press ----------

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

  const actionArea = (
    <YStack gap="$3">
      {showsProgress ? (
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
      ) : null}
      {run.phase === 'landing' ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          {EARN_DESKTOP_DEMO_COPY.loanLanding}
        </SizableText>
      ) : null}
      {suppliedNote && !isLocked ? (
        <SizableText
          testID="earn-loan-supplied-note"
          size="$bodyMd"
          color="$textSubdued"
        >
          {suppliedNote}
        </SizableText>
      ) : null}
      {blockText && !isLocked ? (
        <SizableText
          testID="earn-loan-block"
          size="$bodyMd"
          color="$textCaution"
        >
          {blockText}
        </SizableText>
      ) : null}
      <Button
        testID="earn-loan-submit"
        size="large"
        variant="primary"
        disabled={!canStart && !run.isRunning}
        loading={run.isRunning}
        onPress={handlePress}
      >
        {buttonText}
      </Button>
    </YStack>
  );

  // ---------- Done ----------

  const handleFinish = useCallback(() => {
    setDone(undefined);
    setCollateralAmount('');
    setTypedBorrow(undefined);
    setLtvStage(EARN_DESKTOP_LOAN_LTV);
    resetRun();
    void refresh();
  }, [refresh, resetRun]);
  const handleOpenPortfolio = useCallback(() => {
    void EarnNavigation.popToEarnHome(navigation, { tab: 'portfolio' });
  }, [navigation]);
  const doneView = done ? (
    <YStack testID="earn-loan-done" gap="$8" py="$6">
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
      <XStack gap="$3">
        <Button
          testID="earn-loan-done-portfolio"
          flex={1}
          size="large"
          variant="secondary"
          onPress={handleOpenPortfolio}
        >
          {intl.formatMessage({ id: ETranslations.earn_my_portfolio__title })}
        </Button>
        <Button
          testID="earn-loan-done-finish"
          flex={1}
          size="large"
          variant="primary"
          onPress={handleFinish}
        >
          {intl.formatMessage({ id: ETranslations.global_done })}
        </Button>
      </XStack>
    </YStack>
  ) : null;

  // ---------- The page ----------

  const breadcrumbProps = useMemo(
    () => ({
      items: [
        {
          label: intl.formatMessage({ id: ETranslations.global_earn }),
          onClick: () => {
            void EarnNavigation.popToEarnHome(navigation);
          },
        },
        {
          label: intl.formatMessage({ id: ETranslations.earn_loans }),
          onClick: () => {
            void EarnNavigation.popToEarnHome(navigation);
          },
        },
        { label: `${collateralSymbol} / ${borrowSymbol}` },
      ],
    }),
    [borrowSymbol, collateralSymbol, intl, navigation],
  );
  const pageTitle = (
    <LoanPairTitle
      collateral={{ symbol: collateralSymbol, logoURI: collateralLogo }}
      borrow={{ symbol: borrowSymbol, logoURI: borrowLogo }}
    />
  );

  const routeList = (
    <LoanRouteList
      items={items}
      selectedKey={selectedRoute?.key}
      isWide={gtLg}
      isLoading={!isMarketsLoaded}
      currency={currency}
      emptyText={EARN_DESKTOP_DEMO_COPY.loanNoMarket(
        collateralSymbol,
        borrowSymbol,
      )}
      onSelect={isLocked ? () => undefined : setPickedKey}
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
      </YStack>
      {gtLg ? null : routeList}
      {summary}
      {actionArea}
    </YStack>
  );

  return (
    <EarnPageContainer
      pageTitle={pageTitle}
      breadcrumbProps={breadcrumbProps}
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      showBackButton
    >
      <XStack
        testID="earn-loan-router"
        gap="$8"
        ai="flex-start"
        flexDirection={gtLg ? 'row' : 'column'}
        pt="$2"
        pb="$10"
      >
        <YStack w={gtLg ? FORM_WIDTH : '100%'} flexShrink={0}>
          {form}
        </YStack>
        {gtLg ? (
          <YStack flex={1} minWidth={0}>
            {routeList}
          </YStack>
        ) : null}
      </XStack>
    </EarnPageContainer>
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
