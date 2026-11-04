import { Stack } from '@onekeyhq/components';
import type { IStackProps } from '@onekeyhq/components';

export function SupportUnreadDot(props: IStackProps) {
  return (
    <Stack
      position="absolute"
      top={0}
      right={0}
      width="$2"
      height="$2"
      borderRadius="$full"
      bg="$bgCriticalStrong"
      pointerEvents="none"
      {...props}
    />
  );
}
