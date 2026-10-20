import type { ReactNode } from 'react';
import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Dialog,
  Icon,
  IconButton,
  Image,
  NATIVE_HIT_SLOP,
  Popover,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useClipboard,
  useInTabDialog,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EarnInviteeRewardContent } from '@onekeyhq/kit/src/views/Earn/components/InviteeReward/EarnInviteeRewardContent';
import { InviteeRewardContent as PerpsInviteeRewardContent } from '@onekeyhq/kit/src/views/Perp/components/InviteeReward/InviteeRewardContent';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { SwapInviteeRewardContent } from '@onekeyhq/kit/src/views/Swap/components/InviteeReward/SwapInviteeRewardContent';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInviteeRewardsOverview } from '@onekeyhq/shared/src/referralCode/type';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IEarnSummaryV2, IEarnText } from '@onekeyhq/shared/types/staking';

import { InviteeRewardNoWallet } from '../../components/InviteeRewardNoWallet';
import { ReferralCardEmpty } from '../../components/ReferralCardEmpty';
import { BenefitsTabPlaceholder } from '../InviteReward/components/BenefitsTabPlaceholder';
import { INVITE_REWARD_SUBJECT_ICON } from '../InviteReward/components/getInviteRewardRows';
import { InviteStatCell } from '../InviteReward/components/InviteStatCell';
import { REFERRAL_USD_SOURCE_PROPS } from '../InviteReward/components/shared/getRewardSummary';
import {
  COMPACT_ENTRY_TITLE_PROPS,
  COMPACT_ROW_BLEED_PROPS,
  COMPACT_ROW_ICON_PROPS,
  INVITE_POPOVER_PANEL_PROPS,
  POINTER_ROW_BLEED_PROPS,
  PRESSABLE_SURFACE_PROPS,
  useInviteHomeCardStyle,
} from '../InviteReward/components/useInviteCardStyle';

import {
  PerksCampaignBanner,
  usePerksBannerItems,
} from './PerksCampaignBanner';

type IRewardModule = keyof IInviteeRewardsOverview;

// Hardcoded English until i18n keys are added in Lokalise.
const MY_REWARDS_COPY = {
  addressScope: 'Rewards are counted per address',
  payoutTitle: 'Payout',
  payoutGeneric: 'Rewards are paid to this address',
  payoutIn: (token: string, network?: string) =>
    network
      ? `Paid in ${token} on ${network} to this address`
      : `Paid in ${token} to this address`,
  rebatesReceived: 'Rebates received',
  noEvmAddress: 'No EVM address',
  noWalletTitle: 'Connect a wallet to view rewards',
  unsupportedTitle: 'This account has no EVM address',
  unsupportedDescription: 'Switch to an EVM account to view rewards',
  loadFailed: 'Unable to load',
  moreTokens: (count: number) => `+${count} more`,
};

const MODULE_ICON: Record<IRewardModule, IKeyOfIcons> = {
  perps: INVITE_REWARD_SUBJECT_ICON.perps,
  swap: INVITE_REWARD_SUBJECT_ICON.swap,
  earn: INVITE_REWARD_SUBJECT_ICON.defi,
};

// Same product names as the invite tab's breakdown.
const MODULE_TITLE: Record<IRewardModule, ETranslations> = {
  perps: ETranslations.perps_perps,
  swap: ETranslations.global_swap,
  earn: ETranslations.referral_referred_type_2,
};

const MODULES: IRewardModule[] = ['perps', 'swap', 'earn'];

// Desktop rows bleed 12px past the text, like the invite tab's breakdown, so
// the text lines up with the section title.
const DESKTOP_ROW_BLEED_PROPS = {
  mx: '$-3',
  px: '$3',
  borderRadius: '$3',
} as const;

// A paid or unpaid figure: a token amount, or the server-formatted Earn text.
type IRewardValue =
  | { kind: 'amount'; amount: string }
  | { kind: 'text'; text: IEarnText; extraCount: number };

interface IModuleRow {
  module: IRewardModule;
  status: 'loading' | 'error' | 'ready';
  paid?: IRewardValue;
  unpaid?: IRewardValue;
}

function getEarnTokens(data: IEarnSummaryV2) {
  return [...data.distributed, ...data.undistributed];
}

