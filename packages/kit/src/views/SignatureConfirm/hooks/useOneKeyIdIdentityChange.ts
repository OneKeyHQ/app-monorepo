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
// mounted (never on mount). A change seen while `enabled` is false — e.g.
// during submission — is held, not dropped, and delivered once the caller
// re-enables the hook, so a failed attempt can never retry a quote that was
// estimated for the previous identity. Several changes while disabled
// collapse into one delivery.
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
  const pendingChangeRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (lastIdentityKeyRef.current !== identityKey) {
      lastIdentityKeyRef.current = identityKey;
      pendingChangeRef.current = true;
    }
    if (!enabled || !pendingChangeRef.current) {
      return;
    }
    pendingChangeRef.current = false;
    onChangeRef.current();
  }, [enabled, identityKey]);
}
