import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Divider,
  Icon,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteLevelItem } from '@onekeyhq/shared/src/referralCode/type';

import { LEVEL_COPY } from '../levelCopy';

import type { ILevelRetentionStatus } from '../getLevelOverview';

function RetentionStatus({ status }: { status: ILevelRetentionStatus }) {
  if (status === 'none') {
    return null;
  }
  const isKept = status === 'kept';
  return (
    <XStack ai="center" gap="$2" flex={1}>
      <Icon
        name={isKept ? 'CheckRadioSolid' : 'InfoCircleSolid'}
        size="$6"
        color={isKept ? '$iconSuccess' : '$iconCaution'}
      />
      <SizableText size="$bodyLgMedium">
        {isKept ? LEVEL_COPY.levelKept : LEVEL_COPY.levelNotKept}
      </SizableText>
    </XStack>
  );
}

export function LevelStatusCard({
  level,
  retentionStatus,
}: {
  level: IInviteLevelItem;
  retentionStatus: ILevelRetentionStatus;
}) {
  const intl = useIntl();
  const { md } = useMedia();

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

  return (
    <XStack
      ai="center"
      gap="$4"
      p="$4"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$3"
      flexWrap="wrap"
    >
      <XStack ai="center" gap="$3">
        <Stack w="$12" h="$12" ai="center" jc="center">
          {level.icon ? (
            <Image w="$12" h="$12" src={level.icon} />
          ) : (
            <SizableText size="$heading2xl">{level.emoji}</SizableText>
          )}
        </Stack>
        <YStack>
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.referral_current_level })}
          </SizableText>
          <SizableText size="$headingXl">{level.label}</SizableText>
        </YStack>
      </XStack>
      {!md && retentionStatus !== 'none' ? <Divider vertical h="$10" /> : null}
      <RetentionStatus status={retentionStatus} />
      <XStack
        ai="center"
        gap="$0.5"
        cursor="pointer"
        role="button"
        onPress={showRules}
      >
        <SizableText size="$bodyMd" color="$textSubdued">
          {LEVEL_COPY.levelRules}
        </SizableText>
        <Icon name="ChevronRightSmallOutline" size="$4" color="$iconSubdued" />
      </XStack>
    </XStack>
  );
}