// True only when every module loaded and none has any reward, so a failed
// module never hides the others behind the empty state.
function hasNoRewards(overview?: IInviteeRewardsOverview) {
  if (!overview) {
    return false;
  }
  const { perps, swap, earn } = overview;
  if (
    perps.status !== 'success' ||
    swap.status !== 'success' ||
    earn.status !== 'success'
  ) {
    return false;
  }
  const isZero = (data: { totalBonus: string; history: unknown[] }) =>
    !new BigNumber(data.totalBonus).gt(0) && !data.history.length;
  return (
    isZero(perps.data) && isZero(swap.data) && !getEarnTokens(earn.data).length
  );
}

// Earn list titles arrive as token amounts, like "0.3976 USDC".
function readUsdAmount(text: string | undefined) {
  const match = text?.trim().match(/^[+-]?\d[\d,]*(?:\.\d+)?/);
  if (!match) {
    return undefined;
  }
  const amount = new BigNumber(match[0].replace(/,/g, ''));
  return amount.isFinite() ? amount : undefined;
}

function getEarnValue(
  items: IEarnSummaryV2['distributed'] | IEarnSummaryV2['undistributed'],
): IRewardValue | undefined {
  if (!items.length) {
    return undefined;
  }
  const amounts = items.map((item) => readUsdAmount(item.title.text));
  if (amounts.every((amount): amount is BigNumber => amount !== undefined)) {
    const total = amounts.reduce(
      (sum, amount) => sum.plus(amount),
      new BigNumber(0),
    );
    return total.gt(0)
      ? { kind: 'amount', amount: total.toFixed() }
      : undefined;
  }
  // A label that is not an amount stays as the server wrote it.
  return { kind: 'text', text: items[0].title, extraCount: items.length - 1 };
}

function getModuleRow(
  module: IRewardModule,
  isLoading: boolean,
  overview?: IInviteeRewardsOverview,
): IModuleRow {
  if (isLoading || !overview) {
    return { module, status: 'loading' };
  }
  if (module === 'earn') {
    const result = overview.earn;
    if (result.status !== 'success') {
      return { module, status: 'error' };
    }
    return {
      module,
      status: 'ready',
      paid: getEarnValue(result.data.distributed),
      unpaid: getEarnValue(result.data.undistributed),
    };
  }
  const result = overview[module];
  if (result.status !== 'success') {
    return { module, status: 'error' };
  }
  const { totalBonus, undistributed } = result.data;
  const unpaid = new BigNumber(undistributed);
  const paid = new BigNumber(totalBonus).minus(unpaid);
  // List figures are USDC amounts shown as USD in the wallet currency.
  // Product detail dialogs still show the token.
  return {
    module,
    status: 'ready',
    paid: paid.gt(0) ? { kind: 'amount', amount: paid.toFixed() } : undefined,
    unpaid: unpaid.gt(0)
      ? { kind: 'amount', amount: unpaid.toFixed() }
      : undefined,
  };
}

type IRewardTotals =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; total: string; paid: string; unpaid: string };

function sumAmount(value: IRewardValue | undefined) {
  return value?.kind === 'amount' ? new BigNumber(value.amount) : undefined;
}

// The summary only adds up what it can: a failed product or an Earn figure
// that is not an amount leaves the total unknown rather than understated.
function getRewardTotals(rows: IModuleRow[]): IRewardTotals {
  if (rows.some((row) => row.status === 'loading')) {
    return { status: 'loading' };
  }
  let paid = new BigNumber(0);
  let unpaid = new BigNumber(0);
  for (const row of rows) {
    if (row.status !== 'ready') {
      return { status: 'unavailable' };
    }
    const rowPaid = row.paid ? sumAmount(row.paid) : new BigNumber(0);
    const rowUnpaid = row.unpaid ? sumAmount(row.unpaid) : new BigNumber(0);
    if (!rowPaid || !rowUnpaid) {
      return { status: 'unavailable' };
    }
    paid = paid.plus(rowPaid);
    unpaid = unpaid.plus(rowUnpaid);
  }
  return {
    status: 'ready',
    total: paid.plus(unpaid).toFixed(),
    paid: paid.toFixed(),
    unpaid: unpaid.toFixed(),
  };
}

