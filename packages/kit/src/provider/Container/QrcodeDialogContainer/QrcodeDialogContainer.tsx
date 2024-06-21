import { useEffect } from 'react';

import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';

import { EQRCodeHandlerNames } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { SecureQRToast } from '../../../components/SecureQRToast';
import useScanQrCode from '../../../views/ScanQrCode/hooks/useScanQrCode';

export function QrcodeDialogContainer() {
  const {
    start: startScan,
    // close,
  } = useScanQrCode();

  useEffect(() => {
    const fn = (event: IAppEventBusPayload[EAppEventBusNames.ShowQrcode]) => {
      const {
        drawType,
        valueUr,
        title,
        // To achieve the effect of not opening the scanning page in a new Modal,
        //  the scanning route has been added by default in the router
        // packages/kit/src/routes/Modal/router.tsx 31L
        openInModal = false,
      } = event;
      const toast = SecureQRToast.show({
        title,
        valueUr,
        drawType,
        dismissOnOverlayPress: false,
        showConfirmButton: Boolean(event.promiseId),
        onConfirm: async () => {
          await toast.close({ flag: 'skipReject' });

          try {
            const result = await startScan({
              handlers: [EQRCodeHandlerNames.animation],
              qrWalletScene: true,
              autoHandleResult: false,
              openInModal,
            });
            console.log(result, result.raw);
            if (event.promiseId) {
              await backgroundApiProxy.servicePromise.resolveCallback({
                id: event.promiseId,
                data: result,
              });
            }
          } catch (error) {
            if (event.promiseId) {
              await backgroundApiProxy.servicePromise.rejectCallback({
                id: event.promiseId,
                error,
              });
            }
          }
        },
        onCancel: async () => {
          await toast.close();
        },
        onClose: async (params) => {
          if (event.promiseId && params?.flag !== 'skipReject') {
            await backgroundApiProxy.servicePromise.rejectCallback({
              id: event.promiseId,
              error: toPlainErrorObject(
                web3Errors.provider.userRejectedRequest(),
              ),
            });
          }
        },
      });
    };

    appEventBus.on(EAppEventBusNames.ShowQrcode, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowQrcode, fn);
    };
  }, [startScan]);
  return null;
}
