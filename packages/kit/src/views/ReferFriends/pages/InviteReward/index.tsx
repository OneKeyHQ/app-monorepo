import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Empty,
  Page,
  ScrollView,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { CumulativeRewards } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/CumulativeRewards';
import { Dashboard } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/Dashboard';
import { FAQ } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/FAQ';
import { ReferralCodeCard } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/ReferralCodeCard';
import { OneKeyServerApiError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';
import {
  ETabReferFriendsRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

function Link() {
  return (
    <XStack px="$5" mb="$5">
      <HyperlinkText
        cursor="pointer"
        size="$bodyMdMedium"
        underlineTextProps={{
          color: '$textInfo',
        }}
        style={{
          textUnderlineOffset: 2,
        }}
        translationId={ETranslations.referral_more_questions}
      />
    </XStack>
  );
}

function InviteRewardContent({
  summaryInfo,
  fetchSummaryInfo,
}: {
  summaryInfo: IInviteSummary;
  fetchSummaryInfo: () => void;
}) {
  const {
    faqs,
    inviteUrl,
    inviteCode,
    enabledNetworks,
    Onchain,
    HardwareSales,
    cumulativeRewards,
    levelPercent,
    rebateLevels,
    rebateConfig,
    withdrawAddresses,
  } = summaryInfo;
  const navigation = useAppNavigation();

  const handleViewLevelDetail = useCallback(() => {
    navigation.push(ETabReferFriendsRoutes.TabReferralLevel);
  }, [navigation]);

  return (
    <>
      <Stack
        gap="$5"
        flexDirection="row"
        $md={{
          flexDirection: 'column',
        }}
      >
        <Stack flex={1} px="$5" pt="$6">
          <CumulativeRewards
            cumulativeRewards={cumulativeRewards}
            withdrawAddresses={withdrawAddresses}
            enabledNetworks={enabledNetworks}
            fetchSummaryInfo={fetchSummaryInfo}
          />
        </Stack>
        <Stack flex={1}>
          <ReferralCodeCard inviteUrl={inviteUrl} inviteCode={inviteCode} />
        </Stack>
      </Stack>
      <YStack px="$5" py="$4">
        <Button
          variant="secondary"
          size="medium"
          onPress={handleViewLevelDetail}
          icon="TrophyOutline"
        >
          查看等级详情
        </Button>
      </YStack>
      <Dashboard
        onChain={Onchain}
        hardwareSales={HardwareSales}
        levelPercent={Number(levelPercent)}
        rebateLevels={rebateLevels}
        rebateConfig={rebateConfig}
      />
      <FAQ faqs={faqs} />
      <Link />
    </>
  );
}

function InviteRewardPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const {
    result: summaryInfo,
    run: fetchSummaryInfo,
    isLoading,
  } = usePromiseResult(
    async () => {
      try {
        return await backgroundApiProxy.serviceReferralCode.getSummaryInfo();
      } catch (error) {
        if (error instanceof OneKeyServerApiError) {
          // Silently swallow known backend errors so we can show fallback UI
          console.warn('InviteRewardPage getSummaryInfo failed:', error);
          return undefined;
        }
        throw error;
      }
    },
    [],
    {
      initResult: undefined,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      undefinedResultIfError: true,
      watchLoading: true,
    },
  );

  const isFetching = isLoading ?? summaryInfo === undefined;

  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.ReferFriends}
      />
      <Page.Body>
        {(() => {
          if (isFetching) {
            return (
              <Stack
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
              </Stack>
            );
          }

          if (summaryInfo) {
            return (
              <ScrollView>
                <InviteRewardContent
                  summaryInfo={summaryInfo}
                  fetchSummaryInfo={fetchSummaryInfo}
                />
              </ScrollView>
            );
          }

          return (
            <Stack flex={1} ai="center" jc="center" px="$5">
              <Empty
                icon="GiftOutline"
                title={intl.formatMessage({
                  id: ETranslations.referral_referred_empty,
                })}
                description={intl.formatMessage({
                  id: ETranslations.referral_referred_empty_desc,
                })}
                button={
                  <Button
                    size="medium"
                    variant="primary"
                    onPress={() => {
                      navigation.replace(
                        ETabReferFriendsRoutes.TabReferAFriend,
                      );
                    }}
                  >
                    {intl.formatMessage({
                      id: ETranslations.referral_invite_via,
                    })}
                  </Button>
                }
              />
            </Stack>
          );
        })()}
      </Page.Body>
    </Page>
  );
}

export default function InviteReward() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <InviteRewardPage />
    </AccountSelectorProviderMirror>
  );
}
