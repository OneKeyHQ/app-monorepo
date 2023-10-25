import {
  ThemeableStack,
  getTokenValue,
  styled,
  useProps,
  withStaticProperties,
} from 'tamagui';

import { Icon } from '../Icon';
import { Spinner } from '../Spinner';
import { Text } from '../Text';

import type { ICON_NAMES } from '../Icon';
import type { ColorTokens, GetProps } from 'tamagui';

export interface ButtonProps extends GetProps<typeof ThemeableStack> {
  size?: 'small' | 'medium' | 'large';
  variant?: 'secondary' | 'tertiary' | 'primary' | 'destructive';
  icon?: ICON_NAMES;
  iconAfter?: ICON_NAMES;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  color: ColorTokens;
}

const BUTTON_VARIANTS: Record<
  Exclude<ButtonProps['variant'], undefined>,
  {
    color: ColorTokens;
    iconColor: ColorTokens;
    bg: ColorTokens;
    hoverBg: ColorTokens;
    activeBg: ColorTokens;
    focusRingColor: ColorTokens;
  }
> = {
  primary: {
    color: '$textInverse',
    iconColor: '$iconInverse',
    bg: '$bgPrimary',
    hoverBg: '$bgPrimaryHover',
    activeBg: '$bgPrimaryActive',
    focusRingColor: '$focusRing',
  },
  tertiary: {
    color: '$textSubdued',
    iconColor: '$iconSubdued',
    bg: '$transparent',
    hoverBg: '$bgHover',
    activeBg: '$bgActive',
    focusRingColor: '$focusRing',
  },
  destructive: {
    color: '$textOnColor',
    iconColor: '$iconOnColor',
    bg: '$bgCriticalStrong',
    hoverBg: '$bgCriticalStrongHover',
    activeBg: '$bgCriticalStrongActive',
    focusRingColor: '$focusRingCritical',
  },
  secondary: {
    color: '$text',
    iconColor: '$icon',
    bg: '$bgStrong',
    hoverBg: '$bgHover',
    activeBg: '$bgActive',
    focusRingColor: '$focusRing',
  },
};

export const getSharedButtonStyles = ({
  variant,
  disabled,
  loading,
}: Partial<ButtonProps>) => {
  const { iconColor, color, bg, hoverBg, activeBg, focusRingColor } =
    BUTTON_VARIANTS[variant || 'secondary'];

  const sharedFrameStyles = {
    bg,
    borderWidth: '$px',
    borderColor: '$transparent',
    ...(!disabled && !loading
      ? {
          hoverStyle: { bg: hoverBg },
          pressStyle: { bg: activeBg },
          focusable: true,
          focusStyle: {
            outlineColor: focusRingColor,
            outlineStyle: 'solid',
            outlineWidth: 2,
          },
        }
      : {
          opacity: 0.5,
        }),
  };

  return {
    color,
    iconColor,
    sharedFrameStyles,
  };
};

const getSizeStyles = (size: ButtonProps['size']) => {
  const sizes = {
    small: {
      py: '$1',
      px: '$2.5',
      borderRadius: getTokenValue('$size.2'),
      textVariant: '$bodyMdMedium',
    },
    medium: {
      py: '$1.5',
      px: '$3.5',
      borderRadius: getTokenValue('$size.2'),
      textVariant: '$bodyLgMedium',
    },
    large: {
      py: '$3',
      px: '$5',
      borderRadius: getTokenValue('$size.3'),
      textVariant: '$bodyLgMedium',
    },
  };

  return sizes[size || 'medium'];
};

export const ButtonFrame = styled(ThemeableStack, {
  tag: 'button',
  role: 'button',
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
});

function ButtonIcon({
  variant,
  size,
  ...props
}: Pick<ButtonProps, 'variant' | 'size'> &
  Omit<GetProps<typeof Icon>, 'size'>) {
  const { iconColor } = BUTTON_VARIANTS[variant || 'secondary'];

  return (
    <Icon
      size={size === 'small' ? '$4.5' : '$5'}
      color={iconColor}
      {...props}
    />
  );
}

const ButtonComponent = ButtonFrame.styleable<ButtonProps>((props, ref) => {
  console.log(props);
  const {
    size = 'medium',
    icon,
    iconAfter,
    disabled,
    loading,
    children,
    color: textColor,
    variant = 'secondary',
    ...rest
  } = useProps(props, {});

  const { py, px, borderRadius, textVariant } = getSizeStyles(size);

  const { sharedFrameStyles, iconColor, color } = getSharedButtonStyles({
    variant,
    disabled,
    loading,
  });

  return (
    <ButtonFrame
      ref={ref}
      my={variant === 'tertiary' ? '$-1' : '$0'}
      mx={variant === 'tertiary' ? '$-2' : '$0'}
      py={variant === 'tertiary' ? '$1' : py}
      px={variant === 'tertiary' ? '$2' : px}
      borderRadius={borderRadius}
      disabled={disabled || loading}
      {...sharedFrameStyles}
      {...rest}
    >
      {icon && !loading && (
        <ButtonIcon name={icon} variant={variant} size={size} mr="$2" />
      )}
      {loading && <Spinner size="small" mr="$2" color={iconColor} />}
      <Text variant={textVariant} color={textColor || color}>
        {children}
      </Text>
      {iconAfter && (
        <ButtonIcon name={iconAfter} variant={variant} size={size} ml="$2" />
      )}
    </ButtonFrame>
  );
});

export const Button = withStaticProperties(ButtonComponent, {});
