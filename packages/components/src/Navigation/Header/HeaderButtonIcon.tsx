import { useCallback, useState } from 'react';

import { Icon } from '../../Icon';
import { Stack } from '../../Stack';

import type { ICON_NAMES } from '../../Icon';
import type { ColorValue } from 'react-native';

function HeaderButtonIcon({
  name,
  color = '$iconSubdued',
  onPress,
}: {
  name: ICON_NAMES;
  onPress?: () => void;
  color?: ColorValue;
}) {
  const [iconColor, setIconColor] = useState(color);

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
      onPressIn={onPressInCall}
      onPressOut={onRecoverColorCall}
    >
      <Icon name={name} size={size} color={iconColor} />
    </Stack>
  );
}

export default HeaderButtonIcon;
