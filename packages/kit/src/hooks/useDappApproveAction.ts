import { useCallback, useEffect, useRef, useState } from 'react';

import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';

import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

// Paint an opaque DOM-level cover over the whole window the moment a
// decision is made. Page.Footer auto-pops the page after onCancel/onConfirm
// (FooterCancelButton calls pop() when the handler takes no arguments), and
// that pop would flash the Home tab during the frames between the decision
// and window.close() landing. A plain DOM node wins over any React re-render
// with zero timing assumptions.
function coverExtStandaloneWindowUntilClose() {
  const isTransparent = (color: string) =>
    !color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)';
  let backgroundColor = '';
  const candidates = [
    document.querySelector('.onekey-modal-screen'),
    document.body,
    document.documentElement,
  ];
  for (const el of candidates) {
    if (el) {
      const color = getComputedStyle(el).backgroundColor;
      if (!isTransparent(color)) {
        backgroundColor = color;
        break;
      }
    }
  }
  // Fallback only when every candidate resolved transparent: pick by color
  // scheme so a dark-themed window is not covered with a white flash.
  const prefersDark =
    globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
  const cover = document.createElement('div');
  cover.style.cssText = `position:fixed;inset:0;z-index:2147483647;background-color:${
    backgroundColor || (prefersDark ? '#0b0b0b' : '#ffffff')
  };`;
  document.body.appendChild(cover);
}

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
  // Idempotency guards — STANDALONE-WINDOW ONLY. Everywhere else the modal
  // pops on decision so its buttons physically disappear and can't be double
  // clicked; those flows must keep their original behavior untouched. In the
  // standalone window the modal stays on screen (no pop) until window.close()
  // lands, so the buttons remain clickable for the last frame(s) and need a
  // guard: the first resolve/reject wins and the rest are no-ops.
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
      if (isExtStandaloneWindow) {
        if (isHandledRef.current) return;
        if (isResolvingRef.current && !isForce) return;
      }
      // eslint-disable-next-line no-param-reassign
      const newError =
        error || rejectError || web3Errors.provider.userRejectedRequest();
      if (isExtStandaloneWindow) {
        // Await the ack inside an IIFE — reject stays a sync void so its many
        // fire-and-forget callers don't trip no-floating-promises — so the
        // reject reaches bg (settling ServiceDApp's semaphore) BEFORE the
        // window is destroyed. Marking isHandledRef early + fire-and-forget +
        // setTimeout(0) close could destroy the window before the bridge
        // delivered the reject, while the beforeunload backstop was
        // short-circuited by isHandledRef — leaving the semaphore stuck until
        // timeout. isHandledRef is set only AFTER the ack, so an in-flight
        // close still lets the beforeunload reject fire as a backstop. (review)
        void (async () => {
          await backgroundApiProxy.servicePromise.rejectCallback({
            id,
            error: toPlainErrorObject(newError),
          });
          isHandledRef.current = true;
          // Page.Footer still auto-pops after this returns; cover + destroy the
          // window (skipping the modal pop that would flash Home).
          coverExtStandaloneWindowUntilClose();
          window.close();
        })();
      } else {
        void backgroundApiProxy.servicePromise.rejectCallback({
          id,
          error: toPlainErrorObject(newError),
        });
        close?.();
      }
    },
    [id, isExtStandaloneWindow, rejectError],
  );

  const resolve = useCallback(
    async ({ close, result }: { close?: () => void; result?: any } = {}) => {
      if (!id) return;
      if (
        isExtStandaloneWindow &&
        (isHandledRef.current || isResolvingRef.current)
      ) {
        return;
      }
      if (isExtStandaloneWindow) {
        isResolvingRef.current = true;
      }
      try {
        setRejectError(null);
        const data = result ?? (await getResolveData?.());
        if (isExtStandaloneWindow && isHandledRef.current) {
          // A forced reject (window closing) settled the request while the
          // resolve payload was being built — drop this resolve.
          return;
        }
        if (isExtStandaloneWindow && closeWindowAfterResolved) {
          // Await the ack so the resolve reaches bg (settling the semaphore)
          // before the window is destroyed; set isHandledRef only after, so
          // the beforeunload reject stays a backstop until then. (review)
          await backgroundApiProxy.servicePromise.resolveCallback({
            id,
            data,
          });
          isHandledRef.current = true;
          // Page.Footer still auto-pops after this returns; cover + destroy the
          // window (skipping the modal pop that would flash Home).
          coverExtStandaloneWindowUntilClose();
          window.close();
        } else {
          if (isExtStandaloneWindow) {
            isHandledRef.current = true;
          }
          void backgroundApiProxy.servicePromise.resolveCallback({
            id,
            data,
          });
          close?.();
        }
      } catch (error) {
        console.error('getResolveData ERROR:', error);
        setRejectError(error as Error);
        throw error;
      } finally {
        if (isExtStandaloneWindow) {
          // On failure this re-arms retry (and the closeOnError auto-reject
          // below); after success isHandledRef keeps blocking further calls.
          isResolvingRef.current = false;
        }
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
    if (!isExtStandaloneWindow) {
      return undefined;
    }
    // Use one stable reference for add/remove so cleanup actually detaches the
    // listener. With two separate arrow functions the removeEventListener is a
    // no-op, and a dependency change (e.g. rejectError) that re-runs this
    // effect would leave a stale beforeunload handler — on window close both
    // the stale and the new handler fire, double-calling reject (the stale one
    // possibly with an already-invalid id).
    // isForce: the window is going away — this reject must reach bg even while
    // a resolve is mid-flight, or the request semaphore jams. reject returns
    // sync (its ack await runs in a detached IIFE); beforeunload won't await
    // that, so the rejectCallback message is dispatched best-effort before
    // teardown.
    // TODO do not reject with hardware interaction when before-unload
    const handleBeforeUnload = () => reject({ isForce: true });
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isExtStandaloneWindow, reject]);

  return {
    reject,
    resolve,
  };
}

export default useDappApproveAction;
