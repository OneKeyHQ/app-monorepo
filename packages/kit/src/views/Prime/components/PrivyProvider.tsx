import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';

import {
  PRIVY_APP_ID,
  PRIVY_MOBILE_CLIENT_ID,
} from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyPlainTextError } from '@onekeyhq/shared/src/errors';

import { PrimeGlobalEffect } from '../hooks/PrimeGlobalEffect';

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  const appId = PRIVY_APP_ID;
  const clientId = PRIVY_MOBILE_CLIENT_ID;
  if (!appId) {
    throw new OneKeyPlainTextError('PRIVY_APP_ID is not set');
  }
  if (!clientId) {
    throw new OneKeyPlainTextError('PRIVY_MOBILE_CLIENT_ID is not set');
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
      <PrimeGlobalEffect />
      {children}
    </PrivyProviderBase>
  );
}

export function PrivyProviderNoop({ children }: { children: React.ReactNode }) {
  return children;
}
