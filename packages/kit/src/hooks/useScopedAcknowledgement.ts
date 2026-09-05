import { useCallback, useMemo, useState } from 'react';

export function useScopedAcknowledgement(scopeKey: string) {
  const scope = useMemo(() => ({ key: scopeKey }), [scopeKey]);
  const [acceptedScope, setAcceptedScope] = useState<typeof scope>();
  const setAccepted = useCallback(
    (accepted: boolean) => setAcceptedScope(accepted ? scope : undefined),
    [scope],
  );

  return {
    isAccepted: acceptedScope === scope,
    setAccepted,
  };
}
