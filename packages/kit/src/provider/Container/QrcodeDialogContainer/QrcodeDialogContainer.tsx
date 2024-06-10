import { useEffect } from 'react';

import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';

import { Dialog, QRCode, Stack } from '@onekeyhq/components';
import { EQRCodeHandlerNames } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useScanQrCode from '../../../views/ScanQrCode/hooks/useScanQrCode';

export function QrcodeDialogContainer() {
  const {
    start: startScan,
    // close,
  } = useScanQrCode();

  useEffect(() => {
    const fn = (event: IAppEventBusPayload[EAppEventBusNames.ShowQrcode]) => {
      const { drawType, valueUr, title } = event;
      const dialog = Dialog.show({
        title: title || 'Scan QR Code',
        showConfirmButton: Boolean(event.promiseId),
        onConfirmText: 'Next',
        onConfirm: async () => {
          await dialog.close({ flag: 'skipReject' });

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
        renderContent: (
          <Stack alignItems="center" justifyContent="center">
            <QRCode size={300} valueUr={valueUr} drawType={drawType} />
          </Stack>
        ),
      });
    };

    appEventBus.on(EAppEventBusNames.ShowQrcode, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowQrcode, fn);
    };
  }, [startScan]);
  return null;
}
