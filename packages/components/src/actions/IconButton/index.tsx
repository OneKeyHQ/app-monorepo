import { useCallback } from 'react';

import {
  ButtonFrame,
  Icon,
  Spinner,
  Stack,
  getSharedButtonStyles,
} from '../../primitives';
import { useSharedPress } from '../../primitives/Button/useEvent';
import { NATIVE_HIT_SLOP } from '../../utils';
import { Tooltip } from '../Tooltip';

import type { IButtonProps, IIconProps, IKeyOfIcons } from '../../primitives';
import type { ITooltipProps } from '../Tooltip';
import type { GestureResponderEvent } from 'react-native';

export interface IIconButtonProps
  extends Omit<IButtonProps, 'iconAfter' | 'children' | 'icon'> {
  icon: IKeyOfIcons;
  iconSize?: IIconProps['size'];
  iconProps?: IIconProps;
  title?: ITooltipProps['renderContent'];
  // Allow triggering via the Enter or Space key.
  hotKey?: boolean;
  titlePlacement?: ITooltipProps['placement'];
}

const sizes = {
  small: {
    p: '$1',
    negativeMargin: -5,
  },
  medium: {
    p: '$1.5',
    negativeMargin: -7,
  },
  large: {
    p: '$3',
    negativeMargin: -13,
  },
};

const getSizeStyles = (size: IButtonProps['size']) =>
  sizes[size || 'medium'] || sizes.medium;

export const IconButton = (props: IIconButtonProps) => {
  const {
    iconSize,
    disabled,
    loading,
    title,
    icon,
    iconProps,
    size,
    variant = 'secondary',
    hotKey = false,
    titlePlacement = 'top',
    ...rest
  } = props;

  const { p, negativeMargin } = getSizeStyles(size);

  const { sharedFrameStyles, iconColor } = getSharedButtonStyles({
    disabled,
    loading,
    variant,
  });

  const { onPress, onLongPress } = useSharedPress(rest);

  const onKeyDown = useCallback((event: GestureResponderEvent) => {
    event.preventDefault();
  }, []);

  const renderIconButton = () => (
    <ButtonFrame
      p={p}
      borderRadius="$full"
      disabled={!!disabled || !!loading}
      aria-disabled={!!disabled || !!loading}
      // @ts-expect-error
      onKeyDown={hotKey ? undefined : onKeyDown}
      hitSlop={size === 'small' ? NATIVE_HIT_SLOP : undefined}
      {...(variant === 'tertiary' && {
        m: negativeMargin,
      })}
      {...sharedFrameStyles}
      {...rest}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {loading ? (
        <Stack
          {...(size !== 'small' && {
            m: '$0.5',
          })}
        >
          <Spinner color={iconColor} size="small" />
        </Stack>
      ) : (
        <Icon
          color={iconColor}
          name={icon}
          size={iconSize || (size === 'small' ? '$5' : '$6')}
          {...iconProps}
        />
      )}
    </ButtonFrame>
  );

  if (title) {
    return (
      <Tooltip
        renderTrigger={renderIconButton()}
        renderContent={title}
        placement={titlePlacement}
        {...(variant === 'tertiary' && { offset: 12 })}
      />
    );
  }

  return renderIconButton();
};
