import {
  PrivyElements,
  PrivyProvider as PrivyProviderBase,
} from '@privy-io/expo';

import { usePrivyAuthSyncToAtom } from '../hooks/usePrivyAuthSyncToAtom';

function PrivyAuthSyncToAtom() {
  usePrivyAuthSyncToAtom();
  return null;
}

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.PRIVY_APP_ID ?? '';
  const clientId = process.env.PRIVY_MOBILE_CLIENT_ID ?? '';
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
