import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function UnifoldDepositHistoryCard({
  trackedCount,
  onPress,
}: {
  trackedCount: number;
  onPress: () => void;
}) {
  const intl = useIntl();
  const countLabel = trackedCount > 99 ? '99+' : String(trackedCount);

  return (
    <XStack
      testID="perps-unifold-deposit-history-card"
      role="button"
      height="$10"
      px="$2.5"
      gap="$2"
      alignItems="center"
      cursor="pointer"
      bg="$bgSubdued"
      borderWidth="$px"
      borderColor="$borderSubdued"
      borderRadius="$2"
      hoverStyle={{ bg: '$bgStrongHover' }}
      pressStyle={{ bg: '$bgStrongActive' }}
      onPress={onPress}
    >
      <SizableText
        size="$bodySm"
        color="$textSubdued"
        numberOfLines={1}
        flex={1}
        minWidth={0}
      >
        {intl.formatMessage({
          id: ETranslations.perp_unifold_track_progress__desc,
        })}
      </SizableText>
      {trackedCount > 0 ? (
        <Stack
          minWidth={countLabel.length > 2 ? '$5' : '$4'}
          h="$4"
          px="$1"
          alignItems="center"
          justifyContent="center"
          borderRadius="$full"
          bg="$bgSuccessStrong"
          flexShrink={0}
        >
          <SizableText size="$bodyXsMedium" color="$textOnColor">
            {countLabel}
          </SizableText>
        </Stack>
      ) : null}
      <Icon name="ChevronRightSmallOutline" size="$4" color="$icon" />
    </XStack>
  );
}
