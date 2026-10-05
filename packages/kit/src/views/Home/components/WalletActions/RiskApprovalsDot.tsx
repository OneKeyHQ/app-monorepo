import { Stack } from '@onekeyhq/components';
import type { IStackProps } from '@onekeyhq/components';

// Caution (not critical) dot: risk approvals not yet reviewed are a
// suggestion to act, distinct from the red notification dot.
export function RiskApprovalsDot(props: IStackProps) {
  return (
    <Stack
      w="$2.5"
      h="$2.5"
      borderRadius="$full"
      bg="$bgCautionStrong"
      pointerEvents="none"
      {...props}
    />
  );
}
