import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

import { StyleSheet, View } from 'react-native';

import { useRouteIsFocusedWhenEnabled } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useDeviceStageAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/hardware';
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

      let sessionId: string | undefined;
      let disposed = false;
      const stopSession = () => {
        const active = sessionId;
        sessionId = undefined;
        preview.removeAttribute('id');
        preview.width = 0;
        if (active) void scanner.stop(active).catch(() => {});
      };
      const fallback = () => {
        if (disposed) return;
        disposed = true;
        stopSession();
        handlers.current.onWebCameraFallback?.();
      };
      const updateVisibility = () => {
        if (document.visibilityState === 'hidden') {
          stopSession();
        } else if (!disposed && !sessionId) {
          const active = crypto.randomUUID();
          sessionId = active;
          preview.id = desktopQrPreviewPrefix + active;
          void scanner
            .start(active, cameraId)
            .then((started) => {
              if (sessionId === active && !started) fallback();
            })
            .catch(() => {
              if (sessionId === active) fallback();
            });
        }
      };
      const unsubscribe = scanner.onEvent((event) => {
        if (event.sessionId !== sessionId) return;
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
      stop.current = () => {
        disposed = true;
        stopSession();
      };
      document.addEventListener('visibilitychange', updateVisibility);
      updateVisibility();

      return () => {
        stop.current?.();
        stop.current = undefined;
        document.removeEventListener('visibilitychange', updateVisibility);
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
  function ScanCamera({ useWebCamera, onWebCameraFallback, ...props }, ref) {
    const [stage] = useDeviceStageAtom();
    const isFocused = useRouteIsFocusedWhenEnabled({
      enabled: !props.disableNavigationGuard,
    });
    const coveredByDeviceStage =
      !props.disableNavigationGuard && !!stage && stage.step !== 'off';

    if (!isFocused || coveredByDeviceStage) {
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
