import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Button,
  Empty,
  Icon,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { FontSizeTokens } from '@onekeyhq/components/src/shared/tamagui';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteeRewardsOverview } from '@onekeyhq/shared/src/referralCode/type';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IEarnAlert,
  IEarnSummaryV2,
  IEarnText,
} from '@onekeyhq/shared/types/staking';

import { InviteeRewardNoWallet } from '../../components/InviteeRewardNoWallet';
import { BenefitsTabPlaceholder } from '../InviteReward/components/BenefitsTabPlaceholder';

type IRewardModule = keyof IInviteeRewardsOverview;

// Hardcoded English until i18n keys are added in Lokalise.
const MY_REWARDS_COPY = {
  addressScope: (address: string) => `Showing rewards for ${address} only`,
  unsupportedTitle: 'This account has no EVM address',
  unsupportedDescription: 'Switch to an EVM account to view rewards',
  loadFailed: 'Unable to load rewards',
  noRewards: 'No rewards yet',
  moreTokens: (count: number) => `+${count} more`,
  moduleHistory: (module: string) => `${module} history`,
  pendingSuffix: 'pending',
  noWalletTitle: 'Connect a wallet to view rewards',
  viewHistory: 'View history',
};

const HISTORY_PAGE_SIZE = 10;

// Perps rebates are paid on Arbitrum; the API does not return a network id.
const PERPS_EXPLORER_TX_URL = 'https://arbiscan.io/tx/';

interface IHistoryRow {
  key: string;
  date: string;
  amount: string;
  tokenSymbol: string;
  tokenLogoURI?: string;
  onPress?: () => void;
}

