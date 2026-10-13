import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  IconButton,
  NumberSizeableText,
  Page,
  RefreshControl,
  SectionList,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { InviteWithdrawAddressRow } from '@onekeyhq/kit/src/views/ReferFriends/pages/RewardDistributionHistory/components/InviteWithdrawAddressRow';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IInvitePaidHistory,
  IInvitePaidItem,
} from '@onekeyhq/shared/src/referralCode/type';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { ReferFriendsPageContainer } from '../../components';

type ISectionListItem = {
  title?: string;
  data: number[];
};

// FlashList v2 enables maintainVisibleContentPosition by default. This list
// mounts empty, then the address header and the sections resolve on their
// own; mVCP re-anchors the offset on each swap and, with the automatic modal
// inset, leaves the address row under the header and the list stuck on the
// first open. Typed loosely: the web ListView is a FlatList whose prop of the
// same name has a different shape.
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
    return backgroundApiProxy.serviceReferralCode.getInvitePaidList();
  }, []);

  const onRefresh = useCallback(() => {
    setIsLoading(true);
    void Promise.allSettled([fetchInvitePaidList()]).then(([list]) => {
      if (list.status === 'fulfilled') {
        const data = list.value;
        setSections(formatSections(data.items));
        originalData.current.push(...data.items);
      }

      setIsLoading(false);
    });
  }, [fetchInvitePaidList]);

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
          <SectionList
            flex={1}
            // The address row is the list's first row, so the scroller must
            // inset it below the modal header. A sibling above the list left
            // that inset as a blank gap over the first section on phones.
            contentInsetAdjustmentBehavior="automatic"
            {...listScrollBehaviorProps}
            ListHeaderComponent={<InviteWithdrawAddressRow />}
            refreshControl={
              <RefreshControl
                // The first load shows its own spinner in the list.
                refreshing={isLoading && sections !== undefined}
                onRefresh={onRefresh}
              />
            }
            contentContainerStyle={{ pb: '$10' }}
            // Loading shows in the list, so the address row above stays.
            ListEmptyComponent={
              sections === undefined ? (
                <YStack py="$10" ai="center">
                  <Spinner size="large" />
                </YStack>
              ) : (
                <Empty
                  mt={34}
                  illustration="QuestionMark"
                  title={intl.formatMessage({
                    id: ETranslations.global_no_data,
                  })}
                />
              )
            }
            sections={sections ?? []}
            renderSectionHeader={renderSectionHeader}
            estimatedItemSize={60}
            renderItem={renderItem}
            // onEndReached={fetchMore}
          />
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
