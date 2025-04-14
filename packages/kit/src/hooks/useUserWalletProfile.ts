import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

export function useUserWalletProfile() {
  const { result: isSoftwareWalletOnlyUser } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceAccountProfile.isSoftwareWalletOnlyUser(),
    [],
    {
      initResult: false,
    },
  );
  return { isSoftwareWalletOnlyUser };
}