interface IModuleSummary {
  amount?: string;
  pending?: string;
  tokenSymbol?: string;
  // Earn amounts come pre-formatted (and possibly marked up) from the server.
  earnText?: IEarnText;
  extraTokenCount?: number;
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

function getModuleSummary(
  module: IRewardModule,
  overview?: IInviteeRewardsOverview,
): IModuleSummary | undefined {
  if (!overview) {
    return undefined;
  }
  if (module === 'earn') {
    if (overview.earn.status !== 'success') {
      return undefined;
    }
    const tokens = getEarnTokens(overview.earn.data);
    if (!tokens.length) {
      return { amount: '0' };
    }
    const extraTokenCount = tokens.length - 1;
    // Split plain "<amount> <symbol>" titles so they match the other modules;
    // anything else (e.g. marked-up text) is rendered as is.
    const match = /^([\d.,]+)\s+([A-Za-z0-9.]+)$/.exec(
      tokens[0].title.text.trim(),
    );
    if (match) {
      return {
        amount: match[1].replace(/,/g, ''),
        tokenSymbol: match[2],
        extraTokenCount,
      };
    }
    return { earnText: tokens[0].title, extraTokenCount };
  }
  const result = overview[module];
  if (result.status !== 'success') {
    return undefined;
  }
  const { totalBonus, undistributed, token } = result.data;
  return {
    amount: totalBonus,
    pending: new BigNumber(undistributed).gt(0) ? undistributed : undefined,
    tokenSymbol: token.symbol,
  };
}

// Cards are only used in wide containers (see MODULE_CARDS_MIN_WIDTH).
const MODULE_CARDS_MIN_WIDTH = 600;

function getValueSize(cardWidth: number): FontSizeTokens {
  return cardWidth >= 260 ? '$heading3xl' : '$heading2xl';
}

function ModuleValue({
  summary,
  isLoading,
  size,
  showSymbol,
}: {
  summary?: IModuleSummary;
  isLoading: boolean;
  size: FontSizeTokens;
  showSymbol: boolean;
}) {
  if (isLoading) {
    return <Skeleton width={80} height={28} />;
  }
  if (!summary) {
    return (
      <SizableText size={size} color="$textDisabled">
        -
      </SizableText>
    );
  }
  if (summary.earnText) {
    return (
      <EarnText
        numberOfLines={1}
        text={{ ...summary.earnText, size, color: '$text' }}
      />
    );
  }
  // The symbol is set smaller so the amount keeps the visual weight and
  // does not get truncated in narrow cards.
  return (
    <XStack ai="baseline" gap="$1" minWidth={0}>
      <NumberSizeableText
        size={size}
        formatter="value"
        numberOfLines={1}
        flexShrink={1}
      >
        {summary.amount ?? '0'}
      </NumberSizeableText>
      {showSymbol && summary.tokenSymbol ? (
        <SizableText size="$bodyLgMedium" color="$textSubdued">
          {summary.tokenSymbol}
        </SizableText>
      ) : null}
    </XStack>
  );
}

function ModuleCaption({
  summary,
  isLoading,
  showSymbol,
}: {
  summary?: IModuleSummary;
  isLoading: boolean;
  showSymbol: boolean;
}) {
  if (isLoading || !summary) {
    return null;
  }
  if (summary.extraTokenCount) {
    return (
      <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
        {MY_REWARDS_COPY.moreTokens(summary.extraTokenCount)}
      </SizableText>
    );
  }
  const symbol = showSymbol ? summary.tokenSymbol : undefined;
  if (!symbol && !summary.pending) {
    return null;
  }
  return (
    <XStack ai="center" gap="$1" minWidth={0}>
      {symbol ? (
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {symbol}
        </SizableText>
      ) : null}
      {symbol && summary.pending ? (
        <SizableText size="$bodySm" color="$textDisabled">
          ·
        </SizableText>
      ) : null}
      {summary.pending ? (
        <>
          <NumberSizeableText
            size="$bodySm"
            color="$textSubdued"
            formatter="value"
            numberOfLines={1}
            flexShrink={1}
          >
            {summary.pending}
          </NumberSizeableText>
          <SizableText size="$bodySm" color="$textSubdued" flexShrink={0}>
            {MY_REWARDS_COPY.pendingSuffix}
          </SizableText>
        </>
      ) : null}
    </XStack>
  );
}

interface IModuleCardProps {
  module: IRewardModule;
  label: string;
  icon: IKeyOfIcons;
  summary?: IModuleSummary;
  isLoading: boolean;
  isSelected: boolean;
  onPress: () => void;
}

const selectableStyle = (isSelected: boolean) =>
  ({
    borderRadius: '$4',
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: isSelected ? '$borderActive' : '$borderSubdued',
    bg: isSelected ? '$bgStrong' : '$bgSubdued',
    cursor: 'pointer',
    hoverStyle: { bg: '$bgStrong' },
    pressStyle: { bg: '$bgActive' },
  }) as const;

function ModuleLabel({ label, icon }: { label: string; icon: IKeyOfIcons }) {
  return (
    <XStack ai="center" gap="$2" minWidth={0}>
      <Stack p="$1.5" borderRadius="$full" bg="$bgApp">
        <Icon name={icon} size="$4" color="$iconSubdued" />
      </Stack>
      <SizableText size="$bodyMdMedium" color="$textSubdued" numberOfLines={1}>
        {label}
      </SizableText>
    </XStack>
  );
}

function ModuleCard({
  module,
  label,
  icon,
  summary,
  isLoading,
  isSelected,
  onPress,
}: IModuleCardProps) {
  const [cardWidth, setCardWidth] = useState(0);
  return (
    <YStack
      testID={`my-rewards-module-${module}`}
      role="button"
      flex={1}
      flexBasis={0}
      minWidth={0}
      gap="$3"
      p="$4"
      onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}
      onPress={onPress}
      {...selectableStyle(isSelected)}
    >
      <ModuleLabel label={label} icon={icon} />
      <YStack gap="$1">
        <ModuleValue
          summary={summary}
          isLoading={isLoading}
          size={getValueSize(cardWidth)}
          showSymbol
        />
        {/* Reserve the caption line so all cards keep the same height. */}
        <XStack minHeight="$5" ai="center">
          <ModuleCaption
            summary={summary}
            isLoading={isLoading}
            showSymbol={false}
          />
        </XStack>
      </YStack>
    </YStack>
  );
}

