import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  ESwitchSize,
  Icon,
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { getBorrowMarketLabel } from '@onekeyhq/kit/src/views/Borrow/borrowMarketDisplayName';
import { BorrowNavigation } from '@onekeyhq/kit/src/views/Borrow/borrowUtils';
import { BorrowAlerts } from '@onekeyhq/kit/src/views/Borrow/components/BorrowAlerts';
import { BorrowBonusTooltip } from '@onekeyhq/kit/src/views/Borrow/components/BorrowBonusTooltip';
import { withNetApySignColor } from '@onekeyhq/kit/src/views/Borrow/components/borrowOverview.utils';
import { CollateralBadge } from '@onekeyhq/kit/src/views/Borrow/components/BorrowTableList/CollateralBadge';
import { CollateralSwitch } from '@onekeyhq/kit/src/views/Borrow/components/CollateralSwitchCell';
import { useBorrowEModeStatus } from '@onekeyhq/kit/src/views/Borrow/hooks/useBorrowEModeStatus';
import { useBorrowRewards } from '@onekeyhq/kit/src/views/Borrow/hooks/useBorrowRewards';
import { useBorrowRewardsClaimDialog } from '@onekeyhq/kit/src/views/Borrow/hooks/useBorrowRewardsClaimDialog';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { EManagePositionType } from '@onekeyhq/kit/src/views/Staking/pages/ManagePosition/hooks/useManagePage';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IBorrowEModeStatus,
  IBorrowRewards,
} from '@onekeyhq/shared/types/staking';

import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';

import { EarnPositionHealthFactorRow } from './EarnPositionHealthFactorRow';
import {
  lendingPendingTxsOf,
  lendingRewardsRowOf,
} from './mobile/earnLendingPositions';
import {
  lendingCollateralOf,
  lendingEModeLabelOf,
} from './mobile/myPortfolio.utils';

import type {
  IEarnLendingMarketRef,
  IEarnLendingReserveRef,
  IEarnLendingRewardsRow,
} from './mobile/earnLendingPositions';
import type {
  IEarnPositionMeta,
  IEarnPositionSectionAsset,
} from './mobile/earnPositionModel';
import type { IStakePendingTx } from '../../hooks/useStakingPendingTxs';

/**
 * What My portfolio gives its lending cards' controls (demo 11-03): the
 * account's in-flight Borrow transactions, which lock a collateral switch
 * while its change is out, and the way to read the account's markets again
 */
export type IPortfolioLendingActions = {
  pendingTxs: IStakePendingTx[];
  /** reads the account's markets again, as the market page's refresh does */
  refresh: () => Promise<void>;
  /** counts the Borrow transactions that settled: the cards read their E-Mode again */
  settledCount: number;
  /** a row's window or the E-Mode window opened over the page */
  onOpenWindow: () => void;
};

const PortfolioLendingActionsContext = createContext<
  IPortfolioLendingActions | undefined
>(undefined);

export const PortfolioLendingActionsProvider =
  PortfolioLendingActionsContext.Provider;

const NO_PENDING_TXS: IStakePendingTx[] = [];
const refreshNothing = async () => {};

function usePortfolioLendingActions() {
  return useContext(PortfolioLendingActionsContext);
}

type ILendingCard = {
  market: IEarnLendingMarketRef;
  /** the account's E-Mode in the market, as the market page reads it */
  eModeStatus: IBorrowEModeStatus | null;
  /** what the account can claim in the market, as the market page read it */
  borrowRewards: IBorrowRewards | null;
  refreshRewards: () => void;
};

const LendingCardContext = createContext<ILendingCard | undefined>(undefined);

/**
 * One lending card's market: its E-Mode read once for the card's E-Mode line
 * and its collateral switches (Aave enables collateral within the account's
 * E-Mode), and its rewards for the card's Rewards row, both read again
 * after a Borrow transaction settles
 */
