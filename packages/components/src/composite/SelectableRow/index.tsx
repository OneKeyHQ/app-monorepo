import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { Platform, Pressable } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Stack, XStack } from '../../primitives';

import type { IXStackProps } from '../../primitives';

export type ISelectableRowProps = {
  /** Content inside the selection target must not contain interactive controls. */
  children: ReactNode;
  /** Non-interactive visuals inside the selection target. */
  leading?: ReactNode;
  /** Non-interactive content inside the selection target. */
  trailing?: ReactNode;
  /** A separate control, rendered beside the selection target. */
  action?: ReactNode;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
  minHeight?: IXStackProps['minHeight'];
  horizontalPadding?: IXStackProps['px'];
  gap?: IXStackProps['gap'];
  actionWidth?: IXStackProps['width'];
  reserveActionSpace?: boolean;
};

function getBackground(active: boolean, hovered: boolean) {
  if (active) return '$bgActive';
  if (hovered) return '$bgHover';
  return 'transparent';
}

const PRESSABLE_STYLE = { flex: 1, minWidth: 0 };
// The web animation driver emits CSS property names directly.
const ANIMATE_BACKGROUND =
  Platform.OS === 'web' ? ['background-color'] : ['backgroundColor'];

export function SelectableRow({
  children,
  leading,
  trailing,
  action,
  selected,
  disabled = false,
  onPress,
  accessibilityLabel,
  testID,
  minHeight = 60,
  horizontalPadding = '$2',
  gap = '$3',
  actionWidth = '$6',
  reserveActionSpace = false,
}: ISelectableRowProps) {
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const showAction =
    (action !== null && action !== undefined) || reserveActionSpace;
  const accessibilityState = useMemo(
    () => ({ disabled, selected }),
    [disabled, selected],
  );
  const handlePressIn = useCallback(() => setPressed(true), []);
  const handlePressOut = useCallback(() => setPressed(false), []);
  const handleHoverIn = useCallback(() => setHovered(true), []);
  const handleHoverOut = useCallback(() => setHovered(false), []);
  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(() => setFocused(false), []);

  return (
    <XStack
      alignItems="center"
      borderRadius="$3"
      transition={reduceMotion ? undefined : 'quick'}
      animateOnly={ANIMATE_BACKGROUND}
      bg={getBackground(
        selected || (!disabled && pressed),
        hovered && !disabled,
      )}
    >
      <Pressable
        testID={testID}
        style={PRESSABLE_STYLE}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        aria-disabled={disabled}
        aria-pressed={selected}
        disabled={disabled}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <XStack
          minHeight={minHeight}
          px={horizontalPadding}
          gap={gap}
          alignItems="center"
          borderRadius="$3"
          opacity={disabled ? 0.5 : 1}
          cursor={disabled ? 'default' : 'pointer'}
          {...(focused && !disabled
            ? {
                outlineWidth: 2,
                outlineColor: '$focusRing',
                outlineStyle: 'solid',
                outlineOffset: -2,
              }
            : {})}
        >
          {leading}
          <Stack flex={1} minWidth={0}>
            {children}
          </Stack>
          {trailing}
        </XStack>
      </Pressable>
      {showAction ? (
        <Stack
          width={actionWidth}
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          {action}
        </Stack>
      ) : null}
    </XStack>
  );
}