// Three columns are too narrow in compact containers, so modules become list
// rows there.
function ModuleRow({
  module,
  label,
  icon,
  summary,
  isLoading,
  isSelected,
  onPress,
}: IModuleCardProps) {
  return (
    <XStack
      testID={`my-rewards-module-${module}`}
      role="button"
      ai="center"
      jc="space-between"
      gap="$3"
      px="$4"
      py="$3"
      onPress={onPress}
      {...selectableStyle(isSelected)}
    >
      <ModuleLabel label={label} icon={icon} />
      <YStack ai="flex-end" flexShrink={1} minWidth={0}>
        <ModuleValue
          summary={summary}
          isLoading={isLoading}
          size="$headingMd"
          showSymbol
        />
        <ModuleCaption
          summary={summary}
          isLoading={isLoading}
          showSymbol={false}
        />
      </YStack>
    </XStack>
  );
}

function HistoryRow({ row }: { row: IHistoryRow }) {
  return (
    <XStack
      ai="center"
      gap="$3"
      py="$2.5"
      px="$3"
      mx="$-3"
      borderRadius="$3"
      borderCurve="continuous"
      cursor={row.onPress ? 'pointer' : undefined}
      hoverStyle={row.onPress ? { bg: '$bgHover' } : undefined}
      pressStyle={row.onPress ? { bg: '$bgActive' } : undefined}
      onPress={row.onPress}
    >
      <Token size="sm" tokenImageUri={row.tokenLogoURI} />
      <SizableText flex={1} size="$bodyLg" numberOfLines={1}>
        {row.date}
      </SizableText>
      <NumberSizeableText
        size="$bodyLgMedium"
        color="$textSuccess"
        formatter="value"
        formatterOptions={{
          tokenSymbol: row.tokenSymbol,
          showPlusMinusSigns: true,
        }}
      >
        {row.amount}
      </NumberSizeableText>
      {row.onPress ? (
        <Icon name="OpenOutline" size="$4" color="$iconSubdued" />
      ) : null}
    </XStack>
  );
}

function StateBlock({
  illustration,
  title,
  description,
  action,
}: {
  illustration: 'Coins' | 'GlobeError' | 'WalletAdd';
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void; testID: string };
}) {
  return (
    <YStack py="$8" ai="center" jc="center">
      <Empty
        illustration={illustration}
        title={title}
        description={description}
      />
      {action ? (
        <Button
          testID={action.testID}
          mt="$1"
          size="small"
          variant="secondary"
          onPress={action.onPress}
        >
          {action.label}
        </Button>
      ) : null}
    </YStack>
  );
}

function HistorySkeleton() {
  return (
    <YStack gap="$1">
      {[0, 1, 2].map((index) => (
        <XStack key={index} ai="center" gap="$3" py="$2.5">
          <Skeleton width={32} height={32} radius="round" />
          <Stack flex={1}>
            <Skeleton width={96} height={16} />
          </Stack>
          <Skeleton width={72} height={16} />
        </XStack>
      ))}
    </YStack>
  );
}

function HistoryList({ rows }: { rows: IHistoryRow[] }) {
  const intl = useIntl();
  const [displayCount, setDisplayCount] = useState(HISTORY_PAGE_SIZE);

  if (!rows.length) {
    return (
      <StateBlock illustration="Coins" title={MY_REWARDS_COPY.noRewards} />
    );
  }

  return (
    <YStack>
      {rows.slice(0, displayCount).map((row) => (
        <HistoryRow key={row.key} row={row} />
      ))}
      {displayCount < rows.length ? (
        <Button
          testID="my-rewards-show-more"
          mt="$2"
          variant="tertiary"
          alignSelf="center"
          onPress={() => setDisplayCount((count) => count + HISTORY_PAGE_SIZE)}
        >
          {intl.formatMessage({ id: ETranslations.global_show_more })}
        </Button>
      ) : null}
    </YStack>
  );
}

