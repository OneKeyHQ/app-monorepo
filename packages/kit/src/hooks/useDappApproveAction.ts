import { useCallback, useEffect, useRef, useState } from 'react';

import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';

import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

const useSendRejectId = platformEnv.isExtensionUiSidePanel
  ? (id: number | string) => {
      useEffect(() => {
        appEventBus.emit(EAppEventBusNames.SidePanel_UIToBg, {
          type: 'dappRejectId',
          payload: {
            rejectId: id,
          },
        });
      }, [id]);
    }
  : () => {};

function useDappApproveAction({
  id,
  getResolveData,
  closeOnError,
  closeWindowAfterResolved,
}: {
  id: number | string;
  // Case of rejection only
  getResolveData?: () => Promise<any> | any;
  closeOnError?: boolean;
  closeWindowAfterResolved?: boolean;
}) {
  const isExtStandaloneWindow = platformEnv.isExtensionUiStandaloneWindow;
  const [rejectError, setRejectError] = useState<Error | null>(null);
  // Idempotency guards: the standalone window keeps the modal on screen (no
  // pop) until window.close() lands, so the buttons stay clickable for the
  // last frame(s) — the first resolve/reject wins and the rest are no-ops.
  // isHandledRef: resolve/reject already sent to bg — final, blocks everything.
  // isResolvingRef: resolve is awaiting getResolveData — blocks user clicks,
  // but NOT the forced reject fired when the window is closing (otherwise a
  // hung getResolveData would leave the bg promise pending forever and jam
  // ServiceDApp's request semaphore).
  const isHandledRef = useRef(false);
  const isResolvingRef = useRef(false);
  useEffect(() => {
    isHandledRef.current = false;
    isResolvingRef.current = false;
  }, [id]);
  useSendRejectId(id);
  const reject = useCallback(
    ({
      close,
      error,
      isForce,
    }: { close?: () => void; error?: Error; isForce?: boolean } = {}) => {
      if (!id) return;
      if (isHandledRef.current) return;
      if (isResolvingRef.current && !isForce) return;
      isHandledRef.current = true;
      // eslint-disable-next-line no-param-reassign
      const newError =
        error || rejectError || web3Errors.provider.userRejectedRequest();
      void backgroundApiProxy.servicePromise.rejectCallback({
        id,
        error: toPlainErrorObject(newError),
      });
      if (isExtStandaloneWindow) {
        // timeout wait reject done. Skip close() (modal pop): the whole
        // window is about to be destroyed, and popping the modal first
        // paints the Home tab underneath for a frame before window.close()
        // lands.
        setTimeout(() => {
          window.close();
        }, 0);
      } else {
        close?.();
      }
    },
    [id, isExtStandaloneWindow, rejectError],
  );

  const resolve = useCallback(
    async ({ close, result }: { close?: () => void; result?: any } = {}) => {
      if (!id) return;
      if (isHandledRef.current || isResolvingRef.current) return;
      isResolvingRef.current = true;
      try {
        setRejectError(null);
        const data = result ?? (await getResolveData?.());
        if (isHandledRef.current) {
          // A forced reject (window closing) settled the request while the
          // resolve payload was being built — drop this resolve.
          return;
        }
        isHandledRef.current = true;
        void backgroundApiProxy.servicePromise.resolveCallback({
          id,
          data,
        });
        if (isExtStandaloneWindow && closeWindowAfterResolved) {
          // Skip close() (modal pop): the whole window is about to be
          // destroyed, and popping the modal first paints the Home tab
          // underneath for a frame before window.close() lands.
          setTimeout(() => {
            window.close();
          }, 0);
        } else {
          close?.();
        }
      } catch (error) {
        console.error('getResolveData ERROR:', error);
        setRejectError(error as Error);
        throw error;
      } finally {
        // On failure this re-arms retry (and the closeOnError auto-reject
        // below); after success isHandledRef keeps blocking further calls.
        isResolvingRef.current = false;
      }
    },
    [getResolveData, id, isExtStandaloneWindow, closeWindowAfterResolved],
  );

  useEffect(() => {
    if (rejectError && closeOnError) {
      reject();
    }
  }, [closeOnError, reject, rejectError]);

  // also trigger browser refresh
  useEffect(() => {
    // const registerWindowUnload = isExt && !platformEnv.isDev;
    const registerWindowUnload = isExtStandaloneWindow;
    // TODO do not reject with hardware interaction when before-unload
    if (registerWindowUnload) {
      // isForce: the window is going away — this reject must reach bg even
      // while a resolve is mid-flight, or the request semaphore jams.
      window.addEventListener('beforeunload', () => reject({ isForce: true }));
    }
    return () => {
      if (registerWindowUnload) {
        window.removeEventListener('beforeunload', () =>
          reject({ isForce: true }),
        );
      }
    };
  }, [isExtStandaloneWindow, reject]);

  return {
    reject,
    resolve,
  };
}

export default useDappApproveAction;
