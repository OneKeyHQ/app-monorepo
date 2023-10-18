import { Icon } from '../Icon';
import {
  ButtonFrame,
  type ButtonProps,
  getSharedButtonStyles,
} from '../NewButton';
import { Spinner } from '../Spinner';
import { Stack } from '../Stack';

import type { ICON_NAMES } from '../Icon';

interface IconButtonProps
  extends Omit<ButtonProps, 'iconAfter' | 'children' | 'icon'> {
  icon: ICON_NAMES;
}

const getSizeStyles = (size: ButtonProps['size']) => {
  const sizes = {
    small: {
      p: '$1',
      negativeMargin: '$-1',
    },
    medium: {
      p: '$1.5',
      negativeMargin: '$-1.5',
    },
    large: {
      p: '$3',
      negativeMargin: '$-3',
    },
  };

  return sizes[size || 'medium'];
};

export const NewIconButton = (props: IconButtonProps) => {
  const {
    disabled,
    loading,
    icon,
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
        />
      )}
    </ButtonFrame>
  );
};