export function LendingCardScope({
  market,
  children,
}: {
  market: IEarnLendingMarketRef;
  children: React.ReactNode;
}) {
  const actions = usePortfolioLendingActions();
  const {
    eModeStatus,
    isError,
    refresh: refreshEModeStatus,
  } = useBorrowEModeStatus({
    networkId: market.market.networkId,
    provider: market.market.provider,
    marketAddress: market.market.marketAddress,
    accountId: market.accountId,
  });
  const {
    borrowRewards,
    isError: isRewardsError,
    refresh: runRewardsRefresh,
  } = useBorrowRewards({
    networkId: market.market.networkId,
    provider: market.market.provider,
    marketAddress: market.market.marketAddress,
    accountId: market.accountId,
  });
  const refreshRewards = useCallback(() => {
    void runRewardsRefresh();
  }, [runRewardsRefresh]);
  const settledCount = actions?.settledCount ?? 0;
  const seenSettledCountRef = useRef(settledCount);
  useEffect(() => {
    if (seenSettledCountRef.current === settledCount) {
      return;
    }
    seenSettledCountRef.current = settledCount;
    void refreshEModeStatus();
    refreshRewards();
  }, [refreshEModeStatus, refreshRewards, settledCount]);
  const visibleEModeStatus = isError ? null : eModeStatus;
  const visibleRewards = isRewardsError ? null : borrowRewards;
  const value = useMemo(
    () => ({
      market,
      eModeStatus: visibleEModeStatus,
      borrowRewards: visibleRewards,
      refreshRewards,
    }),
    [market, refreshRewards, visibleEModeStatus, visibleRewards],
  );
  return (
    <LendingCardContext.Provider value={value}>
      {children}
    </LendingCardContext.Provider>
  );
}

/**
 * "E-Mode Off ›" or the category on, opening the market's E-Mode window, as
 * the market page's E-Mode bar does. Nothing where the market has no
 * categories (Kamino has none)
 */
function LendingEModeTrigger() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const card = useContext(LendingCardContext);
  const actions = usePortfolioLendingActions();
  const [isHovered, setIsHovered] = useState(false);
  const valueText = lendingEModeLabelOf(
    card?.eModeStatus,
    intl.formatMessage({ id: ETranslations.defi_emode_off }),
  );
  const open = useCallback(() => {
    if (!card) {
      return;
    }
    const { market, accountId, indexedAccountId } = card.market;
    actions?.onOpenWindow();
    BorrowNavigation.pushToBorrowEModeSwitch(navigation, {
      accountId,
      indexedAccountId,
      networkId: market.networkId,
      provider: market.provider,
      marketAddress: market.marketAddress,
    });
  }, [actions, card, navigation]);
  if (!valueText) {
    return null;
  }
  const title = intl.formatMessage({ id: ETranslations.defi_emode_title });
  return (
    <XStack
      testID="earn-portfolio-lending-emode"
      role="button"
      aria-label={`${title} ${valueText}`}
      ai="center"
      gap="$1"
      alignSelf="flex-start"
      cursor="pointer"
      userSelect="none"
      pressStyle={{ opacity: 0.6 }}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      onPress={open}
      {...buildKeyboardPressProps(open, 2)}
    >
      <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
        {title}
      </SizableText>
      <SizableText size="$bodyMdMedium" numberOfLines={1}>
        {valueText}
      </SizableText>
      <Icon
        name="ChevronRightSmallOutline"
        size="$5"
        color={isHovered ? '$icon' : '$iconSubdued'}
      />
    </XStack>
  );
}

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];

/**
 * The position's Net APY, the market page's figure: green where the
 * position earns more than its loans cost, red where it pays
 */
function LendingNetApy() {
  const intl = useIntl();
  const card = useContext(LendingCardContext);
  const netApyText = card?.market.summary?.netApyText;
  if (!netApyText) {
    return null;
  }
  return (
    <XStack testID="earn-portfolio-lending-net-apy" ai="center" gap="$2">
      <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
        {intl.formatMessage({ id: ETranslations.defi_net_apy })}
      </SizableText>
      <EarnText
        size="$bodyMdMedium"
        color="$text"
        fontVariant={TABULAR_NUMS}
        numberOfLines={1}
        text={withNetApySignColor({ text: netApyText })}
      />
    </XStack>
  );
}

