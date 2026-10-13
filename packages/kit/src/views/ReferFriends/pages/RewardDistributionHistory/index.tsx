import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  IconButton,
  NumberSizeableText,
  Page,
  RefreshControl,
  SectionList,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { InviteWithdrawAddressRow } from '@onekeyhq/kit/src/views/ReferFriends/pages/RewardDistributionHistory/components/InviteWithdrawAddressRow';
import { PayoutHistorySkeleton } from '@onekeyhq/kit/src/views/ReferFriends/pages/RewardDistributionHistory/components/PayoutHistorySkeleton';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IInvitePaidHistory,
  IInvitePaidItem,
  IInviteSummary,
} from '@onekeyhq/shared/src/referralCode/type';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { ReferFriendsPageContainer } from '../../components';

import { mockInvitePaidList, mockSummaryInfo } from './mockPayoutHistory';

type ISectionListItem = {
  title?: string;
  data: number[];
};

// FlashList v2 enables maintainVisibleContentPosition by default. Pull to
// refresh replaces every section, and mVCP would re-anchor the offset against
// the automatic modal inset. Typed loosely: the web ListView is a FlatList
// whose prop of the same name has a different shape.
const listScrollBehaviorProps: Record<string, unknown> = platformEnv.isNative
  ? {
      maintainVisibleContentPosition: {
        disabled: true,
      },
    }
  : {};

const formatSections = (items: IInvitePaidHistory['items']) => {
  const groupedData: Record<string, IInvitePaidHistory['items']> = items.reduce<
    Record<string, any[]>
  >(
    (acc, item) => {
      const date = new Date(item.createdAt);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const dateKey = `${year}-${month.toString().padStart(2, '0')}-${day
        .toString()
        .padStart(2, '0')}`;

      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }

      acc[dateKey].push(item);
      return acc;
    },
    {} as Record<string, IInvitePaidHistory['items']>,
  );

  return Object.keys(groupedData).map((dateKey) => {
    const date = new Date(groupedData[dateKey][0].createdAt);
    return {
      title: formatDate(date, {
        hideTimeForever: true,
      }),
      data: groupedData[dateKey],
    };
  });
};

