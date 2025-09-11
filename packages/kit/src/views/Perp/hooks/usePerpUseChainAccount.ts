import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useCurrentAccountAtom,
  useCurrentUserAtom,
} from '../../../states/jotai/contexts/hyperliquid/atoms';

export function usePerpUseChainAccount() {
  const [userAddress] = useCurrentUserAtom();
  const [userAccountId] = useCurrentAccountAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });

  return {
    userAddress,
    userAccountId,
    activeAccountId: activeAccount?.account?.id,
    activeAccountIndexedId: activeAccount?.indexedAccount?.id,
  };
}
