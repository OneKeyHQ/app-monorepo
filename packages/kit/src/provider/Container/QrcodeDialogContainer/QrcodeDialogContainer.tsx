import { useEffect } from 'react';

import { EQRCodeHandlerNames } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { SecureQRCodeDialogCancel } from '@onekeyhq/shared/src/errors';
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
      const { drawType, valueUr, title } = event;
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
              error: toPlainErrorObject(new SecureQRCodeDialogCancel()),
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
