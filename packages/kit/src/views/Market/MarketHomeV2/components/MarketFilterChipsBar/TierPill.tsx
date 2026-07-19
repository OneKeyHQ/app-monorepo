import { SizableText, XStack } from '@onekeyhq/components';

// Figma tier pill: bg-strong capsule (px 11 / py 5 / bodyMd-medium); the
// selected state swaps to bg-active with an active border ring. Shared by
// the condition-chip tier popover and the Filters popover rows.
export function TierPill({
  label,
  selected,
  disabled,
  grow,
  width,
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  // Stretch to share the row width evenly (tier popover grid layout).
  grow?: boolean;
  // Fixed width so pills stay uniform with trailing space (Filters popover).
  width?: number;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <XStack
      {...(grow ? { flexGrow: 1, flexBasis: 0, minWidth: 72 } : null)}
      {...(width ? { width } : null)}
      alignItems="center"
      justifyContent="center"
      px={11}
      py={5}
      borderRadius="$full"
      borderWidth={1}
      borderColor={selected ? '$borderActive' : '$transparent'}
      bg={selected ? '$bgActive' : '$bgStrong'}
      opacity={disabled ? 0.5 : 1}
      {...(!disabled && {
        hoverStyle: { bg: '$bgStrongHover' },
        pressStyle: { bg: '$bgStrongActive' },
        onPress,
        role: 'button' as const,
      })}
      userSelect="none"
      testID={testID}
    >
      <SizableText
        size="$bodyMdMedium"
        color={disabled ? '$textDisabled' : '$text'}
        numberOfLines={1}
      >
        {label}
      </SizableText>
    </XStack>
  );
}
