import { Stack } from '../../primitives';

/** Marks the current day / month / year in every calendar grid. */
export function TodayDot({ disabled }: { disabled?: boolean }) {
  return (
    <Stack
      position="absolute"
      bottom="$0.5"
      width="$1"
      height="$1"
      borderRadius="$full"
      bg={disabled ? '$textDisabled' : '$bgPrimary'}
    />
  );
}
