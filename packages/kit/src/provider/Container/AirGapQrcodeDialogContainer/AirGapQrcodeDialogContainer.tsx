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

export function AirGapQrcodeDialogContainer() {
  const {
    start: startScan,
    // close,
  } = useScanQrCode();

  useEffect(() => {
    let hideQrToast: (extra?: { flag?: string }) => Promise<void>;

    const hideAllUiQrToast = (extra: { flag?: string }) => {
      appEventBus.emit(EAppEventBusNames.HideAirGapQrcode, extra);
    };

    const fn = (
      event: IAppEventBusPayload[EAppEventBusNames.ShowAirGapQrcode],
    ) => {
      const { drawType, valueUr, title } = event;
      void hideQrToast?.();
      const toast = SecureQRToast.show({
        title,
        valueUr,
        drawType,
        dismissOnOverlayPress: false,
        showConfirmButton: Boolean(event.promiseId),

        onConfirm: async () => {
          await hideQrToast?.({ flag: 'skipReject' });
          hideAllUiQrToast({ flag: 'skipReject' });

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
          await hideQrToast();
          hideAllUiQrToast({});
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
      hideQrToast = async (extra) => {
        await toast.close(extra);
      };
    };
    const hideFn = (
      event: IAppEventBusPayload[EAppEventBusNames.HideAirGapQrcode],
    ) => {
      void hideQrToast?.(event);
    };

    appEventBus.on(EAppEventBusNames.ShowAirGapQrcode, fn);
    appEventBus.on(EAppEventBusNames.HideAirGapQrcode, hideFn);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowAirGapQrcode, fn);
      appEventBus.off(EAppEventBusNames.HideAirGapQrcode, hideFn);
    };
  }, [startScan]);
  return null;
}
