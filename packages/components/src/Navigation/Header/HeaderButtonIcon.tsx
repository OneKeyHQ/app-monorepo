import { useCallback, useState } from 'react';

import { Icon } from '../../Icon';
import { Stack } from '../../Stack';

import type { ICON_NAMES } from '../../Icon';
import type { ColorTokens } from 'tamagui';

function HeaderButtonIcon({
  name,
  color = '$iconSubdued',
  onPress,
  paddingLeft,
}: {
  name: ICON_NAMES;
  onPress?: () => void;
  color?: ColorTokens;
  paddingLeft?: string;
}) {
  const [iconColor, setIconColor] = useState<ColorTokens | undefined>(color);

  const onRecoverColorCall = useCallback(() => {
    setIconColor(color ?? '$iconSubdued');
  }, [color]);

  const onPressInCall = useCallback(() => {
    setIconColor('$iconActive');
  }, []);

  return (
    <Stack
      onPress={onPress}
      alignItems="center"
      paddingLeft={paddingLeft}
      onPressIn={onPressInCall}
      onPressOut={onRecoverColorCall}
    >
      <Icon name={name} color={iconColor} />
    </Stack>
  );
}

export default HeaderButtonIcon;
