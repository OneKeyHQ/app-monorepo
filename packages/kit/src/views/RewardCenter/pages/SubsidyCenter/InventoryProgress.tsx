import { useReducedMotion } from 'react-native-reanimated';

import { Stack } from '@onekeyhq/components';

// The bar appears at the value it is given and only animates when that value
// changes later. The shared Progress always grows from zero after it mounts,
// which restarted the bar on every reopen of the page.
export function InventoryProgress({ value }: { value: number }) {
  const target = Math.max(0, Math.min(100, value));
  const reducedMotion = useReducedMotion();
  return (
    <Stack
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(target)}
      h="$1"
      bg="$bgStrong"
      borderRadius="$full"
      overflow="hidden"
    >
      <Stack
        h="100%"
        width={`${target}%`}
        bg="$bgAccent"
        borderRadius="$full"
        transition={reducedMotion ? null : 'slow'}
      />
    </Stack>
  );
}
