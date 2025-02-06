import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { usePrivyUniversalV2 } from './usePrivyUniversalV2';

export function usePrimeAuthV2() {
  const [primePersistAtom] = usePrimePersistAtom();

  const { logout, getAccessToken, isReady, authenticated } =
    usePrivyUniversalV2();

  return {
    user: primePersistAtom,
    logout,
    getAccessToken,
    isReady,
    authenticated,
  };
}
