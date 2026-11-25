import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import type { MouseEvent } from 'react';

import { StyleSheet, View } from 'react-native';

import { desktopQrPreviewPrefix } from '@onekeyhq/shared/types/desktopQrScanner';

import { readDomFocusPoint, useDomFocusBox } from './FocusBox';
import { ScanCamera as WebScanCamera } from './index.tsx';

import type { IScanCameraProps, IScanCameraRef } from './types';

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
      onCameraReady,
      onCameraError,
      onWebCameraFallback,
      style,
    },
    ref,
  ) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const activeSessionId = useRef<string | undefined>(undefined);
    const stop = useRef<(() => void) | undefined>(undefined);
    const { showFocusBox, focusBoxElement } = useDomFocusBox();
    const handlers = useRef({
      handleScanResult,
      onCameraReady,
      onCameraError,
      onWebCameraFallback,
    });
    handlers.current = {
      handleScanResult,
      onCameraReady,
      onCameraError,
      onWebCameraFallback,
    };

    const onCanvasClick = useCallback(
      (event: MouseEvent<HTMLCanvasElement>) => {
        const scanner = globalThis.desktopApi?.qrScanner;
        const sessionId = activeSessionId.current;
        if (!scanner?.focus || !sessionId) return;
        const point = readDomFocusPoint(event);
        void scanner
          .focus(sessionId, point.normalizedX, point.normalizedY)
          .then((focused) => {
            if (focused && activeSessionId.current === sessionId) {
              showFocusBox(point);
            }
          })
          .catch(() => {});
      },
      [showFocusBox],
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
      const stopSession = () => {
        if (!active) return;
        active = false;
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
      const unsubscribe = scanner.onEvent((event) => {
        if (!active || event.sessionId !== sessionId) return;
        if (event.type === 'ready')
          handlers.current.onCameraReady?.(event.cameraId);
        if (event.type === 'text')
          handlers.current.handleScanResult?.(event.text);
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
      void scanner
        .start(sessionId, cameraId)
        .then((started) => {
          if (!started) fallback();
        })
        .catch(fallback);

      return () => {
        stopSession();
        stop.current = undefined;
        unsubscribe();
      };
    }, [cameraId]);

    return (
      <View style={[styles.container, style]}>
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
    if (useWebCamera || !globalThis.desktopApi?.qrScanner) {
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
