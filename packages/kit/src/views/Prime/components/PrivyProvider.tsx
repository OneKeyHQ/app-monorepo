import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';

import { usePrivyAuthSyncToAtom } from '../hooks/usePrivyAuthSyncToAtom';

function PrivyAuthSyncToAtom() {
  usePrivyAuthSyncToAtom();
  return null;
}

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.PRIVY_APP_ID;
  const clientId = process.env.PRIVY_MOBILE_CLIENT_ID;
  if (!appId) {
    throw new Error('PRIVY_APP_ID is not set');
  }
  if (!clientId) {
    throw new Error('PRIVY_MOBILE_CLIENT_ID is not set');
  }

  // TODO: ext error
  // Embedded wallet is only available over HTTPS
  return (
    <PrivyProviderBase
      appId={appId}
      config={{
        loginMethods: [
          'email',
          // 'apple', 'google', 'facebook', 'github'
        ],
        intl: {
          defaultCountry: 'CN',
        },
      }}
    >
      <PrivyAuthSyncToAtom />
      {children}
    </PrivyProviderBase>
  );
}

export function PrivyProviderNoop({ children }: { children: React.ReactNode }) {
  return children;
}
