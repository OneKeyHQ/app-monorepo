import { Stack } from '@onekeyhq/components';
import type { IStackProps } from '@onekeyhq/components';

// Caution (not critical) dot: risk approvals not yet reviewed are a
// suggestion to act, distinct from the red notification dot. Sized like the
// header notification dot; the border matches the surface behind the dot.
export function RiskApprovalsDot(props: IStackProps) {
  return (
    <Stack
      w="$3"
      h="$3"
      borderRadius="$full"
      bg="$bgCautionStrong"
      borderWidth="$0.5"
      borderColor="$bgApp"
      pointerEvents="none"
      {...props}
    />
  );
}
