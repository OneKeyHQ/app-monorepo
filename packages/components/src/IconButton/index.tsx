import {
  ButtonFrame,
  type ButtonProps,
  getSharedButtonStyles,
} from '../Button';
import { Icon } from '../Icon';
import { Spinner } from '../Spinner';
import { Stack } from '../Stack';
import { Tooltip } from '../Tooltip';

import type { ICON_NAMES, IconProps } from '../Icon';

export interface IconButtonProps
  extends Omit<ButtonProps, 'iconAfter' | 'children' | 'icon'> {
  icon: ICON_NAMES;
  iconProps?: IconProps;
  title?: string;
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
    title,
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

  const renderIconButton = () => {
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
              m: '$0.5',
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

  if (title) {
    return <Tooltip renderTrigger={renderIconButton()} renderContent={title} />;
  }

  return renderIconButton();
};