/**
 * OneKey's bonus on the market while it runs one: what the account has
 * received, and the market page's own explanation behind the info button
 */
function LendingPlatformBonus() {
  const intl = useIntl();
  const card = useContext(LendingCardContext);
  const platformBonus = card?.market.summary?.platformBonus;
  if (!card || !platformBonus) {
    return null;
  }
  const { market, accountId } = card.market;
  return (
    <XStack testID="earn-portfolio-lending-bonus" ai="center" gap="$2">
      <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
        {platformBonus.data?.title?.text ||
          intl.formatMessage({ id: ETranslations.defi_platform_bonus })}
      </SizableText>
      <EarnText
        size="$bodyMdMedium"
        color="$text"
        fontVariant={TABULAR_NUMS}
        numberOfLines={1}
        text={platformBonus.totalReceived.description}
      />
      {/* The button's own padding sits outside the line's height */}
      <Stack my="$-1" ml="$-1">
        <BorrowBonusTooltip
          data={platformBonus}
          accountId={accountId}
          networkId={market.networkId}
          provider={market.provider}
          marketAddress={market.marketAddress}
        />
      </Stack>
    </XStack>
  );
}

/**
 * A lending card's figures line, what the market page showed over its
 * tables (demo 11-10): the Health Factor of a loan, the position's Net APY,
 * the market's E-Mode and OneKey's bonus. One line in the wide layout,
 * wrapping when it must; on the phone the Health Factor and the Net APY
 * share a line and the rest go under it
 */
export function LendingHealthLine({
  meta,
  stacked = false,
}: {
  meta?: IEarnPositionMeta;
  /** the phone: E-Mode and the bonus on lines of their own */
  stacked?: boolean;
}) {
  const card = useContext(LendingCardContext);
  // As LendingEModeTrigger shows: only a market with categories
  const hasEMode = Boolean(card?.eModeStatus?.categories?.length);
  const hasNetApy = Boolean(card?.market.summary?.netApyText);
  const hasBonus = Boolean(card?.market.summary?.platformBonus);
  const healthFactor =
    meta?.kind === 'healthFactor' ? (
      <EarnPositionHealthFactorRow meta={meta} />
    ) : null;
  if (!healthFactor && !hasNetApy && !hasEMode && !hasBonus) {
    return null;
  }
  if (stacked) {
    return (
      <YStack gap="$2">
        {healthFactor || hasNetApy ? (
          <XStack ai="center" columnGap="$6" rowGap="$2" flexWrap="wrap">
            {healthFactor}
            <LendingNetApy />
          </XStack>
        ) : null}
        {hasEMode ? <LendingEModeTrigger /> : null}
        <LendingPlatformBonus />
      </YStack>
    );
  }
  return (
    <XStack ai="center" columnGap="$6" rowGap="$2" flexWrap="wrap">
      {healthFactor}
      <LendingNetApy />
      {hasEMode ? <LendingEModeTrigger /> : null}
      <LendingPlatformBonus />
    </XStack>
  );
}

/**
 * The market's warnings and its health factor's, the market page's own
 * boxes with their Receive and Swap buttons, under the card's figures
 */
export function LendingAlerts() {
  const card = useContext(LendingCardContext);
  const { activeAccount } = useActiveAccount({ num: 0 });
  const alerts = card?.market.summary?.alerts;
  if (!card || !alerts?.length) {
    return null;
  }
  return (
    // Clear of the figures above and the table under it
    <Stack testID="earn-portfolio-lending-alerts" py="$1">
      <BorrowAlerts
        alerts={alerts}
        accountId={activeAccount.account?.id || undefined}
        walletId={activeAccount.wallet?.id}
        indexedAccountId={
          card.market.indexedAccountId ?? activeAccount.indexedAccount?.id
        }
        marketNetworkId={card.market.market.networkId}
      />
    </Stack>
  );
}

