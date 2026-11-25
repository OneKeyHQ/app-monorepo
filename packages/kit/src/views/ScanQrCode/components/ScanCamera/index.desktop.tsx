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

import { readDomFocusPoint, useDomFocusBox } from './FocusBox';
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
      onCameraReady,
      onCameraError,
      onWebCameraFallback,
      onLayout,
      style,
    },
    ref,
  ) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const activeSessionId = useRef<string | undefined>(undefined);
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
        const sessionId = activeSessionId.current;
        if (frozen || !scanner || !sessionId) return;
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
      [frozen, requestFocus],
    );

    useImperativeHandle(ref, () => ({ dispose: () => stop.current?.() }), []);

    useEffect(() => {
      const scanner = globalThis.desktopApi?.qrScanner;
      const preview = canvas.current;
      if (!scanner || !preview) return;

      const sessionId = crypto.randomUUID();
      activeSessionId.current = sessionId;
      preview.id = desktopQrPreviewPrefix + sessionId;
      let active = true;
      let verifyingPreview = false;
      const stopSession = () => {
        if (!active) return;
        active = false;
        resetFocusBox();
        if (activeSessionId.current === sessionId) {
          activeSessionId.current = undefined;
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
      const verifyPreview: NonNullable<IMultiQrFrameEvent['verifyPreview']> = (
        receive,
      ) => {
        if (verifyingPreview || !scanner.setPreviewFrozen) return;
        verifyingPreview = true;
        // Native symbols and shared textures arrive on separate channels. Decode
        // the pinned canvas before attaching selectable payloads to its pixels.
        scanner.setPreviewFrozen(sessionId, true);
        void (async () => {
          let selected = false;
          try {
            ensureWebQrScannerConfigured();
            const image = await new Promise<Blob | null>((resolve) =>
              preview.toBlob(resolve),
            );
            if (!image || !active) return;
            const { symbols, width, height, partial } =
              await decodeQrImageSymbols(image);
            if (active && !partial && symbols.length >= 2) {
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
            if (active && !selected)
              scanner.setPreviewFrozen?.(sessionId, false);
          }
        })();
      };
      const unsubscribe = scanner.onEvent((event) => {
        if (!active || event.sessionId !== sessionId) return;
        if (event.type === 'ready')
          handlers.current.onCameraReady?.(event.cameraId);
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
      const sessionId = activeSessionId.current;
      if (!scanner || !sessionId) return;
      void scanner.setMultiSymbol?.(sessionId, Boolean(multiSymbol));
    }, [multiSymbol]);

    useEffect(() => {
      const scanner = globalThis.desktopApi?.qrScanner;
      const sessionId = activeSessionId.current;
      if (!scanner || !sessionId) return;
      const nextFrozen = Boolean(frozen);
      if (nextFrozen) resetFocusBox();
      scanner.setPreviewFrozen?.(sessionId, nextFrozen);
      void scanner.setPaused?.(sessionId, nextFrozen);
    }, [frozen, resetFocusBox]);

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
      !scanner ||
      (props.onFrameSymbols && !scanner.setPreviewFrozen)
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
