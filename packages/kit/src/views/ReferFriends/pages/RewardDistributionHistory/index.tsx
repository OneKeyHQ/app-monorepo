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
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IInvitePaidHistory,
  IInvitePaidItem,
} from '@onekeyhq/shared/src/referralCode/type';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

type ISectionListItem = {
  title?: string;
  data: number[];
};

const formatSections = (items: IInvitePaidHistory['items']) => {
  const groupedData: Record<string, IInvitePaidHistory['items']> = items.reduce<
    Record<string, any[]>
  >((acc, item) => {
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
  }, {} as Record<string, IInvitePaidHistory['items']>);

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
  const { md } = useMedia();
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
      {platformEnv.isNative || md ? (
        <Page.Header
          title={intl.formatMessage({
            id: ETranslations.referral_reward_history,
          })}
        />
      ) : (
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.ReferFriends}
        />
      )}
      <Page.Body>
        {sections === undefined ? (
          <YStack
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            ai="center"
            jc="center"
            flex={1}
          >
            <Spinner size="large" />
          </YStack>
        ) : (
          <SectionList
            refreshControl={
              <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
            }
            contentContainerStyle={{ pb: '$10' }}
            ListEmptyComponent={
              <Empty
                mt={34}
                icon="SearchOutline"
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
        )}
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
