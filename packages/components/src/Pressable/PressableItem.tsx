import type { ComponentProps, FC } from 'react';
import { memo, useCallback } from 'react';

import { Pressable as NBPressable } from 'native-base';

import { enableHaptics } from '@onekeyhq/shared/src/haptics';

import useProviderValue from '../Provider/hooks/useProviderValue';
import { beforeOnPress } from '../utils/beforeOnPress';

export type PressableItemProps = ComponentProps<typeof NBPressable>;

const PressableItem: FC<PressableItemProps> = ({
  children,
  onPress,
  ...props
}) => {
  const { hapticsEnabled } = useProviderValue();
  const onPressOverride = useCallback(
    (e) => {
      if (hapticsEnabled && onPress) {
        enableHaptics();
      }
      beforeOnPress(e, onPress);
    },
    [onPress, hapticsEnabled],
  );

  // TODO: use child function to check hover state
  return (
    <NBPressable
      px={{ base: '4', lg: '6' }}
      py={4}
      _hover={{
        bg: 'surface-hovered',
      }}
      _focus={{
        bg: 'surface-hovered',
      }}
      _focusVisible={{
        bg: 'surface-hovered',
      }}
      _pressed={{
        bg: 'surface-pressed',
        borderColor: 'surface-pressed',
      }}
      bg="surface-default"
      {...props}
      onPress={onPressOverride}
    >
      {children}
    </NBPressable>
  );
};

export default memo(PressableItem);
