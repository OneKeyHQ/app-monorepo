import { Page, ScrollView, Spinner, Stack, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { CumulativeRewards } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/CumulativeRewards';
import { CurrentLevelCard } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/CurrentLevelCard';
import { InvitationDetailsSection } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/InvitationDetailsSection';
import { ReferralCodeCard } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/ReferralCodeCard';
import { RulesButton } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/RulesButton';
import { SectionHeader } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/SectionHeader';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
      <XStack px="$5" pt="$5" jc="flex-end">
        <RulesButton />
      </XStack>
      <SectionHeader translationId={ETranslations.global_overview} />
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
      <CurrentLevelCard
        rebateConfig={rebateConfig}
        rebateLevels={rebateLevels}
      />

      <InvitationDetailsSection summaryInfo={summaryInfo} />
    </>
  );
}

function InviteRewardPage() {
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