function useOpenLendingHistory(market: IEarnLendingMarketRef) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const label = intl.formatMessage({ id: ETranslations.global_history });
  const open = useCallback(() => {
    BorrowNavigation.pushToBorrowHistory(navigation, {
      accountId: market.accountId,
      networkId: market.market.networkId,
      provider: market.market.provider,
      marketAddress: market.market.marketAddress,
      title: label,
    });
  }, [label, market, navigation]);
  return { open, label };
}

/**
 * The market's transactions, the market page's History, where the other
 * cards have the way to their detail page: the same place and size, so the
 * card's value still ends over its table's. Its room stays where the
 * market has nothing to list
 */
export function LendingHistoryButton({
  market,
}: {
  market: IEarnLendingMarketRef;
}) {
  const { open, label } = useOpenLendingHistory(market);
  if (!market.summary?.hasHistory) {
    return <Stack w="$5" />;
  }
  return (
    // The chevron's 20 pt of room; the button's own padding reaches past it
    // on every side without moving the icon
    <Stack w="$5" h="$5" ai="center" jc="center">
      <IconButton
        testID="earn-portfolio-lending-history"
        icon="ClockTimeHistoryOutline"
        iconSize="$4"
        variant="tertiary"
        size="small"
        p="$1.5"
        m={-5}
        title={label}
        aria-label={label}
        onPress={open}
      />
    </Stack>
  );
}

/**
 * The market's transactions still out, beside its name, as the market page
 * counted them where its History was: the rows' own blue badge, opening the
 * market's transactions
 */
export function LendingPendingBadge({
  market,
}: {
  market: IEarnLendingMarketRef;
}) {
  const intl = useIntl();
  const actions = usePortfolioLendingActions();
  const { open } = useOpenLendingHistory(market);
  const count = useMemo(
    () =>
      lendingPendingTxsOf({
        pendingTxs: actions?.pendingTxs ?? NO_PENDING_TXS,
        market,
      }).length,
    [actions?.pendingTxs, market],
  );
  if (!count) {
    return null;
  }
  const pending = intl.formatMessage({ id: ETranslations.global_pending });
  const label = count > 1 ? `${count} ${pending}` : pending;
  return (
    // The badge is 20 pt tall; padding the negative margins take back
    // makes its tap area 44 pt without moving it
    <Stack
      testID="earn-portfolio-lending-pending"
      role="button"
      aria-label={label}
      flexShrink={0}
      py="$3"
      my="$-3"
      px="$2"
      mx="$-2"
      cursor="pointer"
      onPress={open}
      {...buildKeyboardPressProps(open, 2)}
    >
      <Badge badgeType="info" badgeSize="sm">
        <Badge.Text>{label}</Badge.Text>
      </Badge>
    </Stack>
  );
}

/**
 * A lending card's Rewards row: what the account can claim in the market
 * as one line, its Claim opening the market's rewards window (each reward
 * with its own Claim, and one for all). Undefined while there is nothing
 * to claim. Every claim out: the row shows Pending instead of its button
 */
export function useLendingCardRewards():
  | {
      row: IEarnLendingRewardsRow;
      isPending: boolean;
      open: () => void;
    }
  | undefined {
  const card = useContext(LendingCardContext);
  const actions = usePortfolioLendingActions();
  const refreshMarkets = actions?.refresh;
  const refreshRewards = card?.refreshRewards;
  const handleClaimed = useCallback(async () => {
    refreshRewards?.();
    await refreshMarkets?.();
  }, [refreshMarkets, refreshRewards]);
  const { openRewardsDialog, pendingClaimIds } = useBorrowRewardsClaimDialog({
    market: card?.market.market,
    accountId: card?.market.accountId,
    borrowRewards: card?.borrowRewards,
    pendingTxs: actions?.pendingTxs ?? NO_PENDING_TXS,
    onClaimed: handleClaimed,
  });
  const row = useMemo(
    () => lendingRewardsRowOf(card?.borrowRewards),
    [card?.borrowRewards],
  );
  return useMemo(() => {
    if (!row) {
      return undefined;
    }
    const pendingIds = new Set(pendingClaimIds);
    return {
      row,
      isPending:
        row.claimIds.length > 0 &&
        row.claimIds.every((id) => pendingIds.has(id)),
      open: () => {
        actions?.onOpenWindow();
        openRewardsDialog();
      },
    };
  }, [actions, openRewardsDialog, pendingClaimIds, row]);
}

