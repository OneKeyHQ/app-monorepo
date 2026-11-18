import { useCallback, useEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ELiteCardRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EHardwareCallContext } from '@onekeyhq/shared/types/device';

import useAppNavigation from '../../../hooks/useAppNavigation';

export default function useReadMnemonic() {
  const navigation = useAppNavigation();
  const pendingCancels = useRef(new Set<() => void>());
  useEffect(
    () => () => {
      for (const cancel of pendingCancels.current) cancel();
      pendingCancels.current.clear();
    },
    [],
  );
  const readWalletIdFromSelectWallet = useCallback(
    () =>
      new Promise<string>((resolve, reject) => {
        let settled = false;
        const cancel = () => {
          if (settled) return;
          settled = true;
          pendingCancels.current.delete(cancel);
          reject(new OneKeyLocalError('Lite wallet selection cancelled'));
        };
        pendingCancels.current.add(cancel);
        navigation.pushModal(EModalRoutes.LiteCardModal, {
          screen: ELiteCardRoutes.LiteCardSelectWallet,
          params: {
            onPick: (wallet) => {
              if (settled) return;
              settled = true;
              pendingCancels.current.delete(cancel);
              resolve(wallet.id);
              navigation.popStack();
            },
            onCancel: cancel,
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
      await backgroundApiProxy.servicePassword.clearCachedPassword();
      const { password } =
        await backgroundApiProxy.servicePassword.promptPasswordVerifyByWallet({
          walletId,
          hardwareCallContext: EHardwareCallContext.BACKGROUND_TASK,
        });

      const { mnemonic } =
        await backgroundApiProxy.serviceAccount.getCredentialDecrypt({
          password,
          credentialId: walletId,
        });
      return {
        mnemonic,
        walletId,
      };
    },
    [readWalletIdFromSelectWallet],
  );
  return useMemo(
    () => ({ readMnemonicWithWalletId }),
    [readMnemonicWithWalletId],
  );
}
