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
  Button,
  ESwitchSize,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { getBorrowMarketLabel } from '@onekeyhq/kit/src/views/Borrow/borrowMarketDisplayName';
import { BorrowNavigation } from '@onekeyhq/kit/src/views/Borrow/borrowUtils';
import { CollateralBadge } from '@onekeyhq/kit/src/views/Borrow/components/BorrowTableList/CollateralBadge';
import { CollateralSwitch } from '@onekeyhq/kit/src/views/Borrow/components/CollateralSwitchCell';
import { useBorrowEModeStatus } from '@onekeyhq/kit/src/views/Borrow/hooks/useBorrowEModeStatus';
import { EManagePositionType } from '@onekeyhq/kit/src/views/Staking/pages/ManagePosition/hooks/useManagePage';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IBorrowEModeStatus } from '@onekeyhq/shared/types/staking';

import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';

import { EarnPositionHealthFactorRow } from './EarnPositionHealthFactorRow';
import {
  lendingCollateralOf,
  lendingEModeLabelOf,
} from './mobile/myPortfolio.utils';

import type {
  IEarnLendingMarketRef,
  IEarnLendingReserveRef,
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
};

const LendingCardContext = createContext<ILendingCard | undefined>(undefined);

/**
 * One lending card's market: its E-Mode read once for the card's E-Mode line
 * and its collateral switches (Aave enables collateral within the account's
 * E-Mode), read again after a Borrow transaction settles
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
  const settledCount = actions?.settledCount ?? 0;
  const seenSettledCountRef = useRef(settledCount);
  useEffect(() => {
    if (seenSettledCountRef.current === settledCount) {
      return;
    }
    seenSettledCountRef.current = settledCount;
    void refreshEModeStatus();
  }, [refreshEModeStatus, settledCount]);
  const visibleEModeStatus = isError ? null : eModeStatus;
  const value = useMemo(
    () => ({ market, eModeStatus: visibleEModeStatus }),
    [market, visibleEModeStatus],
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

/**
 * A lending card's Health Factor line with the market's E-Mode: on the same
 * line in the wide layout, under it on the phone. The E-Mode alone where the
 * card has no loan, so no Health Factor
 */
export function LendingHealthLine({
  meta,
  stacked = false,
}: {
  meta?: IEarnPositionMeta;
  /** the phone: E-Mode on a line of its own under the Health Factor */
  stacked?: boolean;
}) {
  const card = useContext(LendingCardContext);
  // As LendingEModeTrigger shows: only a market with categories
  const hasEMode = Boolean(card?.eModeStatus?.categories?.length);
  const healthFactor =
    meta?.kind === 'healthFactor' ? (
      <EarnPositionHealthFactorRow meta={meta} />
    ) : null;
  if (!hasEMode) {
    return healthFactor;
  }
  return stacked ? (
    <YStack gap="$2">
      {healthFactor}
      <LendingEModeTrigger />
    </YStack>
  ) : (
    <XStack ai="center" columnGap="$6" rowGap="$2" flexWrap="wrap">
      {healthFactor}
      <LendingEModeTrigger />
    </XStack>
  );
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
