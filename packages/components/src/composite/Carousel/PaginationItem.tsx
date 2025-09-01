import { YStack } from '../../primitives';

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
      p="$2"
      borderRadius="$full"
      hoverStyle={{
        bg: '$bgHover',
      }}
    >
      <YStack
        w="$1.5"
        h="$1.5"
        borderRadius="$full"
        bg="$neutral5"
        {...dotStyle}
        {...activeDotStyle}
      />
    </YStack>
  );
}
