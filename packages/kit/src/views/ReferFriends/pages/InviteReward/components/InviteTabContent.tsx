import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { XStack, YStack, useMedia } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useNavigateToInviteCodes } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteCodes/hooks/useNavigateToInviteCodes';
import { useNavigateToRewardHistory } from '@onekeyhq/kit/src/views/ReferFriends/pages/RewardDistributionHistory/hooks/useNavigateToRewardHistory';
import { useNavigateToYourReferred } from '@onekeyhq/kit/src/views/ReferFriends/pages/YourReferred/hooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IInviteLevelDetail,
  IInviteSummary,
} from '@onekeyhq/shared/src/referralCode/type';

import { ReferFriendsTestIDs } from '../../../testIDs';

import { InviteCompactHero } from './InviteCompactHero';
import { InviteEarningsCard } from './InviteEarningsCard';
import { InviteCompactCard, InviteLinkHero } from './InviteLinkHero';
import { InviteRewardRows } from './InviteRewardRows';
import { useInviteValueSummary } from './InviteValueLine';
import { SuspensionAlert } from './SuspensionAlert';
import {
  COMPACT_ENTRY_TITLE_PROPS,
  COMPACT_ROW_BLEED_PROPS,
  useInviteHomeCardStyle,
} from './useInviteCardStyle';

import type { IInviteCardStyle } from './useInviteCardStyle';

// Compact layouts keep the cards above to sharing and the money; the pages
// people open less often sit together here, as rows, instead of as links on
// every card's header.
function InviteMoreLinks({
  cardStyle,
  onManageCodes,
}: {
  cardStyle: IInviteCardStyle;
  onManageCodes: () => void;
}) {
  const intl = useIntl();
  const navigateToYourReferred = useNavigateToYourReferred();
  const navigateToRewardHistory = useNavigateToRewardHistory();
  const links = [
    {
      testID: ReferFriendsTestIDs.inviteManageCodes,
      title: ETranslations.referral_manage_codes__action,
      onPress: onManageCodes,
    },
    {
      testID: ReferFriendsTestIDs.inviteYourReferred,
      title: ETranslations.referral_referral_list,
      onPress: navigateToYourReferred,
    },
    {
      testID: ReferFriendsTestIDs.inviteRewardHistory,
      title: ETranslations.referral_payout_history__title,
      onPress: navigateToRewardHistory,
    },
  ];
  return (
    <YStack px="$4" py="$1" {...cardStyle}>
      {links.map((link) => (
        <ListItem
          key={link.testID}
          testID={link.testID}
          {...COMPACT_ROW_BLEED_PROPS}
          titleProps={COMPACT_ENTRY_TITLE_PROPS}
          title={intl.formatMessage({ id: link.title })}
          drillIn
          onPress={link.onPress}
        />
      ))}
    </YStack>
  );
}

export const InviteTabContent = memo(function InviteTabContent({
  summaryInfo,
  fetchSummaryInfo,
  levelDetail,
}: {
  summaryInfo: IInviteSummary;
  fetchSummaryInfo: () => unknown;
  levelDetail: IInviteLevelDetail | undefined;
}) {
  const { md } = useMedia();
  const cardStyle = useInviteHomeCardStyle();
  const valueSummary = useInviteValueSummary({
    rebateConfig: summaryInfo.rebateConfig,
    rebateLevels: summaryInfo.rebateLevels,
    levelDetail,
  });
  const navigateToInviteCodes = useNavigateToInviteCodes();
  const { inviteUrl } = summaryInfo;
  const handleManageCodes = useCallback(() => {
    navigateToInviteCodes(inviteUrl);
  }, [inviteUrl, navigateToInviteCodes]);

  return (
    <YStack pb="$6">
      <SuspensionAlert
        suspensionNotice={summaryInfo.suspensionNotice}
        suspensionContactLabel={summaryInfo.suspensionContactLabel}
      />

      {md ? (
        // Compact layouts open on inviting: the hero (illustration, what
        // each side gets, the level) over the code card. The money follows
        // a scroll away, then the less used pages as one list. Cards sit
        // 20px apart inside a group, 32px between groups, roomy enough for
        // touch. Sharing itself sits in the page footer.
        <YStack px="$pagePadding" gap="$8">
          <YStack gap="$5">
            <InviteCompactHero
              valueSummary={valueSummary}
              rebateConfig={summaryInfo.rebateConfig}
              rebateLevels={summaryInfo.rebateLevels}
              levelDetail={levelDetail}
            />
            <InviteCompactCard
              inviteUrl={inviteUrl}
              inviteCode={summaryInfo.inviteCode}
              cardStyle={cardStyle}
            />
          </YStack>
          <YStack gap="$5">
            <InviteEarningsCard
              summaryInfo={summaryInfo}
              fetchSummaryInfo={fetchSummaryInfo}
            />
            <InviteRewardRows summaryInfo={summaryInfo} />
          </YStack>
          <InviteMoreLinks
            cardStyle={cardStyle}
            onManageCodes={handleManageCodes}
          />
        </YStack>
      ) : (
        <>
          {/* Desktop leads with earnings; the invite card sits beside it. */}
          <XStack px="$pagePadding" gap="$5" ai="stretch">
            <XStack flex={1} flexBasis={0} minWidth={0}>
              <InviteEarningsCard
                summaryInfo={summaryInfo}
                fetchSummaryInfo={fetchSummaryInfo}
              />
            </XStack>
            {/* Padding stays inside the flex item; on web a zero basis splits
                only the space left after padding, so a padded item would end
                up wider than its sibling. */}
            <XStack flex={1} flexBasis={0} minWidth={0}>
              <YStack flex={1} p="$5" {...cardStyle}>
                <InviteLinkHero
                  inviteUrl={inviteUrl}
                  inviteCode={summaryInfo.inviteCode}
                  valueSummary={valueSummary}
                  onManageCodes={handleManageCodes}
                />
              </YStack>
            </XStack>
          </XStack>
          <InviteRewardRows summaryInfo={summaryInfo} />
        </>
      )}
    </YStack>
  );
});
