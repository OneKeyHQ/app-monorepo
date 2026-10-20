import { useEffect, useRef } from 'react';

import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

// Identity the Gas Account member dimension compares (OK-64746): the member,
// not the token string. A token refresh for the same member keeps the key,
// so only login, logout and account switches change it.
export function getOneKeyIdIdentityKey(prime: {
  isLoggedIn?: boolean;
  onekeyUserId?: string;
}): string {
  if (!prime.isLoggedIn) {
    return 'anonymous';
  }
  return `member:${prime.onekeyUserId ?? ''}`;
}

// Calls `onChange` when the OneKey ID identity changes while the caller is
// mounted (never on mount). A change seen while disabled is consumed, not
// deferred: the backend's identity check at send time (90221) remains the
// safety net for anything the page could not re-estimate in time.
export function useOneKeyIdIdentityChange({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: () => void;
}) {
  const [prime] = usePrimePersistAtom();
  const identityKey = getOneKeyIdIdentityKey(prime);
  const lastIdentityKeyRef = useRef(identityKey);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (lastIdentityKeyRef.current === identityKey) {
      return;
    }
    lastIdentityKeyRef.current = identityKey;
    if (!enabled) {
      return;
    }
    onChangeRef.current();
  }, [enabled, identityKey]);
}
