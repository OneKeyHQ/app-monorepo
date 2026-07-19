import { SizableText, XStack } from '@onekeyhq/components';

// Figma (25060-6052) tier pill.
// - `filled` (default): bg-strong capsule, px 11 / py 5 / bodyMd-medium; the
//   selected state swaps to bg-active with an active border ring.
// - `plain`: transparent until selected (time-frame segment style), where the
//   selected option gets the bg-strong fill instead.
export function TierPill({
  label,
  selected,
  disabled,
  grow,
  width,
  minWidth = 72,
  variant = 'filled',
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  // Stretch to share the row width evenly (tier grid layout).
  grow?: boolean;
  // Fixed width (time-frame segment).
  width?: number;
  minWidth?: number;
  variant?: 'filled' | 'plain';
  onPress?: () => void;
  testID?: string;
}) {
  const isPlain = variant === 'plain';
  let backgroundColor = '$bgStrong';
  if (isPlain) {
    backgroundColor = selected ? '$bgStrong' : '$transparent';
  } else if (selected) {
    backgroundColor = '$bgActive';
  }
  let textColor = '$text';
  if (disabled) {
    textColor = '$textDisabled';
  } else if (isPlain && !selected) {
    textColor = '$textSubdued';
  }

  return (
    <XStack
      {...(grow ? { flexGrow: 1, flexBasis: 0, minWidth } : null)}
      {...(width ? { width } : null)}
      alignItems="center"
      justifyContent="center"
      px={isPlain ? 7 : 11}
      py={5}
      borderRadius="$full"
      borderWidth={1}
      borderColor={selected && !isPlain ? '$borderActive' : '$transparent'}
      bg={backgroundColor}
      opacity={disabled ? 0.5 : 1}
      {...(!disabled && {
        hoverStyle: {
          bg: isPlain && !selected ? '$bgHover' : '$bgStrongHover',
        },
        pressStyle: { bg: '$bgStrongActive' },
        onPress,
        role: 'button' as const,
        cursor: 'pointer' as const,
      })}
      userSelect="none"
      testID={testID}
    >
      <SizableText size="$bodyMdMedium" color={textColor} numberOfLines={1}>
        {label}
      </SizableText>
    </XStack>
  );
}
