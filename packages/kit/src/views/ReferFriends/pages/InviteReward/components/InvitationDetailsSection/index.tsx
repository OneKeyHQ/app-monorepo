import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { XStack, YStack, useMedia } from '@onekeyhq/components';
import {
  ResponsiveFourColumnLayout,
  SimpleTabs,
} from '@onekeyhq/kit/src/views/ReferFriends/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { HardwareSalesReward } from '../HardwareSalesReward';
import { OnChainReward } from '../OnChainReward';
import { PerpsReward } from '../PerpsReward';
import { SectionHeader } from '../SectionHeader';
import { SwapReward } from '../SwapReward';

import { CreateCodeButton } from './components/CreateCodeButton';
import { InviteCodeListTable } from './components/InviteCodeListTable';
import { useInviteCodeList } from './hooks/useInviteCodeList';
import { EInvitationDetailsTab } from './types';

import type { IInvitationDetailsSectionProps } from './types';

export function InvitationDetailsSection({
  summaryInfo,
  fetchSummaryInfo,
}: IInvitationDetailsSectionProps) {
  const intl = useIntl();
  const { lg } = useMedia();
  const [selectedTab, setSelectedTab] = useState<EInvitationDetailsTab>(
    EInvitationDetailsTab.REWARD,
  );

  // Fetch invite code list data
  const { codeListData, isLoading, refetch } = useInviteCodeList();

  const handleCodeCreated = useCallback(() => {
    void refetch();
    if (selectedTab === EInvitationDetailsTab.REWARD) {
      setSelectedTab(EInvitationDetailsTab.REFERRAL);
    }
  }, [refetch, selectedTab]);

  const handleCodeUpdated = useCallback(
    async (shouldRefreshSummary?: boolean) => {
      if (shouldRefreshSummary) {
        fetchSummaryInfo();
      }
      await refetch();
    },
    [fetchSummaryInfo, refetch],
  );

  const tabs = useMemo(
    () => [
      {
        value: EInvitationDetailsTab.REWARD,
        label: intl.formatMessage({
          id: ETranslations.referral_reward_history_reward_title,
        }),
      },
      {
        value: EInvitationDetailsTab.REFERRAL,
        label: intl.formatMessage({ id: ETranslations.referral_your_code }),
      },
    ],
    [intl],
  );

  if (!summaryInfo) {
    return null;
  }

  const { HardwareSales, Onchain, Perp, cumulativeRewards, inviteUrl } =
    summaryInfo;

  return (
    <YStack gap="$4" pb="$6" $md={{ flexDirection: 'column' }}>
      <XStack px="$pagePadding" pb="$1">
        <SectionHeader
          translationId={ETranslations.referral_invitation_details}
        />
      </XStack>

      <XStack
        gap="$2"
        px="$pagePadding"
        alignItems="center"
        jc="space-between"
        flexWrap="wrap"
      >
        <SimpleTabs value={selectedTab} onChange={setSelectedTab} tabs={tabs} />

        {selectedTab === EInvitationDetailsTab.REFERRAL ? (
          <XStack pl="$4">
            <CreateCodeButton
              remainingCodes={codeListData?.remainingCodes}
              onCodeCreated={handleCodeCreated}
              inviteUrlTemplate={inviteUrl}
            />
          </XStack>
        ) : null}
      </XStack>

      {selectedTab === EInvitationDetailsTab.REWARD ? (
        <ResponsiveFourColumnLayout
          gap={lg ? '$3' : '$4'}
          firstColumn={
            <HardwareSalesReward
              hardwareSales={HardwareSales}
              nextDistribution={cumulativeRewards.nextDistribution}
            />
          }
          secondColumn={<PerpsReward perpsRewards={Perp.available} />}
          thirdColumn={<SwapReward swapRewards={Onchain.swap ?? []} />}
          fourthColumn={<OnChainReward onChain={Onchain} />}
        />
      ) : (
        <YStack px="$pagePadding" gap="$4">
          <InviteCodeListTable
            codeListData={codeListData}
            isLoading={isLoading ?? false}
            refetch={refetch}
            onCodeUpdated={handleCodeUpdated}
          />
        </YStack>
      )}
    </YStack>
  );
}
