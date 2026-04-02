import { useEffect, useRef } from 'react';

import { useKeylessDialogAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useKeylessWalletMethods } from '../../../components/KeylessWallet/useKeylessWallet';

export function KeylessWalletContainer() {
  const [{ promptKeylessAuthPackDialog }] = useKeylessDialogAtom();
  const { getAuthPackFromServer } = useKeylessWalletMethods();
  const processingPromiseIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    void (async () => {
      if (
        promptKeylessAuthPackDialog &&
        processingPromiseIdRef.current !== promptKeylessAuthPackDialog
      ) {
        const promiseId = promptKeylessAuthPackDialog;
        processingPromiseIdRef.current = promiseId;
        try {
          const authPack = await getAuthPackFromServer();
          await backgroundApiProxy.serviceKeylessWallet.resolveKeylessAuthPackDialog(
            {
              promiseId,
              authPack,
            },
          );
        } catch (error) {
          // User cancelled or error occurred
          await backgroundApiProxy.serviceKeylessWallet.rejectKeylessAuthPackDialog(
            {
              promiseId,
              error: errorUtils.toPlainErrorObject(error),
            },
          );
        } finally {
          if (processingPromiseIdRef.current === promiseId) {
            processingPromiseIdRef.current = undefined;
          }
        }
      }
    })();
  }, [promptKeylessAuthPackDialog, getAuthPackFromServer]);

  return null;
}