/**
 * A lending row's Withdraw (a supply) or Repay (a loan): the market page's
 * own window, showing that side alone, as the lending details page opens
 * its Withdraw. Off where the market page has it off
 */
export function LendingRowButton({
  lending,
  disabled,
  hitSlop,
}: {
  lending: IEarnLendingReserveRef;
  disabled: boolean;
  hitSlop?: { top: number; bottom: number; left: number; right: number };
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const actions = usePortfolioLendingActions();
  const isRepay = lending.side === 'borrowed';
  const label = intl.formatMessage({
    id: isRepay ? ETranslations.defi_repay : ETranslations.global_withdraw,
  });
  const { token, reserveAddress } = lending.reserve;
  const handlePress = useCallback(() => {
    const { market, accountId, indexedAccountId } = lending.market;
    actions?.onOpenWindow();
    BorrowNavigation.pushToBorrowManagePosition(navigation, {
      accountId,
      indexedAccountId,
      networkId: market.networkId,
      provider: market.provider,
      marketAddress: market.marketAddress,
      reserveAddress,
      symbol: token.symbol,
      logoURI: token.logoURI,
      providerDisplayName: getBorrowMarketLabel(market),
      providerLogoURI: market.logoURI,
      type: isRepay ? EManagePositionType.Repay : EManagePositionType.Withdraw,
      // The window's second side alone: Withdraw, or Repay on a loan
      withdrawOnly: true,
    });
  }, [
    actions,
    isRepay,
    lending.market,
    navigation,
    reserveAddress,
    token.logoURI,
    token.symbol,
  ]);
  return (
    <Button
      testID={`earn-portfolio-lending-${isRepay ? 'repay' : 'withdraw'}-${
        token.symbol
      }`}
      size="small"
      variant="secondary"
      hitSlop={hitSlop}
      aria-label={`${label} ${token.symbol}`}
      disabled={disabled}
      onPress={handlePress}
    >
      {label}
    </Button>
  );
}

/**
 * "Collateral" and the market page's own switch, hung under a supplied row
 * the market says counts as collateral or not (Aave): the same preview,
 * confirm dialog with the health factor before and after, transaction and
 * settlement as there. Where the market never takes the asset as collateral,
 * the market page's mark instead of a switch that can't move
 */
export function LendingCollateralLine({
  asset,
  pl,
}: {
  asset: IEarnPositionSectionAsset;
  /** where the row's text starts, past its token */
  pl?: IXStackProps['pl'];
}) {
  const intl = useIntl();
  const card = useContext(LendingCardContext);
  const actions = usePortfolioLendingActions();
  const collateral = lendingCollateralOf(asset);
  if (!collateral) {
    return null;
  }
  const label = intl.formatMessage({ id: ETranslations.defi_collateral });
  const { reserve, market } = collateral;
  return (
    <XStack
      testID={`earn-portfolio-lending-collateral-${reserve.token.symbol}`}
      ai="center"
      gap="$2"
      minHeight={24}
      pl={pl}
    >
      <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
        {label}
      </SizableText>
      {collateral.state === 'unavailable' ? (
        <Stack
          {...(platformEnv.isRuntimeBrowser
            ? {
                role: 'img' as const,
                'aria-label': [
                  reserve.token.symbol,
                  label,
                  intl.formatMessage({
                    id: ETranslations.global_not_available,
                  }),
                ].join(', '),
              }
            : {})}
        >
          <CollateralBadge canBeCollateral={false} unavailableBg="$bgStrong" />
        </Stack>
      ) : (
        <CollateralSwitch
          market={market.market}
          accountId={market.accountId}
          item={reserve}
          eModeId={card?.eModeStatus?.eModeId}
          pendingTxs={actions?.pendingTxs ?? NO_PENDING_TXS}
          refreshAllBorrowData={actions?.refresh ?? refreshNothing}
          size={ESwitchSize.extraSmall}
        />
      )}
    </XStack>
  );
}
