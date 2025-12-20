import type { IKeyOfIcons } from '@onekeyhq/components';
import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';

export interface ICardTitleProps {
  icon: IKeyOfIcons;
  title: string;
  description: string;
  showChevron?: boolean;
  onPress?: () => void;
}

export function CardTitle({
  icon,
  title,
  description,
  showChevron = true,
  onPress,
}: ICardTitleProps) {
  return (
    <YStack gap="$1">
      <XStack
        ai="center"
        jc="space-between"
        onPress={onPress}
        cursor={onPress ? 'pointer' : undefined}
      >
        <XStack gap="$1" ai="center">
          <Icon name={icon} size="$5" />
          <SizableText size="$headingMd" letterSpacing={-0.32}>
            {title}
          </SizableText>
        </XStack>
        {showChevron ? (
          <Icon size="$4.5" color="$iconSubdued" name="ChevronRightOutline" />
        ) : null}
      </XStack>
      <SizableText size="$bodyMd" color="$textSubdued" letterSpacing={-0.15}>
        {description}
      </SizableText>
    </YStack>
  );
}
