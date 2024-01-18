import { useSharedPress } from '../../hooks';
import {
  ButtonFrame,
  Icon,
  Spinner,
  Stack,
  getSharedButtonStyles,
} from '../../primitives';
import { Tooltip } from '../Tooltip';

import type { IButtonProps, IIconProps, IKeyOfIcons } from '../../primitives';
import type { ITooltipProps } from '../Tooltip';

export interface IIconButtonProps
  extends Omit<IButtonProps, 'iconAfter' | 'children' | 'icon'> {
  icon: IKeyOfIcons;
  iconProps?: IIconProps;
  title?: ITooltipProps['renderContent'];
}

const getSizeStyles = (size: IButtonProps['size']) => {
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

export const IconButton = (props: IIconButtonProps) => {
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

  const { onPress, onLongPress } = useSharedPress(rest);

  const renderIconButton = () => (
    <ButtonFrame
      p={p}
      borderRadius="$full"
      disabled={disabled || loading}
      $platform-native={{
        hitSlop:
          size === 'small'
            ? { top: 8, left: 8, right: 8, bottom: 8 }
            : undefined,
      }}
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
          size={size === 'small' ? '$5' : '$6'}
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
        placement="top"
        {...(variant === 'tertiary' && { offset: 12 })}
      />
    );
  }

  return renderIconButton();
};
