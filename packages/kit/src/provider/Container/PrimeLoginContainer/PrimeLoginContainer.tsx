import { useEffect, useRef } from 'react';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';
import type { IPrimeLoginDialogAtomPasswordData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { usePrimeLoginDialogAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { PrimeLoginEmailCodeDialog } from '../../../views/Prime/components/PrimeLoginEmailCodeDialog';
import { PrimeLoginEmailDialog } from '../../../views/Prime/components/PrimeLoginEmailDialog';
import { PrimeLoginPasswordDialog } from '../../../views/Prime/components/PrimeLoginPasswordDialog';

export function PrimeLoginContainer() {
  const [
    {
      promptPrimeLoginEmailDialog,
      promptPrimeLoginPasswordDialog,
      promptPrimeLoginEmailCodeDialog,
    },
  ] = usePrimeLoginDialogAtom();

  const passwordDataRef = useRef<IPrimeLoginDialogAtomPasswordData | undefined>(
    undefined,
  );
  passwordDataRef.current = promptPrimeLoginPasswordDialog;

  const emailDialogRef = useRef<IDialogInstance | undefined>(undefined);
  const passwordDialogRef = useRef<IDialogInstance | undefined>(undefined);
  const emailCodeDialogRef = useRef<IDialogInstance | undefined>(undefined);

  useEffect(() => {
    void (async () => {
      if (promptPrimeLoginEmailDialog) {
        await emailDialogRef.current?.close();
        emailDialogRef.current = Dialog.show({
          renderContent: (
            <PrimeLoginEmailDialog promiseId={promptPrimeLoginEmailDialog} />
          ),
          onClose: async () => {
            await backgroundApiProxy.servicePrime.cancelPrimeLogin({
              promiseId: promptPrimeLoginEmailDialog,
              dialogType: 'promptPrimeLoginEmailDialog',
            });
          },
        });
      } else {
        await emailDialogRef.current?.close();
      }
    })();
  }, [promptPrimeLoginEmailDialog]);

  useEffect(() => {
    void (async () => {
      if (promptPrimeLoginPasswordDialog?.promiseId) {
        await passwordDialogRef.current?.close();
        passwordDialogRef.current = Dialog.show({
          renderContent: (
            <PrimeLoginPasswordDialog
              data={passwordDataRef.current}
              promiseId={promptPrimeLoginPasswordDialog?.promiseId}
            />
          ),
          onClose: async () => {
            await backgroundApiProxy.servicePrime.cancelPrimeLogin({
              promiseId: promptPrimeLoginPasswordDialog?.promiseId,
              dialogType: 'promptPrimeLoginPasswordDialog',
            });
          },
        });
      } else {
        await passwordDialogRef.current?.close();
      }
    })();
  }, [promptPrimeLoginPasswordDialog?.promiseId]);

  useEffect(() => {
    void (async () => {
      if (promptPrimeLoginEmailCodeDialog?.promiseId) {
        await emailCodeDialogRef.current?.close();
        emailCodeDialogRef.current = Dialog.show({
          renderContent: (
            <PrimeLoginEmailCodeDialog
              promiseId={promptPrimeLoginEmailCodeDialog?.promiseId}
            />
          ),
          onClose: async () => {
            await backgroundApiProxy.servicePrime.cancelPrimeLogin({
              promiseId: promptPrimeLoginEmailCodeDialog?.promiseId,
              dialogType: 'promptPrimeLoginEmailCodeDialog',
            });
          },
        });
      } else {
        await emailCodeDialogRef.current?.close();
      }
    })();
  }, [promptPrimeLoginEmailCodeDialog?.promiseId]);

  return null;
}
