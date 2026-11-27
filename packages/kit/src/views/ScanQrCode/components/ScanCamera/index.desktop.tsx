import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import type { MouseEvent } from 'react';

import { decodeQrImageSymbols } from '@onekeyfe/react-native-qr-scanner/web';
import { StyleSheet, View } from 'react-native';

import { desktopQrPreviewPrefix } from '@onekeyhq/shared/types/desktopQrScanner';

import { supportsDesktopQrCapture } from './cameraChoice';
import {
  mapDomFocusPoint,
  readDomFocusPoint,
  useDomFocusBox,
} from './FocusBox';
import { ScanCamera as WebScanCamera } from './index.tsx';
import { ensureWebQrScannerConfigured } from './webQrScanner';

import type { IScanCameraProps, IScanCameraRef } from './types';
import type { IMultiQrFrameEvent } from '../../utils/multiQrSymbols';

export type {
  IScanCameraInfo,
  IScanCameraProps,
  IScanCameraRef,
} from './types';

const canvasStyle = {
  position: 'absolute',
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  inset: 0,
} as const;

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'black',
  },
});

const NativeDesktopScanCamera = forwardRef<IScanCameraRef, IScanCameraProps>(
  function NativeDesktopScanCamera(
    {
      children,
      cameraId,
      handleScanResult,
      onFrameSymbols,
      multiSymbol,
      frozen,
      focusRequest,
      onPreviewTap,
      onCameraReady,
      onCameraError,
      onWebCameraFallback,
      onLayout,
      style,
    },
    ref,
  ) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const captureState = useRef<
      | {
          sessionId: string;
          frozen: boolean;
          revision: number;
        }
      | undefined
    >(undefined);
    const stop = useRef<(() => void) | undefined>(undefined);
    const desiredMultiSymbol = useRef(Boolean(multiSymbol));
    desiredMultiSymbol.current = Boolean(multiSymbol);
    const { requestFocus, resetFocusBox, focusBoxElement } = useDomFocusBox();
    const handlers = useRef({
      handleScanResult,
      onFrameSymbols,
      onCameraReady,
      onCameraError,
      onWebCameraFallback,
    });
    handlers.current = {
      handleScanResult,
      onFrameSymbols,
      onCameraReady,
      onCameraError,
      onWebCameraFallback,
    };

    const onCanvasClick = useCallback(
      (event: MouseEvent<HTMLCanvasElement>) => {
        const scanner = globalThis.desktopApi?.qrScanner;
        const sessionId = captureState.current?.sessionId;
        if (frozen || !scanner || !sessionId) return;
        onPreviewTap?.();
        const { width, height } = event.currentTarget;
        const point = readDomFocusPoint(event, { width, height });
        requestFocus(
          point,
          async () =>
            (await scanner.focus?.(
              sessionId,
              point.normalizedX,
              point.normalizedY,
            )) === true,
        );
      },
      [frozen, onPreviewTap, requestFocus],
    );

    useImperativeHandle(ref, () => ({ dispose: () => stop.current?.() }), []);

    useEffect(() => {
      const scanner = globalThis.desktopApi?.qrScanner;
      const preview = canvas.current;
      if (!scanner || !preview) return;

      const sessionId = crypto.randomUUID();
      const capture = { sessionId, frozen: false, revision: 0 };
      captureState.current = capture;
      preview.id = desktopQrPreviewPrefix + sessionId;
      let active = true;
      let verifyingPreview = false;
      const stopSession = () => {
        if (!active) return;
        active = false;
        resetFocusBox();
        if (captureState.current?.sessionId === sessionId) {
          captureState.current = undefined;
        }
        preview.removeAttribute('id');
        preview.width = 0;
        void scanner.stop(sessionId).catch(() => {});
      };
      const fallback = () => {
        if (!active) return;
        stopSession();
        handlers.current.onWebCameraFallback?.();
      };
      const verifyPreview: NonNullable<
        IMultiQrFrameEvent['verifyPreview']
      > = async (receive) => {
        const revision = capture.revision;
        if (
          verifyingPreview ||
          capture.frozen ||
          !scanner.setPreviewFrozen ||
          (scanner.hasFreshPreview &&
            !scanner.hasFreshPreview(sessionId, revision))
        )
          return;
        verifyingPreview = true;
        // Native symbols and shared textures arrive on separate channels. Decode
        // the pinned canvas before attaching selectable payloads to its pixels.
        let selected = false;
        try {
          scanner.setPreviewFrozen(sessionId, true, revision);
          ensureWebQrScannerConfigured();
          const image = await new Promise<Blob | null>((resolve) =>
            preview.toBlob(resolve),
          );
          if (!image || !active) return;
          const { symbols, width, height, partial } =
            await decodeQrImageSymbols(image);
          if (
            active &&
            capture.revision === revision &&
            !partial &&
            symbols.length > 0
          ) {
            selected =
              receive({
                symbols,
                coordinateSpace: 'frame',
                frameWidth: width,
                frameHeight: height,
              }) === true;
          }
        } catch (error) {
          console.error(
            '[ScanCamera] Could not verify the frozen preview',
            error,
          );
        } finally {
          verifyingPreview = false;
          if (
            active &&
            !selected &&
            capture.revision === revision &&
            !capture.frozen
          ) {
            scanner.setPreviewFrozen?.(sessionId, false, revision);
          }
        }
      };
      const unsubscribe = scanner.onEvent((event) => {
        if (!active || event.sessionId !== sessionId) return;
        if (event.type === 'ready')
          handlers.current.onCameraReady?.(event.cameraId);
        if (
          (event.type === 'text' || event.type === 'symbols') &&
          (capture.frozen ||
            (event.analysisRevision !== undefined &&
              event.analysisRevision !== capture.revision))
        )
          return;
        if (event.type === 'text')
          handlers.current.handleScanResult?.(event.text);
        if (event.type === 'symbols') {
          handlers.current.onFrameSymbols?.({
            symbols: event.symbols,
            coordinateSpace: 'frame',
            frameWidth: event.frameWidth,
            frameHeight: event.frameHeight,
            verifyPreview,
          });
        }
        if (event.type === 'error') {
          if (
            event.code === 'preview-unavailable' ||
            event.code === 'decoder-unavailable'
          ) {
            fallback();
          } else {
            handlers.current.onCameraError?.(event.code);
          }
        }
      });
      stop.current = stopSession;
      const startPromise = desiredMultiSymbol.current
        ? scanner.start(sessionId, cameraId, { multiSymbol: true })
        : scanner.start(sessionId, cameraId);
      void startPromise
        .then((started) => {
          if (!started) fallback();
        })
        .catch(fallback);

      return () => {
        stopSession();
        stop.current = undefined;
        unsubscribe();
      };
    }, [cameraId, resetFocusBox]);

    useEffect(() => {
      const scanner = globalThis.desktopApi?.qrScanner;
      const sessionId = captureState.current?.sessionId;
      if (!scanner || !sessionId) return;
      void scanner.setMultiSymbol?.(sessionId, Boolean(multiSymbol));
    }, [multiSymbol]);

    const pauseUpdate = useRef<Promise<void> | undefined>(undefined);
    useEffect(() => {
      const scanner = globalThis.desktopApi?.qrScanner;
      const capture = captureState.current;
      if (!scanner || !capture) return;
      const nextFrozen = Boolean(frozen);
      if (capture.frozen !== nextFrozen) {
        capture.frozen = nextFrozen;
        capture.revision += 1;
      }
      if (nextFrozen) resetFocusBox();
      scanner.setPreviewFrozen?.(
        capture.sessionId,
        nextFrozen,
        capture.revision,
      );
      pauseUpdate.current = scanner
        .setPaused?.(capture.sessionId, nextFrozen, capture.revision)
        .catch(() => {});
    }, [cameraId, frozen, resetFocusBox]);

    const appliedFocusRequest = useRef<number | undefined>(undefined);
    useEffect(() => {
      if (
        frozen ||
        !focusRequest ||
        appliedFocusRequest.current === focusRequest.id
      )
        return;
      appliedFocusRequest.current = focusRequest.id;
      const scanner = globalThis.desktopApi?.qrScanner;
      const sessionId = captureState.current?.sessionId;
      const preview = canvas.current;
      if (!scanner?.focus || !sessionId || !preview) return;
      const point = mapDomFocusPoint(preview, preview, focusRequest);
      let current = true;
      requestFocus(point, async () => {
        await pauseUpdate.current;
        if (!current || captureState.current?.sessionId !== sessionId)
          return false;
        return (
          (await scanner.focus?.(
            sessionId,
            point.normalizedX,
            point.normalizedY,
          )) === true
        );
      });
      return () => {
        current = false;
      };
    }, [focusRequest, frozen, requestFocus]);

    return (
      <View style={[styles.container, style]} onLayout={onLayout}>
        {createElement('canvas', {
          ref: canvas,
          style: canvasStyle,
          onClick: onCanvasClick,
        })}
        {focusBoxElement}
        {children}
      </View>
    );
  },
);

export const ScanCamera = forwardRef<IScanCameraRef, IScanCameraProps>(
  function ScanCamera(
    { cameraActive = true, useWebCamera, onWebCameraFallback, ...props },
    ref,
  ) {
    if (!cameraActive) {
      return (
        <View style={[styles.container, props.style]}>{props.children}</View>
      );
    }
    const scanner = globalThis.desktopApi?.qrScanner;
    if (
      useWebCamera ||
      !supportsDesktopQrCapture(scanner, Boolean(props.onFrameSymbols))
    ) {
      return <WebScanCamera {...props} ref={ref} />;
    }
    return (
      <NativeDesktopScanCamera
        {...props}
        ref={ref}
        onWebCameraFallback={onWebCameraFallback}
      />
    );
  },
);
