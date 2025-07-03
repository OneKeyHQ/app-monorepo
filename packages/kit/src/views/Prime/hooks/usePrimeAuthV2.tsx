// import { useCallback, useMemo } from 'react';

// import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

// import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

// import { usePrivyUniversalV2 } from './usePrivyUniversalV2';

export function usePrimeAuthV2() {
  // const [user] = usePrimePersistAtom();

  // const {
  //   logout: sdkLogout,
  //   getAccessToken,
  //   isReady,
  //   authenticated,
  //   useLoginWithEmail,
  //   privyUser,
  // } = usePrivyUniversalV2();

  // const apiLogout = useCallback(async () => {
  //   await backgroundApiProxy.servicePrime.apiLogout();
  // }, []);

  // const logout: () => Promise<void> = useCallback(async () => {
  //   try {
  //     await apiLogout();
  //   } finally {
  //     await sdkLogout();
  //   }
  // }, [apiLogout, sdkLogout]);

  // return useMemo(() => {
  //   return {
  //     isLoggedIn: user?.isLoggedIn && user?.isLoggedInOnServer,
  //     isPrimeSubscriptionActive: user?.primeSubscription?.isActive,
  //     user,
  //     logout,
  //     // apiLogout,
  //     // sdkLogout,
  //     getAccessToken,
  //     isReady,
  //     authenticated,
  //     useLoginWithEmail,
  //     privyUser,
  //   };
  // }, [
  //   authenticated,
  //   getAccessToken,
  //   isReady,
  //   logout,
  //   privyUser,
  //   useLoginWithEmail,
  //   user,
  // ]);
  return {
    isLoggedIn: false,
    isPrimeSubscriptionActive: false,
    user: {
      isLoggedIn: false,
      isLoggedInOnServer: false,
      privyUserId: '',
      primeSubscription: {
        isActive: false,
      },
    },
    logout: () => Promise.resolve(),
    getAccessToken: () => Promise.resolve(''),
    isReady: false,
    authenticated: false,
  };
}
