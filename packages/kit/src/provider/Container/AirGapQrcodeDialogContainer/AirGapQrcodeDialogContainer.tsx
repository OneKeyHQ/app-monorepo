import { useEffect } from 'react';

import { resetScanModalRoute } from '@onekeyhq/components';
import {
  OneKeyErrorScanQrCodeCancel,
  SecureQRCodeDialogCancel,
} from '@onekeyhq/shared/src/errors';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EQRCodeHandlerNames } from '@onekeyhq/shared/types/qrCode';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { SecureQRToast } from '../../../components/SecureQRToast';
import useScanQrCodeLazy from '../../../views/ScanQrCode/hooks/useScanQrCodeLazy';
import {
  getAddressCreationRequestSignal,
  getAddressCreationRequestState,
  holdAddressCreationForChildScan,
} from '../../../views/ScanQrCode/utils/getAccountIdOnNetwork';

export function AirGapQrcodeDialogContainer() {
  const { start: startScan } = useScanQrCodeLazy();

  useEffect(() => {
    let hideQrToast: (extra?: { flag?: string }) => Promise<void>;

    const hideAllUiQrToast = (extra: { flag?: string }) => {
      appEventBus.emit(EAppEventBusNames.HideAirGapQrcode, extra);
    };

    const fn = (
      event: IAppEventBusPayload[EAppEventBusNames.ShowAirGapQrcode],
    ) => {
      const { valueUr, title, addressCreationRequest, promiseId } = event;
      const requestState = getAddressCreationRequestState(
        addressCreationRequest,
      );
      if (requestState === 'foreign') return;
      if (requestState === 'inactive') {
        if (promiseId) {
          void backgroundApiProxy.servicePromise.rejectCallback({
            id: promiseId,
            error: new OneKeyErrorScanQrCodeCancel(),
          });
        }
        return;
      }
      const scanSignal = getAddressCreationRequestSignal(
        addressCreationRequest,
      );
      const scanRequestId =
        addressCreationRequest && promiseId
          ? `air-gap:${promiseId}`
          : undefined;
      let scanning = false;
      let abort = () => {};
      void hideQrToast?.();
      const toast = SecureQRToast.show({
        title,
        valueUr,
        dismissOnOverlayPress: false,
        showConfirmButton: Boolean(event.promiseId),

        onConfirm: async () => {
          if (scanning) return;
          scanning = true;
          let release: (() => void) | undefined;
          try {
            await hideQrToast?.({ flag: 'skipReject' });
            hideAllUiQrToast({ flag: 'skipReject' });
            release = holdAddressCreationForChildScan(addressCreationRequest);
            const result = await startScan({
              handlers: [EQRCodeHandlerNames.animation],
              qrWalletScene: true,
              autoExecuteParsedAction: false,
              ...(scanRequestId ? { scanRequestId } : {}),
            });
            if (scanSignal?.aborted) throw new OneKeyErrorScanQrCodeCancel();
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
          } finally {
            release?.();
            scanSignal?.removeEventListener('abort', abort);
          }
        },
        onCancel: async () => {
          await hideQrToast();
          hideAllUiQrToast({});
        },
        onClose: async (params) => {
          if (!scanning) scanSignal?.removeEventListener('abort', abort);
          if (event.promiseId && params?.flag !== 'skipReject') {
            await backgroundApiProxy.servicePromise.rejectCallback({
              id: event.promiseId,
              error: toPlainErrorObject(new SecureQRCodeDialogCancel()),
            });
          }
        },
      });
      abort = () => {
        if (scanning && scanRequestId) {
          resetScanModalRoute({ scanRequestId });
        } else {
          void toast.close();
        }
      };
      if (scanSignal?.aborted) {
        abort();
      } else {
        scanSignal?.addEventListener('abort', abort, { once: true });
      }
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
