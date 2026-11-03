import { YStack } from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components/src/shared/tamagui';

// The legend dot for the paid and unpaid parts of a total, on both the invite
// and Perks tabs.
export function PartDot({ color }: { color: ColorTokens }) {
  return <YStack w="$2" h="$2" borderRadius="$full" bg={color} />;
}
