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
  const appId = 'cm6c9xup40017zyrnnp8zh0bt';
  const clientId = 'client-WY5gESiXQgTXogYv2M8iCM3LaaDDaKAdigE9Bg7a9pr1W';
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
