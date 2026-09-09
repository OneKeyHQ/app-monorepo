import type { ReactNode } from 'react';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Icon, SizableText, XStack } from '@onekeyhq/components';

export interface ICardTitleProps {
  icon: IKeyOfIcons;
  title: string;
  showChevron?: boolean;
  onPress?: () => void;
  badge?: ReactNode;
}

export function CardTitle({
  icon,
  title,
  showChevron = true,
  onPress,
  badge,
}: ICardTitleProps) {
  return (
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
        {badge}
      </XStack>
      {showChevron ? (
        <Icon size="$4.5" color="$iconSubdued" name="ChevronRightOutline" />
      ) : null}
    </XStack>
  );
}
