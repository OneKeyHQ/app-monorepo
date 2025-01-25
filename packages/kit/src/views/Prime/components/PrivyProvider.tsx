import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';

import { usePrivyAuthSyncToAtom } from '../hooks/usePrivyAuthSyncToAtom';

function PrivyAuthSyncToAtom() {
  usePrivyAuthSyncToAtom();
  return null;
}

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.PRIVY_APP_ID ?? 'cm5599w1609v7kfpecfmser60';
  const clientId =
    process.env.PRIVY_MOBILE_CLIENT_ID ??
    'client-WY5fBvyK4K8iTegm8s91XNttaKsDN9mJeTJUu1FXxckKp';
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
