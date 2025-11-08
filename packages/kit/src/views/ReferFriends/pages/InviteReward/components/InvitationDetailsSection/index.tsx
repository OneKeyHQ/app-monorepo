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

import type { IInvitationDetailsSectionProps } from './types';

export function InvitationDetailsSection({
  summaryInfo,
}: IInvitationDetailsSectionProps) {
  const intl = useIntl();
  const [selectedTab, setSelectedTab] = useState<'reward' | 'referral'>(
    'reward',
  );

  // Fetch invite code list data
  const { codeListData, isLoading, refetch } = useInviteCodeList();

  const tabs = useMemo(
    () => [
      {
        value: 'reward' as const,
        label: intl.formatMessage({ id: ETranslations.earn_rewards }),
      },
      {
        value: 'referral' as const,
        label: intl.formatMessage({ id: ETranslations.referral_code_list }),
      },
    ],
    [intl],
  );

  if (!summaryInfo) {
    return null;
  }

  const { HardwareSales, Onchain, levelPercent, rebateLevels, rebateConfig } =
    summaryInfo;

  // Check if user can create more codes
  const canCreateCode = codeListData ? codeListData.remainingCodes > 0 : false;

  return (
    <YStack gap="$5" $md={{ flexDirection: 'column' }}>
      <SectionHeader
        translationId={ETranslations.referral_invitation_details}
      />

      <XStack gap="$2" px="$5" alignItems="center" jc="space-between">
        <SimpleTabs value={selectedTab} onChange={setSelectedTab} tabs={tabs} />

        {canCreateCode ? (
          <CreateCodeButton
            total={codeListData?.total}
            onCodeCreated={refetch}
          />
        ) : null}
      </XStack>

      {selectedTab === 'reward' ? (
        <YStack py="$8" px="$5">
          <ResponsiveTwoColumnLayout
            p="$0"
            leftColumn={
              <HardwareSalesReward hardwareSales={HardwareSales} />
            }
            rightColumn={<OnChainReward onChain={Onchain} />}
          />
        </YStack>
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