interface IPayoutToken {
  symbol: string;
  networkName?: string;
  logoURI?: string;
}

// Perps and Swap pay out in a token the overview names; when both name the
// same token on the same network, the address note can say so. Earn's
// summary carries no token, so it does not take part.
function getPayoutToken(
  overview?: IInviteeRewardsOverview,
): IPayoutToken | undefined {
  if (!overview) {
    return undefined;
  }
  const tokens = [overview.perps, overview.swap].flatMap((result) =>
    result.status === 'success' && result.data.token?.symbol
      ? [result.data.token]
      : [],
  );
  const [first] = tokens;
  if (
    !first ||
    tokens.some(
      (token) =>
        token.symbol !== first.symbol || token.networkId !== first.networkId,
    )
  ) {
    return undefined;
  }
  return {
    symbol: first.symbol,
    networkName: getPresetNetworks().find(
      (network) => network.id === first.networkId,
    )?.name,
    logoURI: first.logoURI || undefined,
  };
}

// Where the rewards land, behind an info icon beside the address: secondary
// to the figures, so it does not take a line of its own.
function PayoutInfo({ payout }: { payout?: IPayoutToken }) {
  const intl = useIntl();
  return (
    <Popover
      title={MY_REWARDS_COPY.payoutTitle}
      hoverable
      placement="bottom-start"
      floatingPanelProps={INVITE_POPOVER_PANEL_PROPS}
      renderTrigger={
        <IconButton
          testID="my-rewards-payout-info"
          icon="InfoCircleOutline"
          variant="tertiary"
          size="small"
          iconProps={{ color: '$iconSubdued' }}
        />
      }
      renderContent={
        <YStack p="$4" gap="$3">
          <XStack ai="center" gap="$2">
            {payout?.logoURI ? (
              <Image
                w="$5"
                h="$5"
                borderRadius="$full"
                flexShrink={0}
                source={{ uri: payout.logoURI }}
              />
            ) : null}
            <SizableText size="$bodyMdMedium" flexShrink={1}>
              {payout
                ? MY_REWARDS_COPY.payoutIn(payout.symbol, payout.networkName)
                : MY_REWARDS_COPY.payoutGeneric}
            </SizableText>
          </XStack>
          <SizableText size="$bodyMd" color="$textSubdued">
            {MY_REWARDS_COPY.addressScope}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.earn_reward_distribution_schedule,
            })}
          </SizableText>
        </YStack>
      }
    />
  );
}

function RewardValue({
  value,
  size,
  color,
}: {
  value: IRewardValue;
  size: '$bodyLgMedium' | '$bodyMdMedium' | '$bodySm';
  color?: '$textSubdued';
}) {
  if (value.kind === 'amount') {
    return (
      <Currency
        size={size}
        color={color}
        formatter="value"
        numberOfLines={1}
        {...REFERRAL_USD_SOURCE_PROPS}
      >
        {value.amount}
      </Currency>
    );
  }
  return (
    <XStack ai="center" gap="$1" minWidth={0}>
      <EarnText
        numberOfLines={1}
        text={{ ...value.text, size, color: color ?? '$text' }}
      />
      {value.extraCount ? (
        <SizableText size="$bodySm" color="$textSubdued" flexShrink={0}>
          {MY_REWARDS_COPY.moreTokens(value.extraCount)}
        </SizableText>
      ) : null}
    </XStack>
  );
}

function SubduedNote({ children }: { children: string }) {
  return (
    <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
      {children}
    </SizableText>
  );
}

// The counted address as one quiet target: a tap anywhere on it copies the
// full address, and the icon is only the cue, like the invite tab's code.
function RewardsAddressValue({
  address,
  unsupported,
  compact,
}: {
  address?: string;
  unsupported: boolean;
  compact: boolean;
}) {
  const { copyText } = useClipboard();
  const copyAddress = useCallback(() => {
    if (address) {
      copyText(address);
    }
  }, [address, copyText]);

  if (unsupported) {
    return <SubduedNote>{MY_REWARDS_COPY.noEvmAddress}</SubduedNote>;
  }
  if (!address) {
    return <Skeleton width={120} height={16} />;
  }
  return (
    <XStack
      testID="my-rewards-copy-address"
      ai="center"
      gap="$1.5"
      flexShrink={0}
      py="$1"
      borderRadius="$2"
      {...POINTER_ROW_BLEED_PROPS}
      {...PRESSABLE_SURFACE_PROPS}
      // The cell is 28px tall; the slop brings its touch area to 44px.
      hitSlop={NATIVE_HIT_SLOP}
      onPress={copyAddress}
    >
      <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
        {accountUtils.shortenAddress({
          address,
          ...(compact ? { leadingLength: 6, trailingLength: 4 } : null),
        })}
      </SizableText>
      <Icon name="Copy3Outline" size="$4" color="$iconSubdued" />
    </XStack>
  );
}

