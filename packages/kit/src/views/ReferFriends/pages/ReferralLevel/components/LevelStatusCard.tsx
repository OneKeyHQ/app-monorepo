import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Divider,
  Icon,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  INVITE_CARD_BORDER_COLOR,
  useInviteListCardStyle,
} from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/useInviteCardStyle';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteLevelItem } from '@onekeyhq/shared/src/referralCode/type';

import { ReferFriendsTestIDs } from '../../../testIDs';
import { LEVEL_COPY } from '../levelCopy';

import { UpgradeTargetsSection } from './UpgradeTargetsCard';

import type { ILevelRetentionStatus, ILevelTarget } from '../getLevelOverview';

export function RetentionStatus({ status }: { status: ILevelRetentionStatus }) {
  if (status === 'none') {
    return null;
  }
  const isKept = status === 'kept';
  return (
    <XStack ai="center" gap="$1.5">
      <Icon
        name={isKept ? 'CheckRadioSolid' : 'InfoCircleSolid'}
        size="$4"
        color={isKept ? '$iconSuccess' : '$iconCaution'}
      />
      <SizableText
        size="$bodyMdMedium"
        color={isKept ? '$textSuccess' : '$textCaution'}
      >
        {isKept ? LEVEL_COPY.levelKept : LEVEL_COPY.levelNotKept}
      </SizableText>
    </XStack>
  );
}

// One card answers both "where am I" (top) and "how do I move up" (below the
// divider); the top level only gets a short note instead of targets.
export function LevelStatusCard({
  level,
  retentionStatus,
  nextLevel,
  upgradeTargets,
}: {
  level: IInviteLevelItem;
  retentionStatus: ILevelRetentionStatus;
  nextLevel?: IInviteLevelItem;
  upgradeTargets: ILevelTarget[];
}) {
  const intl = useIntl();
  const cardStyle = useInviteListCardStyle();

  const showRules = useCallback(() => {
    Dialog.show({
      title: LEVEL_COPY.levelRules,
      showFooter: false,
      renderContent: (
        <YStack gap="$2">
          <SizableText size="$bodyMd">
            {intl.formatMessage({
              id: ETranslations.referral_referral_level_desc1,
            })}
          </SizableText>
          <SizableText size="$bodyMd">
            {intl.formatMessage({
              id: ETranslations.referral_referral_level_desc2,
            })}
          </SizableText>
        </YStack>
      ),
    });
  }, [intl]);

  const hasTargets = Boolean(nextLevel) && upgradeTargets.length > 0;

  return (
    <YStack
      gap="$5"
      p="$5"
      // A thin progress bar ends the card on phones; past the usual 16px it
      // reads as a divider rather than the card's end, so the bottom gets the
      // page's 24px group spacing.
      $md={{ p: '$4', pb: hasTargets ? '$6' : '$4', gap: '$4' }}
      {...cardStyle}
    >
      <XStack ai="center" gap="$4">
        <Stack w="$12" h="$12" ai="center" jc="center" flexShrink={0}>
          {level.icon ? (
            <Image w="$12" h="$12" src={level.icon} />
          ) : (
            <SizableText size="$heading2xl">{level.emoji}</SizableText>
          )}
        </Stack>
        <YStack flex={1} minWidth={0} gap="$0.5">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.referral_current_level })}
          </SizableText>
          <SizableText size="$headingXl" numberOfLines={1}>
            {level.label}
          </SizableText>
          <RetentionStatus status={retentionStatus} />
        </YStack>
        <Button
          testID={ReferFriendsTestIDs.levelRulesBtn}
          variant="tertiary"
          size="small"
          iconAfter="ChevronRightSmallOutline"
          onPress={showRules}
        >
          {LEVEL_COPY.levelRules}
        </Button>
      </XStack>
      <Divider borderColor={INVITE_CARD_BORDER_COLOR} />
      {nextLevel && hasTargets ? (
        <UpgradeTargetsSection nextLevel={nextLevel} targets={upgradeTargets} />
      ) : (
        <SizableText size="$bodyMd" color="$textSubdued">
          {LEVEL_COPY.topLevel}
        </SizableText>
      )}
    </YStack>
  );
}
