import { useLayoutEffect, useRef, useState } from 'react';

import { createEarnActionScopeGuard } from '../utils/utils';

type IScope = {
  key: string;
  capture: () => () => boolean;
  invalidate: () => void;
  isCurrent: () => boolean;
};

export function useCommittedEarnScopeGuard(key: string) {
  const committedRef = useRef<IScope | undefined>(undefined);
  const createScope = (scopeKey: string): IScope => {
    const guard = createEarnActionScopeGuard();
    const nextScope: IScope = {
      key: scopeKey,
      capture: () => {
        const isCurrent = guard.capture();
        return () => committedRef.current === nextScope && isCurrent();
      },
      invalidate: () => guard.invalidate(),
      isCurrent: () => committedRef.current === nextScope,
    };
    return nextScope;
  };
  const [scope, setScope] = useState(() => createScope(key));
  if (scope.key !== key) setScope(createScope(key));
  useLayoutEffect(() => {
    committedRef.current = scope;
    return () => {
      if (committedRef.current === scope) committedRef.current = undefined;
      scope.invalidate();
    };
  }, [scope]);
  return scope;
}
