import { useCallback, useState } from 'react';

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
import { SuspensionAlert } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/SuspensionAlert';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { ReferFriendsPageContainer } from '../../components';

import { ReferralListButton } from './components/ReferralListButton';

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
    suspensionNotice,
    suspensionContactLabel,
  } = summaryInfo;

  return (
    <>
      <SuspensionAlert
        suspensionNotice={suspensionNotice}
        suspensionContactLabel={suspensionContactLabel}
      />

      <XStack px="$5" pt="$5" pb="$4" jc="space-between" ai="center">
        <SectionHeader translationId={ETranslations.global_overview} />

        <XStack $md={{ display: 'none' }}>
          <RulesButton />
        </XStack>

        <XStack $gtMd={{ display: 'none' }} $md={{ display: 'flex' }}>
          <ReferralListButton />
        </XStack>
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

  const [isFirstLoading, setIsFirstLoading] = useState(true);

  const renderHeaderRight = useCallback(() => <RulesButton />, []);

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
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 1 }), // Auto refresh every 1 minute
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      undefinedResultIfError: true,
      watchLoading: false, // Disable auto loading state for silent refresh
      onIsLoadingChange: (loading) => {
        // Only show loading on first fetch
        if (!loading && isFirstLoading) {
          setIsFirstLoading(false);
        }
      },
    },
  );

  const isFetching = isFirstLoading && (isLoading ?? summaryInfo === undefined);

  return (
    <Page>
      {platformEnv.isNative || md ? (
        <Page.Header
          title={intl.formatMessage({
            id: ETranslations.perps_trade_reward,
          })}
          headerRight={renderHeaderRight}
        />
      ) : (
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.ReferFriends}
          hideHeaderLeft={platformEnv.isDesktop}
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
                <ReferFriendsPageContainer>
                  <InviteRewardContent
                    summaryInfo={summaryInfo}
                    fetchSummaryInfo={fetchSummaryInfo}
                  />
                </ReferFriendsPageContainer>
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
