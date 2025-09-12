import {
  // PrivyElements,
  PrivyProvider as PrivyProviderBase,
} from '@privy-io/expo';

import {
  PRIVY_APP_ID,
  PRIVY_MOBILE_CLIENT_ID,
} from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  const appId = PRIVY_APP_ID;
  const clientId = PRIVY_MOBILE_CLIENT_ID;
  if (!appId) {
    throw new OneKeyLocalError('PRIVY_APP_ID is not set');
  }
  if (!clientId) {
    throw new OneKeyLocalError('PRIVY_MOBILE_CLIENT_ID is not set');
  }

  return (
    <PrivyProviderBase appId={appId} clientId={clientId}>
      {/* <PrivyElements /> */}
      {children}
    </PrivyProviderBase>
  );
}
