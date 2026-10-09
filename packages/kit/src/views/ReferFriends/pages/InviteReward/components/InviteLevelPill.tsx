import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  Image,
  Popover,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { RetentionStatus } from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferralLevel/components/LevelStatusCard';
import {
  formatLevelTargetRemaining,
  getLevelTargetLabel,
} from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferralLevel/components/UpgradeTargetsCard';
import { getLevelOverview } from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferralLevel/getLevelOverview';
import type { ILevelOverview } from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferralLevel/getLevelOverview';
import { useNavigateToReferralLevel } from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferralLevel/hooks/useNavigateToReferralLevel';
import { LEVEL_COPY } from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferralLevel/levelCopy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInviteLevelDetail } from '@onekeyhq/shared/src/referralCode/type';

import { ReferFriendsTestIDs } from '../../../testIDs';

import { useCurrentLevelCardFromDetail } from './CurrentLevelCard/hooks/useCurrentLevelCard';
import {
  INVITE_POPOVER_PANEL_PROPS,
  PRESSABLE_SURFACE_PROPS,
} from './useInviteCardStyle';

import type { ICurrentLevelCardProps } from './CurrentLevelCard/types';

// Desktop hover summary: whether the level holds this month and the gap to
// the next one. The full breakdown stays on the level page.
function LevelSummary({
  overview,
  onOpenLevel,
}: {
  overview: ILevelOverview;
  onOpenLevel: () => void;
}) {
  const intl = useIntl();
  const currencyCode = useCurrency().id.toUpperCase();
  const { retentionStatus, nextLevel, upgradeTargets } = overview;

  return (
    <YStack px="$5" py="$4" gap="$3">
      <RetentionStatus status={retentionStatus} />
      {nextLevel && upgradeTargets.length > 0 ? (
        <YStack gap="$1.5">
          <YStack pb="$1">
            <XStack ai="center" gap="$2">
              {nextLevel.icon ? (
                <Image w="$4" h="$4" src={nextLevel.icon} />
              ) : null}
              <SizableText size="$bodyMdMedium">
                {LEVEL_COPY.nextLevel(nextLevel.label)}
              </SizableText>
            </XStack>
            <SizableText size="$bodySm" color="$textSubdued">
              {LEVEL_COPY.upgradeRule(upgradeTargets.length > 1)}
            </SizableText>
          </YStack>
          {upgradeTargets.map((target) => (
            <XStack
              key={target.subject}
              ai="center"
              jc="space-between"
              gap="$3"
            >
              <SizableText size="$bodyMd" numberOfLines={1} flexShrink={1}>
                {getLevelTargetLabel(intl, target)}
              </SizableText>
              <SizableText
                size="$bodyMdMedium"
                color={target.isReached ? '$textSuccess' : '$text'}
              >
                {formatLevelTargetRemaining(target, currencyCode)}
              </SizableText>
            </XStack>
          ))}
        </YStack>
      ) : null}
      {nextLevel ? null : (
        <SizableText size="$bodyMdMedium">{LEVEL_COPY.topLevel}</SizableText>
      )}
      <XStack pt="$2">
        <Button
          testID={ReferFriendsTestIDs.inviteLevelDetailsBtn}
          variant="tertiary"
          size="small"
          iconAfter="ChevronRightSmallOutline"
          onPress={onOpenLevel}
        >
          {LEVEL_COPY.levelDetails}
        </Button>
      </XStack>
    </YStack>
  );
}

export function InviteLevelPill({
  levelDetail,
  ...props
}: ICurrentLevelCardProps & {
  levelDetail: IInviteLevelDetail | undefined;
}) {
  const { levelLabel, levelIcon } = useCurrentLevelCardFromDetail(
    props,
    levelDetail,
  );
  const navigateToReferralLevel = useNavigateToReferralLevel();
  const { gtMd } = useMedia();
  const overview = useMemo(
    () => (levelDetail ? getLevelOverview(levelDetail) : undefined),
    [levelDetail],
  );

  const pill = (
    <XStack
      testID={ReferFriendsTestIDs.inviteLevelPill}
      ai="center"
      gap="$1"
      px="$2"
      py="$1"
      borderRadius="$full"
      // The pill sits on the page canvas, so it takes the card surface.
      bg="$bg"
      flexShrink={1}
      {...PRESSABLE_SURFACE_PROPS}
      onPress={() => {
        void navigateToReferralLevel();
        // Returning false keeps a hover popover trigger from also opening.
        return false;
      }}
    >
      {/* Prefer the level's own artwork; the emoji is only a fallback. */}
      {levelIcon ? <Image w="$4" h="$4" src={levelIcon} /> : null}
      {!levelIcon && props.rebateConfig.emoji ? (
        <SizableText size="$bodyMd">{props.rebateConfig.emoji}</SizableText>
      ) : null}
      <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
        {levelLabel}
      </SizableText>
      <Icon name="ChevronRightSmallOutline" size="$4" color="$iconSubdued" />
    </XStack>
  );

  // Hover only exists with a pointer; touch layouts go straight to the page.
  if (!gtMd || platformEnv.isNative || !overview?.currentLevel) {
    return pill;
  }

  return (
    <Popover
      title={levelLabel}
      hoverable
      placement="bottom-end"
      floatingPanelProps={INVITE_POPOVER_PANEL_PROPS}
      renderTrigger={pill}
      renderContent={({ closePopover }) => (
        <LevelSummary
          overview={overview}
          onOpenLevel={() => {
            closePopover();
            void navigateToReferralLevel();
          }}
        />
      )}
    />
  );
}

// Compact layouts: the header has no room beside the rules button, so the
// level sits beside the in-content title tabs as a chip.
export function InviteLevelChip({
  levelDetail,
  ...props
}: ICurrentLevelCardProps & {
  levelDetail: IInviteLevelDetail | undefined;
}) {
  const navigateToReferralLevel = useNavigateToReferralLevel();
  const { levelLabel, levelIcon } = useCurrentLevelCardFromDetail(
    props,
    levelDetail,
  );

  return (
    <XStack
      testID={ReferFriendsTestIDs.inviteLevelPill}
      ai="center"
      gap="$1"
      pl="$1.5"
      pr="$1"
      py="$0.5"
      borderRadius="$full"
      // Same tint as the cards, so it reads as part of the page's surfaces.
      bg="$bgSubdued"
      flexShrink={0}
      {...PRESSABLE_SURFACE_PROPS}
      onPress={() => {
        void navigateToReferralLevel();
      }}
    >
      {levelIcon ? <Image w="$4" h="$4" src={levelIcon} /> : null}
      {!levelIcon && props.rebateConfig.emoji ? (
        <SizableText size="$bodySm">{props.rebateConfig.emoji}</SizableText>
      ) : null}
      <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
        {levelLabel}
      </SizableText>
      <Icon name="ChevronRightSmallOutline" size="$4" color="$iconSubdued" />
    </XStack>
  );
}