function EarnHistory({
  data,
  earnAccountId,
}: {
  data: IEarnSummaryV2;
  earnAccountId: string;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const tokens = getEarnTokens(data);

  const handleViewHistory = useCallback(() => {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.HistoryList,
      params: {
        title: intl.formatMessage({
          id: ETranslations.referral_reward_history,
        }),
        alerts: [
          {
            key: ESpotlightTour.earnRewardHistory,
            badge: 'info',
            alert: intl.formatMessage({
              id: ETranslations.earn_reward_distribution_schedule,
            }),
          } as IEarnAlert,
        ],
        accountId: earnAccountId,
        networkId: getNetworkIdsMap().eth,
        filterType: 'rebate',
      },
    });
  }, [earnAccountId, intl, navigation]);

  if (!tokens.length) {
    return (
      <StateBlock illustration="Coins" title={MY_REWARDS_COPY.noRewards} />
    );
  }

  return (
    <YStack>
      {data.distributed.map((item, index) => (
        <XStack key={`distributed-${index}`} ai="center" gap="$3" py="$2.5">
          <Token size="sm" tokenImageUri={item.token.logoURI} />
          <Stack flex={1} minWidth={0}>
            <EarnText
              numberOfLines={1}
              text={{ ...item.title, size: '$bodyLgMedium', color: '$text' }}
            />
          </Stack>
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.referral_distributed })}
          </SizableText>
        </XStack>
      ))}
      {data.undistributed.map((item, index) => (
        <XStack key={`undistributed-${index}`} ai="center" gap="$3" py="$2.5">
          <Token size="sm" tokenImageUri={item.token.logoURI} />
          <Stack flex={1} minWidth={0}>
            <EarnText
              numberOfLines={1}
              text={{ ...item.title, size: '$bodyLgMedium', color: '$text' }}
            />
          </Stack>
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.referral_pending })}
          </SizableText>
        </XStack>
      ))}
      {data.distributed.length ? (
        <Button
          testID="my-rewards-earn-history"
          mt="$2"
          variant="tertiary"
          alignSelf="center"
          iconAfter="ChevronRightSmallOutline"
          onPress={handleViewHistory}
        >
          {MY_REWARDS_COPY.viewHistory}
        </Button>
      ) : null}
    </YStack>
  );
}

function useHistoryRows(
  module: IRewardModule,
  overview?: IInviteeRewardsOverview,
): IHistoryRow[] {
  const { formatDate } = useFormatDate();
  return useMemo(() => {
    if (module === 'perps' && overview?.perps.status === 'success') {
      const { history, token } = overview.perps.data;
      return history.map((item, index) => ({
        key: `${item.tx}-${index}`,
        date: formatDate(item.date, { hideTimeForever: true }),
        amount: item.amount,
        tokenSymbol: token.symbol,
        tokenLogoURI: token.logoURI,
        onPress: item.tx
          ? () =>
              openUrlUtils.openUrlExternal(`${PERPS_EXPLORER_TX_URL}${item.tx}`)
          : undefined,
      }));
    }
    if (module === 'swap' && overview?.swap.status === 'success') {
      return overview.swap.data.history.map((item, index) => ({
        key: `${item.tx}-${index}`,
        date: formatDate(item.date, { hideTimeForever: true }),
        amount: item.amount,
        tokenSymbol: item.token.symbol,
        tokenLogoURI: item.token.logoURI,
        onPress: item.tx
          ? () => {
              void openTransactionDetailsUrl({
                networkId: item.token.networkId,
                txid: item.tx,
              });
            }
          : undefined,
      }));
    }
    return [];
  }, [formatDate, module, overview]);
}

