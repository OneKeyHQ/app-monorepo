import {
  PrivyElements,
  PrivyProvider as PrivyProviderBase,
} from '@privy-io/expo';

import {
  PRIVY_APP_ID,
  PRIVY_MOBILE_CLIENT_ID,
} from '@onekeyhq/shared/src/consts/primeConsts';

import { usePrivyAuthSyncToAtom } from '../hooks/usePrivyAuthSyncToAtom';

function PrivyAuthSyncToAtom() {
  usePrivyAuthSyncToAtom();
  return null;
}

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  const appId = PRIVY_APP_ID;
  const clientId = PRIVY_MOBILE_CLIENT_ID;
  if (!appId) {
    throw new Error('PRIVY_APP_ID is not set');
  }
  if (!clientId) {
    throw new Error('PRIVY_MOBILE_CLIENT_ID is not set');
  }

  return (
    <PrivyProviderBase appId={appId} clientId={clientId}>
      <PrivyElements />
      <PrivyAuthSyncToAtom />
      {children}
    </PrivyProviderBase>
  );
}