// Whose rewards these are: the account switch and the counted address sit
// together, with where they are paid behind the info icon.
function RewardsAddressCard({
  address,
  unsupported,
  payout,
}: {
  address?: string;
  unsupported: boolean;
  payout?: IPayoutToken;
}) {
  const { md } = useMedia();
  return (
    <YStack testID="my-rewards-address-card">
      <XStack ai="center" gap="$4" minWidth={0}>
        {/* A long account name truncates first, so the address stays whole. */}
        <Stack flexShrink={1} minWidth={0}>
          <AccountSelectorTriggerHome num={0} hideAddress />
        </Stack>
        <XStack ai="center" gap="$1" flexShrink={0}>
          <RewardsAddressValue
            address={address}
            unsupported={unsupported}
            compact={md}
          />
          {unsupported ? null : <PayoutInfo payout={payout} />}
        </XStack>
      </XStack>
    </YStack>
  );
}

function PartDot({ color }: { color: '$iconSuccess' | '$iconCaution' }) {
  return <YStack w="$2" h="$2" borderRadius="$full" bg={color} />;
}

function TotalFigure({
  totals,
  pick,
}: {
  totals: IRewardTotals;
  pick: 'total' | 'paid' | 'unpaid';
}) {
  const size = '$headingLg';
  if (totals.status === 'loading') {
    return <Skeleton.HeadingLg w={88} />;
  }
  if (totals.status === 'unavailable') {
    return (
      <SizableText size={size} color="$textDisabled">
        --
      </SizableText>
    );
  }
  return (
    <Currency {...REFERRAL_USD_SOURCE_PROPS} size={size} numberOfLines={1}>
      {totals[pick]}
    </Currency>
  );
}

// Desktop summary, two thirds of the top row: whose rebates these are, then
// the figures pinned to the bottom so the card lines up with the banner.
// Kept unlike the invite tab's earnings card (no lead figure, no coin art)
// so the two tabs do not read as the same page.
function PerksSummaryCard({
  totals,
  address,
  unsupported,
  payout,
  labels,
}: {
  totals: IRewardTotals;
  address?: string;
  unsupported: boolean;
  payout?: IPayoutToken;
  labels: { total: string; paid: string; unpaid: string };
}) {
  const cardStyle = useInviteHomeCardStyle();
  return (
    <YStack
      testID="my-rewards-summary-card"
      flex={1}
      p="$5"
      gap="$5"
      {...cardStyle}
    >
      <RewardsAddressCard
        address={address}
        unsupported={unsupported}
        payout={payout}
      />
      {/* Equal columns across the card, so the figures fill its width
          instead of bunching at the left. */}
      <XStack mt="auto" gap="$6" ai="flex-start">
        <InviteStatCell share={1} label={labels.total}>
          <TotalFigure totals={totals} pick="total" />
        </InviteStatCell>
        <InviteStatCell
          share={1}
          leading={<PartDot color="$iconSuccess" />}
          label={labels.paid}
        >
          <TotalFigure totals={totals} pick="paid" />
        </InviteStatCell>
        <InviteStatCell
          share={1}
          leading={<PartDot color="$iconCaution" />}
          label={labels.unpaid}
        >
          <TotalFigure totals={totals} pick="unpaid" />
        </InviteStatCell>
      </XStack>
    </YStack>
  );
}

// A product with nothing in one column: a dash keeps the row from looking
// unfinished.
function EmptyCell() {
  return (
    <SizableText size="$bodyLgMedium" color="$textDisabled">
      --
    </SizableText>
  );
}

