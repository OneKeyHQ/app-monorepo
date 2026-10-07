import { useCallback, useState } from 'react';

import { YStack } from '@onekeyhq/components';
import { ResponsiveTwoColumnLayout } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/shared';
import type {
  IInviteLevelDetail,
  IInviteSummary,
} from '@onekeyhq/shared/src/referralCode/type';

import { InviteBindRow } from './InviteBindRow';
import { InviteCodeManager } from './InviteCodeManager';
import { InviteEarningsCard } from './InviteEarningsCard';
import { InviteLinkHero } from './InviteLinkHero';
import { InviteRewardRows } from './InviteRewardRows';
import { SuspensionAlert } from './SuspensionAlert';

export function InviteTabContent({
  summaryInfo,
  fetchSummaryInfo,
  levelDetail,
}: {
  summaryInfo: IInviteSummary;
  fetchSummaryInfo: () => void;
  levelDetail: IInviteLevelDetail | undefined;
}) {
  const [isCodesOpen, setIsCodesOpen] = useState(false);
  const toggleManageCodes = useCallback(() => {
    setIsCodesOpen((open) => !open);
  }, []);

  return (
    <YStack pb="$6">
      <SuspensionAlert
        suspensionNotice={summaryInfo.suspensionNotice}
        suspensionContactLabel={summaryInfo.suspensionContactLabel}
      />

      <ResponsiveTwoColumnLayout
        leftColumn={
          <YStack
            gap="$3"
            borderWidth={1}
            borderColor="$borderSubdued"
            borderRadius="$3"
            p="$4"
            $md={{ borderWidth: 0, p: '$0' }}
          >
            <InviteLinkHero
              inviteUrl={summaryInfo.inviteUrl}
              inviteCode={summaryInfo.inviteCode}
              rebateConfig={summaryInfo.rebateConfig}
              rebateLevels={summaryInfo.rebateLevels}
              onToggleManageCodes={toggleManageCodes}
              levelDetail={levelDetail}
            />
            <InviteBindRow />
          </YStack>
        }
        rightColumn={<InviteEarningsCard summaryInfo={summaryInfo} />}
      />

      <InviteRewardRows summaryInfo={summaryInfo} />
      {isCodesOpen ? (
        <InviteCodeManager
          inviteUrl={summaryInfo.inviteUrl}
          fetchSummaryInfo={fetchSummaryInfo}
        />
      ) : null}
    </YStack>
  );
}
