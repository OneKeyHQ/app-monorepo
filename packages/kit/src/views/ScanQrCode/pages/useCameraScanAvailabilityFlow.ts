import { useCallback, useEffect, useRef } from 'react';

import { startAvailabilityFlow } from '@onekeyhq/shared/src/request/availabilityMetrics';
import type { IAvailabilityFlowHandle } from '@onekeyhq/shared/src/request/availabilityMetrics';

import {
  getCameraFlowUnmountResult,
  getCameraScanFlowResult,
  getQrScanFlowErrorResult,
} from './scanQrCodeAvailability';

import type {
  IScanQrCodeAvailabilityScene,
  IScanQrCodeCallbackResult,
} from './scanQrCodeAvailability';

type ICameraScanAvailabilityFlow = {
  handle: IAvailabilityFlowHandle;
  /** Scans of this flow still awaiting the route callback. */
  pendingScans: number;
};

/**
 * Counts one `qr_camera` flow per mount of the scan page (and per scene).
 *
 * Returns a stable wrapper for the camera scan callback. The wrapper passes the
 * callback result and error through unchanged, and attributes the outcome to
 * the flow that was current when the scan started, so a scan that closes the
 * page still reports its own outcome after the unmount.
 */
export function useCameraScanAvailabilityFlow(
  scene: IScanQrCodeAvailabilityScene,
) {
  const cameraFlowRef = useRef<ICameraScanAvailabilityFlow | undefined>(
    undefined,
  );

  useEffect(() => {
    const cameraFlow: ICameraScanAvailabilityFlow = {
      handle: startAvailabilityFlow('qr_camera', { detail: scene }),
      pendingScans: 0,
    };
    cameraFlowRef.current = cameraFlow;
    return () => {
      const unmountResult = getCameraFlowUnmountResult(cameraFlow);
      if (unmountResult) {
        cameraFlow.handle.finish(unmountResult);
      }
      if (cameraFlowRef.current === cameraFlow) {
        cameraFlowRef.current = undefined;
      }
    };
  }, [scene]);

  return useCallback(
    async <TResult extends IScanQrCodeCallbackResult>(
      value: string,
      scan: (value: string) => Promise<TResult>,
    ): Promise<TResult> => {
      const cameraFlow = cameraFlowRef.current;
      if (cameraFlow) {
        cameraFlow.pendingScans += 1;
      }
      let result: TResult;
      try {
        result = await scan(value);
      } catch (error) {
        cameraFlow?.handle.finish(getQrScanFlowErrorResult(error));
        throw error;
      } finally {
        if (cameraFlow) {
          cameraFlow.pendingScans -= 1;
        }
      }
      if (cameraFlow) {
        const scanResult = getCameraScanFlowResult({
          value,
          result,
          isFlowCurrent: cameraFlowRef.current === cameraFlow,
          pendingScans: cameraFlow.pendingScans,
        });
        if (scanResult) {
          cameraFlow.handle.finish(scanResult);
        }
      }
      return result;
    },
    [],
  );
}
