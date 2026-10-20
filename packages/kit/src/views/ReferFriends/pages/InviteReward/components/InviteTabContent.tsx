import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { XStack, YStack, useMedia } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useNavigateToInviteCodes } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteCodes/hooks/useNavigateToInviteCodes';
import { useNavigateToYourReferred } from '@onekeyhq/kit/src/views/ReferFriends/pages/YourReferred/hooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IInviteLevelDetail,
  IInviteSummary,
} from '@onekeyhq/shared/src/referralCode/type';

import { ReferFriendsTestIDs } from '../../../testIDs';
import { REFERRAL_TAB_COPY } from '../referralTabCopy';

import { InviteCompactHero } from './InviteCompactHero';
import { InviteEarningsCard } from './InviteEarningsCard';
import { InviteCompactCard, InviteLinkHero } from './InviteLinkHero';
import { InviteRewardRows } from './InviteRewardRows';
import { ReferralTabCrossLink } from './ReferralTabCrossLink';
import { useInviteValueSummary } from './InviteValueLine';
import { SuspensionAlert } from './SuspensionAlert';
import {
  COMPACT_ENTRY_TITLE_PROPS,
  COMPACT_ROW_BLEED_PROPS,
  COMPACT_ROW_ICON_PROPS,
  useInviteHomeCardStyle,
} from './useInviteCardStyle';

import type { IInviteCardStyle } from './useInviteCardStyle';

// Compact layouts: the two pages about your invites (the codes, and the
// wallets and orders they brought in) as rows under the code card, instead
// of links on card headers. Payout history opens from the paid amount.
function InviteManageLinks({
  cardStyle,
  onManageCodes,
}: {
  cardStyle: IInviteCardStyle;
  onManageCodes: () => void;
}) {
  const intl = useIntl();
  const navigateToYourReferred = useNavigateToYourReferred();
  const links = [
    {
      testID: ReferFriendsTestIDs.inviteManageCodes,
      icon: 'TagOutline' as const,
      title: ETranslations.referral_manage_codes__action,
      onPress: onManageCodes,
    },
    {
      testID: ReferFriendsTestIDs.inviteYourReferred,
      icon: 'PeopleTogetherOutline' as const,
      title: ETranslations.referral_referral_list,
      onPress: navigateToYourReferred,
    },
  ];
  return (
    <YStack px="$4" py="$1" {...cardStyle}>
      {links.map((link) => (
        <ListItem
          key={link.testID}
          testID={link.testID}
          {...COMPACT_ROW_BLEED_PROPS}
          // Icons like the product rows below, so the lists scan alike.
          icon={link.icon}
          iconProps={COMPACT_ROW_ICON_PROPS}
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
  onOpenPerks,
}: {
  summaryInfo: IInviteSummary;
  fetchSummaryInfo: () => unknown;
  levelDetail: IInviteLevelDetail | undefined;
  // Absent while the Perks tab is turned off.
  onOpenPerks?: () => void;
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
    <YStack flex={1} pb="$6">
      <SuspensionAlert
        suspensionNotice={summaryInfo.suspensionNotice}
        suspensionContactLabel={summaryInfo.suspensionContactLabel}
      />

      {md ? (
        // Compact layouts open on inviting: the hero (illustration, what
        // each side gets, the level) over the code card and the pages about
        // your invites. The money follows a scroll away. Cards sit 20px
        // apart inside a group, 32px between groups, roomy enough for touch.
        // Sharing itself sits in the page footer.
        <YStack px="$pagePadding" gap="$8">
          <YStack gap="$5">
            <InviteCompactHero
              valueSummary={valueSummary}
              rebateConfig={summaryInfo.rebateConfig}
              rebateLevels={summaryInfo.rebateLevels}
              levelDetail={levelDetail}
            />
            {/* The code card and the pages about your invites read as one
                group: closer to each other than to the hero. */}
            <YStack gap="$3">
              <InviteCompactCard
                inviteUrl={inviteUrl}
                inviteCode={summaryInfo.inviteCode}
                cardStyle={cardStyle}
              />
              <InviteManageLinks
                cardStyle={cardStyle}
                onManageCodes={handleManageCodes}
              />
            </YStack>
          </YStack>
          <YStack gap="$5">
            <InviteEarningsCard
              summaryInfo={summaryInfo}
              fetchSummaryInfo={fetchSummaryInfo}
            />
            <InviteRewardRows summaryInfo={summaryInfo} />
          </YStack>
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
      {onOpenPerks ? (
        <ReferralTabCrossLink
          testID="refer-friends-to-perks-link"
          prompt={REFERRAL_TAB_COPY.toPerksPrompt}
          action={REFERRAL_TAB_COPY.toPerksAction}
          onPress={onOpenPerks}
        />
      ) : null}
    </YStack>
  );
});