// One cell of the desktop table; rows and the header share the flex basis,
// so the columns line up.
function DesktopCell({
  children,
  first,
  span = 1,
}: {
  children?: ReactNode;
  first?: boolean;
  span?: number;
}) {
  return (
    <XStack
      flex={first ? 1.4 : span}
      flexBasis={0}
      minWidth={0}
      ai="center"
      gap={first ? '$3' : '$1'}
    >
      {children}
    </XStack>
  );
}

// The product's icon on a round neutral tile, as in the invite breakdown.
function ProductTile({ module }: { module: IRewardModule }) {
  return (
    <Stack
      w="$10"
      h="$10"
      borderRadius="$full"
      bg="$bgStrong"
      ai="center"
      jc="center"
      flexShrink={0}
    >
      <Icon name={MODULE_ICON[module]} size="$5" />
    </Stack>
  );
}

function DesktopRow({
  row,
  title,
  noRewardLabel,
  onPress,
}: {
  row: IModuleRow;
  title: string;
  noRewardLabel: string;
  onPress: () => void;
}) {
  const hasReward = Boolean(row.paid || row.unpaid);
  const renderValues = () => {
    if (row.status === 'loading') {
      return (
        <>
          <DesktopCell>
            <Skeleton width={72} height={16} />
          </DesktopCell>
          <DesktopCell>
            <Skeleton width={72} height={16} />
          </DesktopCell>
        </>
      );
    }
    // A note rather than figures spans both value columns.
    if (row.status === 'error' || !hasReward) {
      return (
        <DesktopCell span={2}>
          <SubduedNote>
            {row.status === 'error'
              ? MY_REWARDS_COPY.loadFailed
              : noRewardLabel}
          </SubduedNote>
        </DesktopCell>
      );
    }
    return (
      <>
        <DesktopCell>
          {row.paid ? (
            <RewardValue value={row.paid} size="$bodyLgMedium" />
          ) : (
            <EmptyCell />
          )}
        </DesktopCell>
        <DesktopCell>
          {row.unpaid ? (
            <RewardValue value={row.unpaid} size="$bodyLgMedium" />
          ) : (
            <EmptyCell />
          )}
        </DesktopCell>
      </>
    );
  };
  return (
    <XStack
      testID={`my-rewards-module-${row.module}`}
      ai="center"
      gap="$4"
      {...DESKTOP_ROW_BLEED_PROPS}
      py="$3"
      {...PRESSABLE_SURFACE_PROPS}
      onPress={onPress}
    >
      <DesktopCell first>
        <ProductTile module={row.module} />
        <SizableText flex={1} size="$bodyLgMedium" numberOfLines={1}>
          {title}
        </SizableText>
      </DesktopCell>
      {renderValues()}
      <Icon
        name={
          row.status === 'error'
            ? 'RefreshCcwOutline'
            : 'ChevronRightSmallOutline'
        }
        size="$5"
        color="$iconSubdued"
      />
    </XStack>
  );
}

function CompactRow({
  row,
  title,
  labels,
  onPress,
}: {
  row: IModuleRow;
  title: string;
  labels: { unpaid: string; noReward: string };
  onPress: () => void;
}) {
  const renderValue = () => {
    if (row.status === 'loading') {
      return <Skeleton width={72} height={16} />;
    }
    if (row.status === 'error') {
      return <SubduedNote>{MY_REWARDS_COPY.loadFailed}</SubduedNote>;
    }
    if (!row.paid && !row.unpaid) {
      return <SubduedNote>{labels.noReward}</SubduedNote>;
    }
    return (
      <YStack ai="flex-end" gap="$0.5">
        {row.paid ? (
          <RewardValue value={row.paid} size="$bodyMdMedium" />
        ) : null}
        {row.unpaid ? (
          <XStack ai="center" gap="$1">
            <SizableText size="$bodySm" color="$textSubdued">
              {labels.unpaid}
            </SizableText>
            <RewardValue
              value={row.unpaid}
              size="$bodySm"
              color="$textSubdued"
            />
          </XStack>
        ) : null}
      </YStack>
    );
  };
  return (
    <ListItem
      testID={`my-rewards-module-${row.module}`}
      {...COMPACT_ROW_BLEED_PROPS}
      icon={MODULE_ICON[row.module]}
      iconProps={COMPACT_ROW_ICON_PROPS}
      titleProps={COMPACT_ENTRY_TITLE_PROPS}
      title={title}
      drillIn
      onPress={onPress}
    >
      {renderValue()}
    </ListItem>
  );
}

