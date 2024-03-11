import { useCallback, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { ELiteCardRoutes } from '../router/types';

export default function useReadMnemonic() {
  const navigation = useAppNavigation();
  const readWalletIdFromSelectWallet = useCallback(
    () =>
      new Promise<string>((resolve) => {
        navigation.pushModal(EModalRoutes.LiteCardModal, {
          screen: ELiteCardRoutes.LiteCardSelectWallet,
          params: {
            onPick: async (wallet) => {
              navigation.popStack();
              resolve(wallet.id);
            },
          },
        });
      }),
    [navigation],
  );
  const readMnemonicWithWalletId = useCallback(
    async (_walletId: string | undefined) => {
      let walletId = _walletId;
      if (!walletId) {
        walletId = await readWalletIdFromSelectWallet();
      }
      const { password } =
        await backgroundApiProxy.servicePassword.promptPasswordVerify();

      const { mnemonic } =
        await backgroundApiProxy.serviceAccount.getCredentialDecrypt({
          password,
          credentialId: walletId,
        });
      return mnemonic;
    },
    [readWalletIdFromSelectWallet],
  );
  return useMemo(
    () => ({ readMnemonicWithWalletId }),
    [readMnemonicWithWalletId],
  );
}
