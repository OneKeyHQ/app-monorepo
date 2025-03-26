import { useCallback } from 'react';

import { Dialog } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';

import { usePrimeAuthV2 } from './usePrimeAuthV2';

const PrimeLoginEmailDialogV2 = LazyLoadPage(
  () => import('../components/PrimeLoginEmailDialogV2/PrimeLoginEmailDialogV2'),
  0,
  true,
);

export function usePrimeLoginDialog() {
  const { logout } = usePrimeAuthV2();

  const showLoginDialog = useCallback(async () => {
    // logout before login, make sure local privy cache is cleared
    void logout();
    const loginDialog = Dialog.show({
      renderContent: (
        <PrimeLoginEmailDialogV2
          onComplete={() => {
            void loginDialog.close();
          }}
        />
      ),
    });
  }, [logout]);

  return { showLoginDialog };
}
