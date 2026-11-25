import type { IEarnWindowScope } from '@onekeyhq/shared/src/routes';

import { useEarnAccount } from '../../Staking/hooks/useEarnAccount';
import {
  matchesEarnWindowScope,
  useEarnWindowReturn,
  useEarnWindowScope,
} from '../earnWindowReturn';

export function ScopedEarnWindowReturn({ scope }: { scope: IEarnWindowScope }) {
  const { earnAccount } = useEarnAccount({ networkId: scope.networkId });
  const actualScope = useEarnWindowScope({
    accountId: earnAccount?.account?.id,
    indexedAccountId: earnAccount?.account?.indexedAccountId,
    networkId: scope.networkId,
  });
  useEarnWindowReturn(
    matchesEarnWindowScope(scope, actualScope) ? actualScope : undefined,
  );
  return null;
}
