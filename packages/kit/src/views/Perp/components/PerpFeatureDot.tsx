import { Stack } from '@onekeyhq/components';

export function PerpFeatureDot({ testID }: { testID?: string }) {
  return (
    <Stack
      testID={testID}
      width="$2"
      height="$2"
      borderRadius="$full"
      backgroundColor="$bgAccent"
      pointerEvents="none"
    />
  );
}
