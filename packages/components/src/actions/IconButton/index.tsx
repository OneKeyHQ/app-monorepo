import { useCallback, useMemo } from 'react';

import type { TooltipProps } from '@onekeyhq/components/src/shared/tamagui';

import {
  ButtonFrame,
  Icon,
  Spinner,
  Stack,
  getSharedButtonStyles,
} from '../../primitives';
import {
  GLASS_HEADER_BAREIFY_RESET,
  useInGlassHeader,
} from '../../primitives/Button/GlassHeaderContext';
import { useSharedPress } from '../../primitives/Button/useEvent';
import { NATIVE_HIT_SLOP } from '../../utils/getFontSize';
import { Tooltip } from '../Tooltip';

import type { IButtonProps, IIconProps, IKeyOfIcons } from '../../primitives';
import type { ITooltipProps } from '../Tooltip';
import type { GestureResponderEvent } from 'react-native';

export interface IIconButtonProps extends Omit<
  IButtonProps,
  'iconAfter' | 'children' | 'icon'
> {
  icon: IKeyOfIcons;
  iconSize?: IIconProps['size'];
  iconProps?: IIconProps;
  allowPressWhenDisabled?: boolean;
  title?: ITooltipProps['renderContent'];
  // Allow triggering via the Enter or Space key.
  hotKey?: boolean;
  titlePlacement?: ITooltipProps['placement'];
  tooltipProps?: TooltipProps;
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

export function IconButton(props: IIconButtonProps) {
  const {
    iconSize,
    disabled,
    loading,
    title,
    icon,
    iconProps,
    allowPressWhenDisabled = false,
    size,
    variant = 'secondary',
    hotKey = false,
    titlePlacement = 'top',
    tooltipProps,
    ...rest
  } = props;

  const visualDisabled = !!disabled;
  const effectiveDisabled = visualDisabled && !allowPressWhenDisabled;
  const { p, negativeMargin } = getSizeStyles(size);

  const { sharedFrameStyles, iconColor } = getSharedButtonStyles({
    disabled: visualDisabled,
    loading,
    variant,
  });

  const { onPress, onLongPress } = useSharedPress(rest);

  const inGlassHeader = useInGlassHeader();
  const resolvedIconColor = iconProps?.color ?? iconColor;

  const onKeyDown = useCallback((event: GestureResponderEvent) => {
    event.preventDefault();
  }, []);

  const iconButtonElement = useMemo(
    () => (
      <ButtonFrame
        p={p}
        borderRadius="$full"
        disabled={effectiveDisabled || !!loading}
        aria-disabled={effectiveDisabled || !!loading}
        // @ts-expect-error
        onKeyDown={hotKey ? undefined : onKeyDown}
        hitSlop={size === 'small' ? NATIVE_HIT_SLOP : undefined}
        {...(variant === 'tertiary' && {
          m: negativeMargin,
        })}
        {...sharedFrameStyles}
        {...rest}
        // Inside the iOS 26 glass capsule, drop our self-drawn background/press
        // and the tertiary negative margin so we don't double up on the system
        // glass. Only ever true for buttons injected into the native glass bar
        // (see GlassHeaderContext / GLASS_HEADER_BAREIFY_RESET).
        {...(inGlassHeader && GLASS_HEADER_BAREIFY_RESET)}
        onPress={onPress}
        onLongPress={onLongPress}
      >
        {loading ? (
          <Stack
            {...(size !== 'small' && {
              m: '$0.5',
            })}
          >
            <Spinner color={inGlassHeader ? '$text' : iconColor} size="small" />
          </Stack>
        ) : (
          <Icon
            name={icon}
            size={iconSize || (size === 'small' ? '$5' : '$6')}
            {...iconProps}
            // In a glass header the neutral default icon colors ($icon /
            // $iconSubdued) look washed out on the capsule, so raise them to
            // high-contrast $text. Placed after {...iconProps} so it wins over a
            // caller-set default (e.g. the address-security shield's $iconSubdued,
            // or the Trade header actions which pass $icon). Semantic colors set
            // by the caller (success/critical/…) are preserved.
            color={
              inGlassHeader &&
              (resolvedIconColor === '$iconSubdued' ||
                resolvedIconColor === '$icon')
                ? '$text'
                : resolvedIconColor
            }
          />
        )}
      </ButtonFrame>
    ),
    [
      effectiveDisabled,
      hotKey,
      icon,
      iconColor,
      iconProps,
      iconSize,
      inGlassHeader,
      loading,
      negativeMargin,
      onKeyDown,
      onLongPress,
      onPress,
      p,
      resolvedIconColor,
      rest,
      sharedFrameStyles,
      size,
      variant,
    ],
  );

  if (title) {
    return (
      <Tooltip
        renderTrigger={iconButtonElement}
        renderContent={title}
        placement={titlePlacement}
        {...(variant === 'tertiary' && { offset: 12 })}
        {...tooltipProps}
      />
    );
  }

  return iconButtonElement;
}
