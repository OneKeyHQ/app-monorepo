import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type IDeFiOverviewLessTileProps = {
  onPress: () => void;
};

function DeFiOverviewLessTile({ onPress }: IDeFiOverviewLessTileProps) {
  const intl = useIntl();
  const showLessLabel = intl.formatMessage({
    id: ETranslations.global_show_less,
  });
  const collapseLabel = intl.formatMessage({
    id: ETranslations.global_collapse,
  });

  return (
    <XStack
      flex={1}
      bg="$bgApp"
      borderRadius="$3"
      borderWidth={1}
      borderStyle="dashed"
      borderColor="$borderSubdued"
      px="$4"
      py="$3.5"
      alignItems="center"
      gap="$3"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      cursor="pointer"
      onPress={onPress}
      role="button"
      aria-label={showLessLabel}
    >
      <Stack
        width={20}
        height={20}
        flexShrink={0}
        alignItems="center"
        justifyContent="center"
      >
        <Icon name="ChevronTopSmallSolid" size="$5" color="$iconSubdued" />
      </Stack>
      <YStack flex={1} minWidth={0} gap="$0.5">
        <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
          {showLessLabel}
        </SizableText>
        <SizableText size="$bodyLgMedium" numberOfLines={1}>
          {collapseLabel}
        </SizableText>
      </YStack>
    </XStack>
  );
}

export { DeFiOverviewLessTile };
