import { YStack } from '@onekeyhq/components';

import { LocalWalletPoolStatus } from './LocalWalletPoolStatus';
import { useLocalWalletPool } from './useLocalWalletPool';

// Account settings composition: owns the hook so the route page stays thin
// and tests can mock this one component.
export function LocalWalletAccountPanel({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  const pool = useLocalWalletPool({ networkId, accountId });
  return (
    <YStack px="$5">
      <LocalWalletPoolStatus
        networkId={networkId}
        accountId={accountId}
        pool={pool}
        settingsMode
      />
    </YStack>
  );
}
