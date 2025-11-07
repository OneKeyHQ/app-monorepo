import type { IKeyOfIcons } from '@onekeyhq/components';
import { Icon, SizableText, XStack } from '@onekeyhq/components';

export interface ICardHeaderProps {
  icon: IKeyOfIcons;
  title: string;
  showChevron?: boolean;
  onPress?: () => void;
}

export function CardHeader({
  icon,
  title,
  showChevron = true,
  onPress,
}: ICardHeaderProps) {
  return (
    <XStack
      ai="center"
      jc="space-between"
      onPress={onPress}
      cursor={onPress ? 'pointer' : undefined}
    >
      <XStack gap="$1" ai="center">
        <Icon name={icon} size="$5" />
        <SizableText size="$headingMd">{title}</SizableText>
      </XStack>
      {showChevron ? (
        <Icon size="$4.5" color="$iconSubdued" name="ChevronRightOutline" />
      ) : null}
    </XStack>
  );
}
