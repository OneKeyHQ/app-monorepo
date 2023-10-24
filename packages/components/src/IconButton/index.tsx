import {
  ButtonFrame,
  type ButtonProps,
  getSharedButtonStyles,
} from '../Button';
import { Icon } from '../Icon';
import { Spinner } from '../Spinner';
import { Stack } from '../Stack';

import type { ICON_NAMES, IconProps } from '../Icon';

export interface IconButtonProps
  extends Omit<ButtonProps, 'iconAfter' | 'children' | 'icon'> {
  icon: ICON_NAMES;
  iconProps?: IconProps;
}

const getSizeStyles = (size: ButtonProps['size']) => {
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

  return sizes[size || 'medium'];
};

export const IconButton = (props: IconButtonProps) => {
  const {
    disabled,
    loading,
    icon,
    iconProps,
    size,
    variant = 'secondary',
    ...rest
  } = props;

  const { p, negativeMargin } = getSizeStyles(size);

  const { sharedFrameStyles, iconColor } = getSharedButtonStyles({
    disabled,
    loading,
    variant,
  });

  return (
    <ButtonFrame
      p={p}
      borderRadius="$full"
      disabled={disabled || loading}
      {...(variant === 'tertiary' && {
        m: negativeMargin,
      })}
      {...sharedFrameStyles}
      {...rest}
    >
      {loading ? (
        <Stack
          {...(size !== 'small' && {
            p: '$0.5',
          })}
        >
          <Spinner color={iconColor} size="small" />
        </Stack>
      ) : (
        <Icon
          color={iconColor}
          name={icon}
          size={size === 'small' ? '$5' : '$6'}
          {...iconProps}
        />
      )}
    </ButtonFrame>
  );
};
