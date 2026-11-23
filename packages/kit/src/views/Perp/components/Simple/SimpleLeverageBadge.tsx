import { LeverageBadge } from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';

export function SimpleLeverageBadge({ leverage }: { leverage: number }) {
  return (
    <LeverageBadge
      leverage={leverage}
      borderRadius="$full"
      compact
      minWidth={28}
    />
  );
}