export function MyRewardsContent() {
  const intl = useIntl();
  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const accountId = account?.id;
  const indexedAccountId = indexedAccount?.id;
  const hasAccount = Boolean(accountId || indexedAccountId);

  const [selectedModule, setSelectedModule] = useState<IRewardModule>('perps');

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

  const historyRows = useHistoryRows(selectedModule, overview);
  const [containerWidth, setContainerWidth] = useState(0);
  const useCards = containerWidth >= MODULE_CARDS_MIN_WIDTH;
  const ModuleItem = useCards ? ModuleCard : ModuleRow;

  const handleRetry = useCallback(() => {
    void reloadOverview();
  }, [reloadOverview]);

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

  const modules: { module: IRewardModule; label: string; icon: IKeyOfIcons }[] =
    [
      {
        module: 'perps',
        label: intl.formatMessage({ id: ETranslations.global_perp }),
        icon: 'TradeOutline',
      },
      {
        module: 'swap',
        label: intl.formatMessage({ id: ETranslations.global_swap }),
        icon: 'SwitchHorOutline',
      },
      {
        module: 'earn',
        label: intl.formatMessage({ id: ETranslations.global_earn }),
        icon: 'CoinsOutline',
      },
    ];

  const renderHistory = () => {
    if (isLoading) {
      return <HistorySkeleton />;
    }
    const moduleResult = overview?.[selectedModule];
    if (moduleResult?.status !== 'success') {
      return (
        <StateBlock
          illustration="GlobeError"
          title={MY_REWARDS_COPY.loadFailed}
          action={{
            testID: 'my-rewards-retry',
            label: intl.formatMessage({ id: ETranslations.global_retry }),
            onPress: handleRetry,
          }}
        />
      );
    }
    if (selectedModule === 'earn' && earnAccount) {
      return (
        <EarnHistory
          data={moduleResult.data as IEarnSummaryV2}
          earnAccountId={earnAccount.accountId}
        />
      );
    }
    return <HistoryList key={selectedModule} rows={historyRows} />;
  };

  const renderMain = () => {
    if (!isLoading && hasNoRewards(overview)) {
      return <BenefitsTabPlaceholder />;
    }
    if (isUnsupported) {
      return (
        <StateBlock
          illustration="WalletAdd"
          title={MY_REWARDS_COPY.unsupportedTitle}
          description={MY_REWARDS_COPY.unsupportedDescription}
        />
      );
    }
    return (
      <>
        <Stack
          flexDirection={useCards ? 'row' : 'column'}
          gap={useCards ? '$4' : '$2'}
          onLayout={(event) =>
            setContainerWidth(event.nativeEvent.layout.width)
          }
        >
          {modules.map((item) => (
            <ModuleItem
              key={item.module}
              module={item.module}
              label={item.label}
              icon={item.icon}
              summary={getModuleSummary(item.module, overview)}
              isLoading={isLoading}
              isSelected={selectedModule === item.module}
              onPress={() => setSelectedModule(item.module)}
            />
          ))}
        </Stack>

        <YStack gap="$2">
          <SizableText size="$headingMd">
            {MY_REWARDS_COPY.moduleHistory(
              modules.find((item) => item.module === selectedModule)?.label ??
                '',
            )}
          </SizableText>
          {renderHistory()}
        </YStack>
      </>
    );
  };

  return (
    <YStack
      gap="$6"
      px="$pagePadding"
      py="$5"
      // Wide layouts already have the tab row right above.
      $gtMd={{ pt: '$1' }}
    >
      <YStack gap="$1.5">
        <XStack>
          <AccountSelectorTriggerHome num={0} hideAddress />
        </XStack>
        {walletAddress ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            {MY_REWARDS_COPY.addressScope(
              accountUtils.shortenAddress({ address: walletAddress }),
            )}
          </SizableText>
        ) : null}
      </YStack>

      {renderMain()}
    </YStack>
  );
}
