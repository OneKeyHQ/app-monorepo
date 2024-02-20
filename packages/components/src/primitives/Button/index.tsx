import {
  ThemeableStack,
  getTokenValue,
  styled,
  useProps,
  withStaticProperties,
} from 'tamagui';

import { Icon } from '../Icon';
import { SizableText } from '../SizeableText';
import { Spinner } from '../Spinner';

import { useSharedPress } from './useEvent';

import type { IIconProps, IKeyOfIcons } from '../Icon';
import type { ColorTokens, FontSizeTokens, ThemeableStackProps } from 'tamagui';

export interface IButtonProps extends ThemeableStackProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'secondary' | 'tertiary' | 'primary' | 'destructive';
  icon?: IKeyOfIcons;
  iconAfter?: IKeyOfIcons;
  disabled?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
  color?: ColorTokens;
  /**
   * stop propagation from button.
   *
   * @default true
   */
  stopPropagation?: boolean;
}

const BUTTON_VARIANTS: Record<
  Exclude<IButtonProps['variant'], undefined>,
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
    hoverBg: '$bgStrongHover',
    activeBg: '$bgStrongActive',
    focusRingColor: '$focusRing',
  },
};

export const getSharedButtonStyles = ({
  variant,
  disabled,
  loading,
}: Partial<IButtonProps>) => {
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

const getSizeStyles = (size: IButtonProps['size']) => {
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
}: Pick<IButtonProps, 'variant' | 'size'> & Omit<IIconProps, 'size'>) {
  const { iconColor } = BUTTON_VARIANTS[variant || 'secondary'];

  return (
    <Icon
      size={size === 'small' ? '$4.5' : '$5'}
      color={iconColor}
      {...props}
    />
  );
}

type ISharedFrameStylesProps = {
  hoverStyle: {
    bg: ColorTokens;
  };
  pressStyle: {
    bg: ColorTokens;
  };
  focusable: boolean;
  focusStyle: {
    outlineColor: ColorTokens;
    outlineStyle: string;
    outlineWidth: number;
  };
  bg: ColorTokens;
  borderWidth: string;
  borderColor: string;
};

const ButtonComponent = ButtonFrame.styleable<IButtonProps>((props, ref) => {
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
  }) as {
    sharedFrameStyles: ISharedFrameStylesProps;
    iconColor: ColorTokens;
    color: ColorTokens;
  };

  const { onPress, onLongPress } = useSharedPress(rest);

  return (
    <ButtonFrame
      ref={ref}
      my={variant === 'tertiary' ? '$-1' : '$0'}
      mx={variant === 'tertiary' ? '$-2' : '$0'}
      py={variant === 'tertiary' ? '$1' : py}
      px={variant === 'tertiary' ? '$2' : px}
      borderRadius={borderRadius}
      style={{
        borderCurve: 'continuous',
      }}
      disabled={disabled || loading}
      {...sharedFrameStyles}
      hoverStyle={{
        ...sharedFrameStyles.hoverStyle,
        ...props.hoverStyle,
      }}
      focusStyle={{
        ...sharedFrameStyles.focusStyle,
        ...props.focusStyle,
      }}
      pressStyle={{
        ...sharedFrameStyles.pressStyle,
        ...props.pressStyle,
      }}
      {...rest}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {icon && !loading && (
        <ButtonIcon name={icon} variant={variant} size={size} mr="$2" />
      )}
      {loading && <Spinner size="small" mr="$2" color={iconColor} />}
      <SizableText
        size={textVariant as FontSizeTokens}
        color={textColor || color}
      >
        {children}
      </SizableText>
      {iconAfter && (
        <ButtonIcon name={iconAfter} variant={variant} size={size} ml="$2" />
      )}
    </ButtonFrame>
  );
});

export const Button = withStaticProperties(ButtonComponent, {});
