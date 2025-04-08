import { useEffect, useRef } from 'react';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog, Stack } from '@onekeyhq/components';
import type { IPrimeLoginDialogAtomPasswordData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { usePrimeLoginDialogAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { PrimeDeviceLogoutAlertDialog } from '../../../views/Prime/components/PrimeDeviceLogoutAlertDialog';
import { PrimeForgetMasterPasswordDialog } from '../../../views/Prime/components/PrimeForgetMasterPasswordDialog';
import { PrimeLoginPasswordDialog } from '../../../views/Prime/components/PrimeLoginPasswordDialog';
import { PrimeMasterPasswordInvalidDialog } from '../../../views/Prime/components/PrimeMasterPasswordInvalidDialog';

// TODO rename to PrimeDialogContainer
export function PrimeLoginContainer() {
  const [
    {
      promptPrimeLoginEmailDialog,
      promptPrimeLoginPasswordDialog,
      promptPrimeLoginEmailCodeDialog,
      promptForgetMasterPasswordDialog,
    },
  ] = usePrimeLoginDialogAtom();
  const navigation = useAppNavigation();

  const passwordDataRef = useRef<IPrimeLoginDialogAtomPasswordData | undefined>(
    undefined,
  );
  passwordDataRef.current = promptPrimeLoginPasswordDialog;

  const emailDialogRef = useRef<IDialogInstance | undefined>(undefined);
  const passwordDialogRef = useRef<IDialogInstance | undefined>(undefined);
  const emailCodeDialogRef = useRef<IDialogInstance | undefined>(undefined);
  const forgetMasterPasswordDialogRef = useRef<IDialogInstance | undefined>(
    undefined,
  );

  useEffect(() => {
    void (async () => {
      if (promptPrimeLoginEmailDialog) {
        await emailDialogRef.current?.close();
        emailDialogRef.current = Dialog.show({
          renderContent: (
            <Stack />
            // <PrimeLoginEmailDialog promiseId={promptPrimeLoginEmailDialog} />
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
          dismissOnOverlayPress: false,
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
      if (promptForgetMasterPasswordDialog?.promiseId) {
        await forgetMasterPasswordDialogRef.current?.close();
        forgetMasterPasswordDialogRef.current = Dialog.show({
          renderContent: (
            <PrimeForgetMasterPasswordDialog
              promiseId={promptForgetMasterPasswordDialog?.promiseId}
            />
          ),
          onClose: async () => {
            await backgroundApiProxy.servicePrime.cancelPrimeLogin({
              promiseId: promptForgetMasterPasswordDialog?.promiseId,
              dialogType: 'promptForgetMasterPasswordDialog',
            });
          },
        });
      } else {
        await forgetMasterPasswordDialogRef.current?.close();
      }
    })();
  }, [promptForgetMasterPasswordDialog?.promiseId]);

  useEffect(() => {
    void (async () => {
      if (promptPrimeLoginEmailCodeDialog?.promiseId) {
        await emailCodeDialogRef.current?.close();
        emailCodeDialogRef.current = Dialog.show({
          renderContent: (
            <Stack />
            // <PrimeLoginEmailCodeDialog
            //   promiseId={promptPrimeLoginEmailCodeDialog?.promiseId}
            // />
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

  useEffect(() => {
    const fn = () => {
      navigation.pushFullModal(EModalRoutes.PrimeModal, {
        screen: EPrimePages.PrimeDeviceLimit,
        params: {
          isExceedDeviceLimit: true,
        },
      });
    };
    appEventBus.on(EAppEventBusNames.PrimeExceedDeviceLimit, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeExceedDeviceLimit, fn);
    };
  }, [navigation]);

  useEffect(() => {
    const fn = () => {
      Dialog.show({
        renderContent: <PrimeDeviceLogoutAlertDialog />,
      });
    };
    appEventBus.on(EAppEventBusNames.PrimeDeviceLogout, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeDeviceLogout, fn);
    };
  }, []);

  useEffect(() => {
    const fn = () => {
      Dialog.show({
        dismissOnOverlayPress: false,
        disableDrag: true,
        renderContent: <PrimeMasterPasswordInvalidDialog />,
      });
    };
    appEventBus.on(EAppEventBusNames.PrimeMasterPasswordInvalid, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeMasterPasswordInvalid, fn);
    };
  }, []);

  return null;
}
