import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

import { StyleSheet, View } from 'react-native';

import { desktopQrPreviewPrefix } from '@onekeyhq/shared/types/desktopQrScanner';

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
    const stop = useRef<(() => void) | undefined>(undefined);
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

    useImperativeHandle(ref, () => ({ dispose: () => stop.current?.() }), []);

    useEffect(() => {
      const scanner = globalThis.desktopApi?.qrScanner;
      const preview = canvas.current;
      if (!scanner || !preview) return;

      const sessionId = crypto.randomUUID();
      preview.id = desktopQrPreviewPrefix + sessionId;
      let active = true;
      const stopSession = () => {
        if (!active) return;
        active = false;
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
        {createElement('canvas', { ref: canvas, style: canvasStyle })}
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
