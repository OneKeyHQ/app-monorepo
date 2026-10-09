import { useIntl } from 'react-intl';

import {
  Divider,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useNavigateToInviteCodes } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteCodes/hooks/useNavigateToInviteCodes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IInviteLevelDetail,
  IInviteSummary,
} from '@onekeyhq/shared/src/referralCode/type';

import { InviteBindRow } from './InviteBindRow';
import { InviteEarningsCard } from './InviteEarningsCard';
import { InviteLevelChip } from './InviteLevelPill';
import {
  InviteCompactCard,
  InviteEntriesCard,
  InviteLinkHero,
} from './InviteLinkHero';
import { InviteRewardRows } from './InviteRewardRows';
import { useInviteValueSummary } from './InviteValueLine';
import { SuspensionAlert } from './SuspensionAlert';
import {
  INVITE_CARD_BORDER_COLOR,
  useInviteHomeCardStyle,
} from './useInviteCardStyle';

export function InviteTabContent({
  summaryInfo,
  fetchSummaryInfo,
  levelDetail,
  onLargeTitleLayout,
}: {
  summaryInfo: IInviteSummary;
  fetchSummaryInfo: () => unknown;
  levelDetail: IInviteLevelDetail | undefined;
  // Compact layouts title the page in the content; the page uses the title's
  // bottom edge to bring the header title back once it scrolls away.
  onLargeTitleLayout?: (bottom: number) => void;
}) {
  const intl = useIntl();
  const { md } = useMedia();
  const cardStyle = useInviteHomeCardStyle();
  const valueSummary = useInviteValueSummary({
    rebateConfig: summaryInfo.rebateConfig,
    rebateLevels: summaryInfo.rebateLevels,
    levelDetail,
  });
  const navigateToInviteCodes = useNavigateToInviteCodes();

  const inviteHero = (
    <InviteLinkHero
      inviteUrl={summaryInfo.inviteUrl}
      inviteCode={summaryInfo.inviteCode}
      valueSummary={valueSummary}
      onManageCodes={() => {
        navigateToInviteCodes(summaryInfo.inviteUrl);
      }}
    />
  );

  return (
    <YStack pb="$6">
      {md ? (
        <XStack
          px="$pagePadding"
          pt="$2"
          ai="center"
          jc="space-between"
          gap="$3"
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            onLargeTitleLayout?.(y + height);
          }}
        >
          <SizableText size="$heading4xl" flexShrink={1}>
            {intl.formatMessage({ id: ETranslations.referral_title })}
          </SizableText>
          <InviteLevelChip
            valueSummary={valueSummary}
            emoji={summaryInfo.rebateConfig.emoji}
          />
        </XStack>
      ) : null}
      <SuspensionAlert
        suspensionNotice={summaryInfo.suspensionNotice}
        suspensionContactLabel={summaryInfo.suspensionContactLabel}
      />

      {md ? (
        // Compact layouts: the invite card (code, link, rates), the bind
        // entry (only until linked), the earnings section and the entries
        // behind the invite card; sharing sits in the page footer.
        <YStack px="$pagePadding" pt="$5" gap="$5">
          <InviteCompactCard
            inviteUrl={summaryInfo.inviteUrl}
            inviteCode={summaryInfo.inviteCode}
            valueSummary={valueSummary}
            cardStyle={cardStyle}
          />
          <InviteBindRow variant="card" />
          <InviteEarningsCard
            summaryInfo={summaryInfo}
            fetchSummaryInfo={fetchSummaryInfo}
          />
          <InviteEntriesCard
            cardStyle={cardStyle}
            onManageCodes={() => {
              navigateToInviteCodes(summaryInfo.inviteUrl);
            }}
          />
        </YStack>
      ) : (
        // Desktop leads with earnings; the invite card sits beside it.
        <XStack px="$pagePadding" gap="$5" ai="stretch">
          <XStack flex={1} flexBasis={0} minWidth={0}>
            <InviteEarningsCard
              summaryInfo={summaryInfo}
              fetchSummaryInfo={fetchSummaryInfo}
            />
          </XStack>
          {/* Padding stays inside the flex item; on web a zero basis splits
              only the space left after padding, so a padded item would end up
              wider than its sibling. */}
          <XStack flex={1} flexBasis={0} minWidth={0}>
            <YStack flex={1} gap="$4" p="$5" {...cardStyle}>
              {inviteHero}
              <Divider borderColor={INVITE_CARD_BORDER_COLOR} />
              <InviteBindRow />
            </YStack>
          </XStack>
        </XStack>
      )}

      <InviteRewardRows summaryInfo={summaryInfo} />
    </YStack>
  );
}
