import {
  ButtonFrame,
  type IButtonProps,
  getSharedButtonStyles,
} from '../Button';
import { Icon } from '../Icon';
import { Spinner } from '../Spinner';
import { Stack } from '../Stack';
import { Tooltip } from '../Tooltip';

import type { IKeyOfIcons, IIconProps } from '../Icon';
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
    },
    medium: {
      p: '$1.5',
    },
    large: {
      p: '$3',
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

  const { p } = getSizeStyles(size);

  const { sharedFrameStyles, iconColor } = getSharedButtonStyles({
    disabled,
    loading,
    variant,
  });

  const renderIconButton = () => (
    <ButtonFrame
      p={p}
      borderRadius="$full"
      disabled={disabled || loading}
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
          {...iconProps}
        />
      )}
    </ButtonFrame>
  );

  if (title) {
    return <Tooltip renderTrigger={renderIconButton()} renderContent={title} />;
  }

  return renderIconButton();
};
