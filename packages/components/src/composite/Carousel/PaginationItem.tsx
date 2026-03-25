import { YStack } from '../../primitives';

import type { IYStackProps } from '../../primitives';

export type IDotStyle = IYStackProps;

export type IPaginationItemProps = {
  index: number;
  dotStyle?: IDotStyle;
  activeDotStyle?: IDotStyle;
  onPress: () => void;
};

const hoverStyleConst = { bg: '$bgHover' } as const;

export function PaginationItem({
  dotStyle,
  activeDotStyle,
  onPress,
}: IPaginationItemProps) {
  return (
    <YStack
      onPress={onPress}
      p="$1"
      borderRadius="$full"
      hoverStyle={hoverStyleConst}
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
