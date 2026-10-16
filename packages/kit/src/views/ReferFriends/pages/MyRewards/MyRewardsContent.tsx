import type { ReactNode } from 'react';
import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Dialog,
  Icon,
  Illustration,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useInTabDialog,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EarnInviteeRewardContent } from '@onekeyhq/kit/src/views/Earn/components/InviteeReward/EarnInviteeRewardContent';
import { InviteeRewardContent as PerpsInviteeRewardContent } from '@onekeyhq/kit/src/views/Perp/components/InviteeReward/InviteeRewardContent';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { SwapInviteeRewardContent } from '@onekeyhq/kit/src/views/Swap/components/InviteeReward/SwapInviteeRewardContent';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInviteeRewardsOverview } from '@onekeyhq/shared/src/referralCode/type';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IEarnSummaryV2, IEarnText } from '@onekeyhq/shared/types/staking';

import { InviteeRewardNoWallet } from '../../components/InviteeRewardNoWallet';
import { ReferralCardEmpty } from '../../components/ReferralCardEmpty';
import { BenefitsTabPlaceholder } from '../InviteReward/components/BenefitsTabPlaceholder';
import { INVITE_REWARD_SUBJECT_ICON } from '../InviteReward/components/getInviteRewardRows';
import {
  COMPACT_ENTRY_TITLE_PROPS,
  COMPACT_ROW_BLEED_PROPS,
  COMPACT_ROW_ICON_PROPS,
  PRESSABLE_SURFACE_PROPS,
  useInviteHomeCardStyle,
} from '../InviteReward/components/useInviteCardStyle';

type IRewardModule = keyof IInviteeRewardsOverview;

// Hardcoded English until i18n keys are added in Lokalise.
const MY_REWARDS_COPY = {
  addressLabel: 'Rewards address',
  addressScope: 'Only this address is counted',
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
  | { kind: 'amount'; amount: string; symbol: string }
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

function getEarnValue(
  items: IEarnSummaryV2['distributed'] | IEarnSummaryV2['undistributed'],
): IRewardValue | undefined {
  if (!items.length) {
    return undefined;
  }
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
  const { totalBonus, undistributed, token } = result.data;
  const unpaid = new BigNumber(undistributed);
  const paid = new BigNumber(totalBonus).minus(unpaid);
  return {
    module,
    status: 'ready',
    paid: paid.gt(0)
      ? { kind: 'amount', amount: paid.toFixed(), symbol: token.symbol }
      : undefined,
    unpaid: unpaid.gt(0)
      ? { kind: 'amount', amount: unpaid.toFixed(), symbol: token.symbol }
      : undefined,
  };
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
      <NumberSizeableText
        size={size}
        color={color}
        formatter="value"
        formatterOptions={{ tokenSymbol: value.symbol }}
        numberOfLines={1}
      >
        {value.amount}
      </NumberSizeableText>
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

// The rewards address leads the tab like the earnings card leads the invite
// tab: the label, the address as the figure, the account switch under it,
// and the brand line art in the room the address leaves.
function RewardsAddressCard({ address }: { address?: string }) {
  const { md } = useMedia();
  const cardStyle = useInviteHomeCardStyle();
  return (
    <YStack p={md ? '$4' : '$5'} gap="$1" {...cardStyle}>
      <SizableText size="$bodyLgMedium" color="$textSubdued">
        {MY_REWARDS_COPY.addressLabel}
      </SizableText>
      <XStack ai="flex-start" gap="$4">
        <YStack flex={1} minWidth={0} ai="flex-start" gap="$2">
          <SizableText
            size={md ? '$heading3xl' : '$heading4xl'}
            numberOfLines={1}
          >
            {address
              ? // Compact cards fit the address at figure size only when
                // shorter, like the header account chip.
                accountUtils.shortenAddress({
                  address,
                  ...(md ? { leadingLength: 6, trailingLength: 4 } : null),
                })
              : '-'}
          </SizableText>
          <AccountSelectorTriggerHome num={0} hideAddress />
          <SubduedNote>{MY_REWARDS_COPY.addressScope}</SubduedNote>
        </YStack>
        <Illustration
          name="BlockPercentage"
          size={md ? 64 : 80}
          flexShrink={0}
        />
      </XStack>
    </YStack>
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
          ) : null}
        </DesktopCell>
        <DesktopCell>
          {row.unpaid ? (
            <RewardValue value={row.unpaid} size="$bodyLgMedium" />
          ) : null}
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
    // Compact: the address card, then the breakdown under a quiet caption
    // inset like the cards' text, as on the invite tab.
    return (
      <YStack px="$pagePadding" pt="$2" pb="$6" gap="$5">
        <RewardsAddressCard address={walletAddress} />
        <YStack gap="$2">
          <SizableText size="$bodyMdMedium" color="$textSubdued" px="$4">
            {sectionTitle}
          </SizableText>
          {renderBreakdown()}
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack pb="$6">
      <YStack px="$pagePadding">
        <RewardsAddressCard address={walletAddress} />
      </YStack>
      {/* A wider gap splits the address card from the breakdown, and the
          section title matches the invite tab's. */}
      <YStack px="$pagePadding" pt="$10" gap="$3">
        <SizableText size="$headingLg">{sectionTitle}</SizableText>
        {renderBreakdown()}
      </YStack>
    </YStack>
  );
}
