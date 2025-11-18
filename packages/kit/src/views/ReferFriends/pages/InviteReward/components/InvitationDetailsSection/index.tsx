import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { XStack, YStack } from '@onekeyhq/components';
import { SimpleTabs } from '@onekeyhq/kit/src/views/ReferFriends/components/SimpleTabs';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { HardwareSalesReward } from '../HardwareSalesReward';
import { OnChainReward } from '../OnChainReward';
import { SectionHeader } from '../SectionHeader';
import { ResponsiveTwoColumnLayout } from '../shared';

import { CreateCodeButton } from './components/CreateCodeButton';
import { InviteCodeListTable } from './components/InviteCodeListTable';
import { useInviteCodeList } from './hooks/useInviteCodeList';
import { EInvitationDetailsTab } from './types';

import type { IInvitationDetailsSectionProps } from './types';

export function InvitationDetailsSection({
  summaryInfo,
}: IInvitationDetailsSectionProps) {
  const intl = useIntl();
  const [selectedTab, setSelectedTab] = useState<EInvitationDetailsTab>(
    EInvitationDetailsTab.REWARD,
  );

  // Fetch invite code list data
  const { codeListData, isLoading, refetch } = useInviteCodeList();

  // Handle code creation: refresh list and switch to table tab if on reward tab
  const handleCodeCreated = () => {
    refetch();
    if (selectedTab === EInvitationDetailsTab.REWARD) {
      setSelectedTab(EInvitationDetailsTab.REFERRAL);
    }
  };

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

  const { HardwareSales, Onchain, cumulativeRewards, inviteUrl } = summaryInfo;

  return (
    <YStack gap="$4" pb="$6" $md={{ flexDirection: 'column' }}>
      <XStack px="$5" pb="$1">
        <SectionHeader
          translationId={ETranslations.referral_invitation_details}
        />
      </XStack>

      <XStack gap="$2" px="$5" alignItems="center" jc="space-between">
        <SimpleTabs value={selectedTab} onChange={setSelectedTab} tabs={tabs} />

        {selectedTab === EInvitationDetailsTab.REFERRAL ? (
          <CreateCodeButton
            remainingCodes={codeListData?.remainingCodes}
            onCodeCreated={handleCodeCreated}
            inviteUrlTemplate={inviteUrl}
          />
        ) : null}
      </XStack>

      {selectedTab === EInvitationDetailsTab.REWARD ? (
        <ResponsiveTwoColumnLayout
          leftColumn={
            <HardwareSalesReward
              hardwareSales={HardwareSales}
              nextDistribution={cumulativeRewards.nextDistribution}
            />
          }
          rightColumn={<OnChainReward onChain={Onchain} />}
        />
      ) : (
        <YStack px="$5" gap="$4">
          <InviteCodeListTable
            codeListData={codeListData}
            isLoading={isLoading ?? false}
            refetch={refetch}
          />
        </YStack>
      )}
    </YStack>
  );
}
