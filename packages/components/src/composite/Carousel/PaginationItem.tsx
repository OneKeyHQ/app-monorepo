import { XStack, YStack } from '../../primitives';

import type { IYStackProps } from '../../primitives';

export type IDotStyle = IYStackProps;

export type IPaginationItemProps<T> = {
  index: number;
  dotStyle?: IDotStyle;
  activeDotStyle?: IDotStyle;
  onPress: () => void;
};

export function PaginationItem<T>({
  dotStyle,
  activeDotStyle,
  onPress,
}: IPaginationItemProps<T>) {
  return (
    <YStack
      onPress={onPress}
      w="$2.5"
      h="$2.5"
      borderRadius="$full"
      bg="$neutral5"
      {...dotStyle}
      {...activeDotStyle}
    />
  );
}
