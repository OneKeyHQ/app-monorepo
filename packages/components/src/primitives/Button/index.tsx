import type { ButtonHTMLAttributes } from 'react';
import { useMemo, useState } from 'react';

import {
  type ColorTokens,
  type FontSizeTokens,
  ThemeableStack,
  type ThemeableStackProps,
  styled,
  useProps,
  withStaticProperties,
} from '@onekeyhq/components/src/shared/tamagui';

import { Icon } from '../Icon';
import { SizableText } from '../SizeableText';
import { Spinner } from '../Spinner';

import { useSharedPress } from './useEvent';

import type { IIconProps, IKeyOfIcons } from '../Icon';

export interface IButtonProps extends ThemeableStackProps {
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
  size?: 'small' | 'medium' | 'large';
  variant?:
    | 'secondary'
    | 'tertiary'
    | 'primary'
    | 'destructive'
    | 'accent'
    | 'link';
  icon?: IKeyOfIcons;
  iconAfter?: IKeyOfIcons;
  disabled?: boolean;
  loading?: boolean;
  onPressLoadingEnabled?: boolean;

  children?: React.ReactNode;
  color?: ColorTokens;
  iconColor?: ColorTokens;
  textAlign?: 'left' | 'center' | 'right';
  /**
   * stop propagation from button.
   *
   * @default true
   */
  stopPropagation?: boolean;
  onPressDebounce?: number;
  /**
   * Whether to render children as text component.
   *
   * @default true
   */
  childrenAsText?: boolean;
  textEllipsis?: boolean;
  /**
   * Unique identifier for tracking/analytics purposes.
   */
  trackID?: string;
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
  accent: {
    color: '$textOnColor',
    iconColor: '$iconOnColor',
    bg: '$bgAccent',
    hoverBg: '$bgAccentHover',
    activeBg: '$bgAccentActive',
    focusRingColor: '$focusRing',
  },
  link: {
    color: '$textInfo',
    iconColor: '$iconInfo',
    bg: '$transparent',
    hoverBg: '$transparent',
    activeBg: '$transparent',
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
          focusVisibleStyle: {
            outlineColor: focusRingColor,
            outlineStyle: 'solid',
            outlineWidth: 2,
          },
        }
      : {
          opacity: 0.4,
        }),
  };

  return {
    color,
    iconColor,
    sharedFrameStyles,
  };
};

const useSizeStyles = (size: IButtonProps['size']) =>
  useMemo(() => {
    const sizes = {
      small: {
        py: '$1',
        px: '$2.5',
        textVariant: '$bodyMdMedium',
      },
      medium: {
        py: '$1.5',
        px: '$3.5',
        textVariant: '$bodyLgMedium',
      },
      large: {
        py: '$3',
        px: '$5',
        textVariant: '$bodyLgMedium',
      },
    };
    return sizes[size || 'medium'] || sizes.medium;
  }, [size]);

export const ButtonFrame = styled(ThemeableStack, {
  tag: 'button',
  role: 'button',
  type: 'button',
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  borderRadius: '$full',
} as IButtonProps);

function ButtonIcon({
  size,
  ...props
}: Pick<IButtonProps, 'size'> & Omit<IIconProps, 'size'>) {
  return <Icon size={size === 'small' ? '$4.5' : '$5'} {...props} />;
}

type ISharedFrameStylesProps = {
  hoverStyle: {
    bg: ColorTokens;
  };
  pressStyle: {
    bg: ColorTokens;
  };
  focusable: boolean;
  focusVisibleStyle: {
    outlineColor: ColorTokens;
    outlineStyle: string;
    outlineWidth: number;
  };
  bg: ColorTokens;
  borderWidth: string;
  borderColor: string;
};

const ButtonComponent = ButtonFrame.styleable<IButtonProps, any, any>(
  (props: IButtonProps, ref: any) => {
    const {
      size = 'medium',
      icon,
      iconAfter,
      disabled,
      loading,
      onPressLoadingEnabled,
      children,
      color: outerColor,
      iconColor: outerIconColor,
      variant = 'secondary',
      childrenAsText = true,
      textEllipsis,
      onPress: onPressProp,
      ...rest
    } = useProps(props, {});

    const { py, px, textVariant } = useSizeStyles(size);
    const [internalLoading, setInternalLoading] = useState(false);

    const isLoading = loading || internalLoading;

    const { sharedFrameStyles, iconColor, color } = getSharedButtonStyles({
      variant,
      disabled,
      loading: isLoading,
    }) as {
      sharedFrameStyles: ISharedFrameStylesProps;
      iconColor: ColorTokens;
      color: ColorTokens;
    };

    const { onLongPress, onPress } = useSharedPress({
      ...rest,
      onPress: onPressProp,
    });

    const handlePressWithLoading = useMemo(() => {
      if (!onPressLoadingEnabled || !onPress) {
        return onPress;
      }

      return async (event: any) => {
        try {
          setInternalLoading(true);
          // eslint-disable-next-line @typescript-eslint/await-thenable
          await onPress(event);
          setInternalLoading(false);
        } catch (error) {
          setInternalLoading(false);
          throw error;
        }
      };
    }, [onPressLoadingEnabled, onPress]);

    return (
      <ButtonFrame
        ref={ref}
        my={variant === 'tertiary' ? -5 : '$0'}
        mx={variant === 'tertiary' ? -9 : '$0'}
        py={variant === 'tertiary' ? '$1' : py}
        px={variant === 'tertiary' ? '$2' : px}
        borderCurve="continuous"
        disabled={!!disabled || !!isLoading}
        aria-disabled={!!disabled || !!isLoading}
        {...sharedFrameStyles}
        hoverStyle={{
          ...sharedFrameStyles.hoverStyle,
          ...props.hoverStyle,
        }}
        focusVisibleStyle={{
          ...sharedFrameStyles.focusVisibleStyle,
          ...props.focusVisibleStyle,
        }}
        pressStyle={{
          ...sharedFrameStyles.pressStyle,
          ...props.pressStyle,
        }}
        {...rest}
        onPress={handlePressWithLoading}
        onLongPress={onLongPress}
      >
        {icon && !isLoading ? (
          <ButtonIcon
            name={icon}
            size={size}
            mr="$2"
            color={outerIconColor || iconColor}
          />
        ) : null}
        {isLoading ? (
          <Spinner size="small" mr="$2" color={outerIconColor || iconColor} />
        ) : null}
        {childrenAsText ? (
          <SizableText
            // Fix text truncation issues and Chinese punctuation display by allowing text to wrap onto multiple lines
            // https://www.cnblogs.com/fresh-bright/p/13685644.html
            //
            textBreakStrategy="simple"
            size={textVariant as FontSizeTokens}
            color={outerColor || color}
            ellipse={textEllipsis}
          >
            {children}
          </SizableText>
        ) : (
          children
        )}
        {iconAfter ? (
          <ButtonIcon
            name={iconAfter}
            size={size}
            ml="$2"
            color={outerIconColor || iconColor}
          />
        ) : null}
      </ButtonFrame>
    );
  },
);

export const Button = withStaticProperties(ButtonComponent, {});
