import { Icon, Stack } from '../../primitives';
import { NATIVE_HIT_SLOP } from '../../utils/getFontSize';

import type { IIconProps, IKeyOfIcons } from '../../primitives';

const groupHoverStyle = { color: '$iconHover' } as const;

export interface IInteractiveIconProps {
  icon: IKeyOfIcons;
  onPress: () => void;
  size?: IIconProps['size'];
}

export function InteractiveIcon({
  icon,
  onPress,
  size = '$4',
}: IInteractiveIconProps) {
  return (
    <Stack
      w={size}
      h={size}
      cursor="pointer"
      onPress={onPress}
      hitSlop={NATIVE_HIT_SLOP}
      group
    >
      <Icon
        name={icon}
        size={size}
        color="$iconSubdued"
        $group-hover={groupHoverStyle}
      />
    </Stack>
  );
}