// Each product row opens that product's existing invitee reward detail
// (summary and history) for the address shown on this tab.
function useShowModuleDetail({
  walletAddress,
  earnAccountId,
  accountId,
  indexedAccountId,
}: {
  walletAddress?: string;
  earnAccountId?: string;
  accountId?: string;
  indexedAccountId?: string;
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const dialogInTab = useInTabDialog();
  return useCallback(
    (module: IRewardModule) => {
      if (!walletAddress) {
        return;
      }
      let title: string;
      let content: ReactNode;
      if (module === 'perps') {
        title = intl.formatMessage({ id: ETranslations.perps_trade_reward });
        content = <PerpsInviteeRewardContent walletAddress={walletAddress} />;
      } else if (module === 'swap') {
        title = intl.formatMessage({ id: ETranslations.global_swap });
        content = (
          <SwapInviteeRewardContent
            accountId={earnAccountId}
            currentEvmAddress={walletAddress}
          />
        );
      } else {
        title = intl.formatMessage({ id: ETranslations.earn_referral_bonus });
        content = (
          <EarnInviteeRewardContent
            accountId={accountId}
            indexedAccountId={indexedAccountId}
          />
        );
      }
      const dialogProps = {
        title,
        floatingPanelProps: { width: 480 },
        renderContent: content,
        showFooter: false,
      };
      if (!platformEnv.isNative && gtMd) {
        dialogInTab.show(dialogProps);
        return;
      }
      Dialog.show(dialogProps);
    },
    [
      accountId,
      dialogInTab,
      earnAccountId,
      gtMd,
      indexedAccountId,
      intl,
      walletAddress,
    ],
  );
}

export function MyRewardsContent() {
  const intl = useIntl();
  const { md } = useMedia();
  const cardStyle = useInviteHomeCardStyle();
  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const accountId = account?.id;
  const indexedAccountId = indexedAccount?.id;
  const hasAccount = Boolean(accountId || indexedAccountId);

  // Perps, Swap and Earn rewards are all keyed by the account's EVM address
  // (Perps uses the master address, not the agent wallet).
  const { result: earnAccount, isLoading: isResolvingAccount } =
    usePromiseResult(
      async () => {
        if (!hasAccount) {
          return null;
        }
        try {
          const resolved =
            await backgroundApiProxy.serviceStaking.getEarnAccount({
              accountId: accountId ?? '',
              indexedAccountId,
              networkId: getNetworkIdsMap().eth,
              btcOnlyTaproot: true,
            });
          return resolved?.accountAddress ? resolved : null;
        } catch {
          return null;
        }
      },
      [accountId, hasAccount, indexedAccountId],
      { watchLoading: true, undefinedResultIfReRun: true },
    );

  const walletAddress = earnAccount?.accountAddress;

  const {
    result: overview,
    isLoading: isLoadingOverview,
    run: reloadOverview,
  } = usePromiseResult(
    async () => {
      if (!walletAddress) {
        return undefined;
      }
      return backgroundApiProxy.serviceReferralCode.getInviteeRewardsOverview({
        walletAddress,
      });
    },
    [walletAddress],
    { watchLoading: true, undefinedResultIfReRun: true },
  );

  const showModuleDetail = useShowModuleDetail({
    walletAddress,
    earnAccountId: earnAccount?.accountId,
    accountId,
    indexedAccountId,
  });
  const bannerItems = usePerksBannerItems();

  if (!hasAccount) {
    return (
      <InviteeRewardNoWallet
        testID="my-rewards-onboarding"
        illustration="WalletAdd"
        title={MY_REWARDS_COPY.noWalletTitle}
      />
    );
  }

  const isResolving = isResolvingAccount !== false && earnAccount === undefined;
  const isUnsupported = !isResolving && !earnAccount;
  const isLoading = isResolving || Boolean(isLoadingOverview || !overview);
  const payout = isLoading ? undefined : getPayoutToken(overview);
  const rows = MODULES.map((module) =>
    getModuleRow(module, isLoading, overview),
  );
  const handleRowPress = (row: IModuleRow) => {
    if (row.status === 'error') {
      void reloadOverview();
      return;
    }
    if (row.status === 'ready') {
      showModuleDetail(row.module);
    }
  };
  const titleFor = (module: IRewardModule) =>
    intl.formatMessage({ id: MODULE_TITLE[module] });
  const sectionTitle = intl.formatMessage({
    id: ETranslations.referral_earnings_by_product__title,
  });
  const labels = {
    product: intl.formatMessage({ id: ETranslations.referral_product__title }),
    paid: intl.formatMessage({ id: ETranslations.referral_distributed }),
    unpaid: intl.formatMessage({ id: ETranslations.referral_undistributed }),
    noReward: intl.formatMessage({ id: ETranslations.referral_no_reward }),
  };

  const renderBreakdown = () => {
    if (isUnsupported) {
      return (
        <ReferralCardEmpty
          {...cardStyle}
          title={MY_REWARDS_COPY.unsupportedTitle}
          description={MY_REWARDS_COPY.unsupportedDescription}
        />
      );
    }
    if (!isLoading && hasNoRewards(overview)) {
      return <BenefitsTabPlaceholder />;
    }
    if (md) {
      return (
        <YStack px="$4" py="$1" {...cardStyle}>
          {rows.map((row) => (
            <CompactRow
              key={row.module}
              row={row}
              title={titleFor(row.module)}
              labels={labels}
              onPress={() => handleRowPress(row)}
            />
          ))}
        </YStack>
      );
    }
    return (
      <YStack>
        <XStack ai="center" gap="$4" {...DESKTOP_ROW_BLEED_PROPS} pb="$2">
          <DesktopCell first>
            <SubduedNote>{labels.product}</SubduedNote>
          </DesktopCell>
          <DesktopCell>
            <SubduedNote>{labels.paid}</SubduedNote>
          </DesktopCell>
          <DesktopCell>
            <SubduedNote>{labels.unpaid}</SubduedNote>
          </DesktopCell>
          {/* Chevron-wide spacer, so the header lines up with the rows. */}
          <Stack w="$5" />
        </XStack>
        {rows.map((row) => (
          <DesktopRow
            key={row.module}
            row={row}
            title={titleFor(row.module)}
            noRewardLabel={labels.noReward}
            onPress={() => handleRowPress(row)}
          />
        ))}
      </YStack>
    );
  };

  if (md) {
    // Compact: the campaign slides lead, then the address card scoping the
    // breakdown under a quiet caption inset like the cards' text.
    return (
      <YStack px="$pagePadding" pt="$2" pb="$6" gap="$5">
        <PerksCampaignBanner items={bannerItems} compact />
        <RewardsAddressCard
          address={walletAddress}
          unsupported={isUnsupported}
          payout={payout}
        />
        <YStack gap="$2">
          <SizableText size="$bodyMdMedium" color="$textSubdued" px="$4">
            {sectionTitle}
          </SizableText>
          {renderBreakdown()}
        </YStack>
      </YStack>
    );
  }

  // Desktop: the summary card and the campaign slides side by side, 2:1,
  // the slides stretched to the card's height. Without slides the card
  // takes the row.
  return (
    <YStack pb="$6">
      <XStack px="$pagePadding" gap="$5" ai="stretch">
        {/* Padding stays inside the flex items, so the split holds. */}
        <XStack flex={2} flexBasis={0} minWidth={0}>
          <PerksSummaryCard
            totals={
              isUnsupported ? { status: 'unavailable' } : getRewardTotals(rows)
            }
            address={walletAddress}
            unsupported={isUnsupported}
            payout={payout}
            labels={{
              total: MY_REWARDS_COPY.rebatesReceived,
              paid: labels.paid,
              unpaid: labels.unpaid,
            }}
          />
        </XStack>
        {bannerItems.length ? (
          <XStack flex={1} flexBasis={0} minWidth={0}>
            <PerksCampaignBanner items={bannerItems} compact={false} />
          </XStack>
        ) : null}
      </XStack>
      {/* A group gap: the summary scopes the table but is not part of it. */}
      <YStack px="$pagePadding" pt="$8" gap="$3">
        <SizableText size="$headingLg">{sectionTitle}</SizableText>
        {renderBreakdown()}
      </YStack>
    </YStack>
  );
}
