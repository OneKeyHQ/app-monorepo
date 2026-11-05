import { useCallback, useLayoutEffect, useRef } from 'react';

import { useCommittedEarnScopeGuard } from '@onekeyhq/kit/src/views/Staking/hooks/useCommittedEarnScopeGuard';

export function useBorrowConfirmationScope(key: string) {
  const scope = useCommittedEarnScopeGuard(key);
  const lifecycleRef = useRef({ scope, revision: 0, mounted: false });
  useLayoutEffect(() => {
    const lifecycle = lifecycleRef.current;
    if (lifecycle.scope !== scope) {
      lifecycle.scope = scope;
      lifecycle.revision += 1;
    }
    lifecycle.mounted = true;
    return () => {
      lifecycle.mounted = false;
    };
  }, [scope]);

  return useCallback(
    (canContinueAfterOwnerClose?: () => boolean) => {
      const isOwnedCurrent = scope.capture();
      const revision = lifecycleRef.current.revision;
      return {
        isOwnedCurrent,
        isCurrent: () =>
          isOwnedCurrent() ||
          (Boolean(canContinueAfterOwnerClose?.()) &&
            !lifecycleRef.current.mounted &&
            lifecycleRef.current.scope === scope &&
            lifecycleRef.current.revision === revision),
      };
    },
    [scope],
  );
}