function RewardDistributionHistoryPageWrapper() {
  // Redirect to ReferAFriend page if user is not logged in
  useRedirectWhenNotLoggedIn();

  const originalData = useRef<IInvitePaidHistory['items']>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sections, setSections] = useState<
    { title: string; data: IInvitePaidHistory['items'] }[] | undefined
  >(undefined);
  const fetchInvitePaidList = useCallback(() => {
    return mockInvitePaidList(() =>
      backgroundApiProxy.serviceReferralCode.getInvitePaidList(),
    );
  }, []);

  const [summaryInfo, setSummaryInfo] = useState<IInviteSummary>();
  // Fetched again after the address is edited; a failure keeps it as is.
  const fetchSummaryInfo = useCallback(async () => {
    try {
      setSummaryInfo(
        await mockSummaryInfo(() =>
          backgroundApiProxy.serviceReferralCode.getSummaryInfo(),
        ),
      );
    } catch {
      // ignore
    }
  }, []);

  // Both requests settle in one commit, so the list mounts once with its final
  // header and rows instead of growing under the modal header (OK-64624).
  const onRefresh = useCallback(() => {
    setIsLoading(true);
    void Promise.allSettled([
      fetchInvitePaidList(),
      mockSummaryInfo(() =>
        backgroundApiProxy.serviceReferralCode.getSummaryInfo(),
      ),
    ]).then(([list, summary]) => {
      if (list.status === 'fulfilled') {
        const data = list.value;
        setSections(formatSections(data.items));
        originalData.current.push(...data.items);
      } else {
        // Leave the skeleton for the empty state if the first load fails.
        setSections((prev) => prev ?? []);
      }
      // A failed summary only drops the address row.
      if (summary.status === 'fulfilled') {
        setSummaryInfo(summary.value);
      }

      setIsLoading(false);
    });
  }, [fetchInvitePaidList]);

  const listHeader = useMemo(
    () =>
      summaryInfo ? (
        <InviteWithdrawAddressRow
          summaryInfo={summaryInfo}
          fetchSummaryInfo={fetchSummaryInfo}
        />
      ) : null,
    [fetchSummaryInfo, summaryInfo],
  );

  useEffect(() => {
    onRefresh();
  }, [fetchInvitePaidList, onRefresh]);
  const renderSectionHeader = useCallback(
    (item: { section: ISectionListItem }) => {
      if (item.section.title) {
        return <SectionList.SectionHeader title={item.section.title} />;
      }
    },
    [],
  );

  // const fetchMore = useCallback(async () => {
  //   if (originalData.current.length < 1) {
  //     return;
  //   }
  //   const data = await fetchInvitePaidList();
  //   if (data.items.length > 0) {
  //     originalData.current.push(...data.items);
  //     setSections(formatSections(originalData.current));
  //   }
  // }, [fetchInvitePaidList]);

  const intl = useIntl();
  const renderItem = useCallback(
    ({ item }: { item: IInvitePaidItem; section: ISectionListItem }) => {
      return (
        <YStack px="$5" py="$2.5">
          <XStack jc="space-between" ai="center" gap="$4">
            <XStack gap="$3" flexShrink={1}>
              <Token size="lg" tokenImageUri={item.token.logoURI} />
              <YStack flexShrink={1}>
                <XStack flexShrink={1}>
                  <SizableText size="$bodyLgMedium" flexShrink={1}>
                    {intl.formatMessage({
                      id: ETranslations.referral_reward_history_reward_title,
                    })}
                  </SizableText>
                </XStack>
                <XStack ai="center" flexShrink={1} gap="$1">
                  <SizableText
                    color="$textSubdued"
                    size="$bodyMd"
                    numberOfLines={1}
                    flexShrink={1}
                  >
                    {item.tx
                      ? accountUtils.shortenAddress({
                          address: item.tx,
                          leadingLength: 8,
                          trailingLength: 6,
                        })
                      : '-'}
                  </SizableText>
                  {item.tx ? (
                    <IconButton
                      testID="refer-friends-icon-btn"
                      variant="tertiary"
                      icon="OpenOutline"
                      size="small"
                      onPress={() => {
                        void openTransactionDetailsUrl({
                          networkId: item.networkId,
                          txid: item.tx,
                        });
                      }}
                    />
                  ) : null}
                </XStack>
              </YStack>
            </XStack>
            <XStack>
              <NumberSizeableText
                numberOfLines={1}
                formatter="balance"
                formatterOptions={{
                  showPlusMinusSigns: true,
                  tokenSymbol: item.token.symbol,
                }}
                color="$textSuccess"
                size="$bodyLgMedium"
                pr="$0.5"
              >
                {item.paidAmount}
              </NumberSizeableText>
            </XStack>
          </XStack>
        </YStack>
      );
    },
    [intl],
  );
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.referral_payout_history__title,
        })}
        // iOS 26 veils the first list row under the modal bar. Restate the
        // hidden edge here; Page.Header replaces this option as a whole.
        {...(platformEnv.isNativeIOS26Plus
          ? { scrollEdgeEffects: { top: 'hidden' as const } }
          : undefined)}
      />
      <Page.Body>
        <ReferFriendsPageContainer flex={1} position="relative">
          {sections ? (
            <SectionList
              flex={1}
              // The address row is the list's first row, so the scroller must
              // inset it below the modal header. A sibling above the list left
              // that inset as a blank gap over the first section on phones.
              contentInsetAdjustmentBehavior="automatic"
              {...listScrollBehaviorProps}
              ListHeaderComponent={listHeader}
              refreshControl={
                <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
              }
              contentContainerStyle={{ pb: '$10' }}
              ListEmptyComponent={
                <Empty
                  mt={34}
                  illustration="QuestionMark"
                  title={intl.formatMessage({
                    id: ETranslations.global_no_data,
                  })}
                />
              }
              sections={sections}
              renderSectionHeader={renderSectionHeader}
              estimatedItemSize={60}
              renderItem={renderItem}
              // onEndReached={fetchMore}
            />
          ) : (
            <PayoutHistorySkeleton />
          )}
        </ReferFriendsPageContainer>
      </Page.Body>
    </Page>
  );
}

export default function RewardDistributionHistory() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <RewardDistributionHistoryPageWrapper />
    </AccountSelectorProviderMirror>
  );
}
