import { useIntl } from 'react-intl';

import {
  Page,
  ScrollView,
  Spinner,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { CumulativeRewards } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/CumulativeRewards';
import { CurrentLevelCard } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/CurrentLevelCard';
import { InvitationDetailsSection } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/InvitationDetailsSection';
import { ReferralCodeCard } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/ReferralCodeCard';
import { RulesButton } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/RulesButton';
import { SectionHeader } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/SectionHeader';
import { ResponsiveTwoColumnLayout } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/shared';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

function InviteRewardContent({
  summaryInfo,
  fetchSummaryInfo,
}: {
  summaryInfo: IInviteSummary;
  fetchSummaryInfo: () => void;
}) {
  const {
    inviteUrl,
    inviteCode,
    enabledNetworks,
    cumulativeRewards,
    rebateLevels,
    rebateConfig,
    withdrawAddresses,
  } = summaryInfo;

  return (
    <>
      <XStack px="$5" py="$5" jc="space-between">
        <SectionHeader translationId={ETranslations.global_overview} />

        <RulesButton />
      </XStack>

      <ResponsiveTwoColumnLayout
        reverseOnMobile
        leftColumn={
          <CumulativeRewards
            cumulativeRewards={cumulativeRewards}
            withdrawAddresses={withdrawAddresses}
            enabledNetworks={enabledNetworks}
            fetchSummaryInfo={fetchSummaryInfo}
          />
        }
        rightColumn={
          <ReferralCodeCard inviteUrl={inviteUrl} inviteCode={inviteCode} />
        }
      />

      <YStack py="$5">
        <CurrentLevelCard
          rebateConfig={rebateConfig}
          rebateLevels={rebateLevels}
        />
      </YStack>

      <InvitationDetailsSection summaryInfo={summaryInfo} />
    </>
  );
}

function InviteRewardPage() {
  const intl = useIntl();
  const { md } = useMedia();
  // Redirect to ReferAFriend page if user is not logged in
  useRedirectWhenNotLoggedIn();

  const {
    result: summaryInfo,
    run: fetchSummaryInfo,
    isLoading,
  } = usePromiseResult(
    async () => {
      return backgroundApiProxy.serviceReferralCode.getSummaryInfo();
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
      {platformEnv.isNative || md ? (
        <Page.Header
          title={intl.formatMessage({
            id: ETranslations.earn_referral_view_rewards,
          })}
        />
      ) : (
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.ReferFriends}
        />
      )}
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

          return null;
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
