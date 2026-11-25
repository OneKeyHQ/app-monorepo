import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

import {
  QrScannerError,
  createWebQrScanner,
} from '@onekeyfe/react-native-qr-scanner/web';
import { StyleSheet, View } from 'react-native';

import { ensureWebQrScannerConfigured } from './webQrScanner';

import type {
  IScanCameraInfo,
  IScanCameraProps,
  IScanCameraRef,
} from './types';
import type { WebQrScanner } from '@onekeyfe/react-native-qr-scanner/web';

export type { IScanCameraInfo, IScanCameraProps, IScanCameraRef };

const videoStyle = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
} as const;

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'black',
  },
});

export const ScanCamera = forwardRef<IScanCameraRef, IScanCameraProps>(
  function ScanCamera(
    {
      style,
      children,
      handleScanResult,
      onCameraError,
      onCameraReady,
      cameraId,
      cameraActive,
      // Screen activity is a native concern; the web camera runs while mounted.
      disableNavigationGuard,
      useWebCamera,
      onWebCameraFallback,
      ...rest
    },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const scannerRef = useRef<WebQrScanner | null>(null);
    const handlers = useRef({ handleScanResult, onCameraError, onCameraReady });
    handlers.current = { handleScanResult, onCameraError, onCameraReady };
    // The camera at mount; later changes go through switchCamera().
    const startedCameraId = useRef(cameraId);

    useImperativeHandle(
      ref,
      () => ({
        dispose: () => {
          scannerRef.current?.dispose();
        },
      }),
      [],
    );

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      ensureWebQrScannerConfigured();
      const scanner = createWebQrScanner({
        video,
        source: { kind: 'camera', deviceId: startedCameraId.current },
        onReady: () => {
          const stream = video.srcObject;
          const track =
            typeof MediaStream !== 'undefined' && stream instanceof MediaStream
              ? stream.getVideoTracks()[0]
              : undefined;
          handlers.current.onCameraReady?.(track?.getSettings().deviceId);
        },
        // The app assembles UR parts itself; it reads every frame's text.
        mode: 'static',
        onFrameText: (text) => handlers.current.handleScanResult?.(text),
        onError: (error) => {
          // Static mode never ends a session with a UR error.
          if (error instanceof QrScannerError) {
            console.error('[ScanCamera] camera error', error.code);
            handlers.current.onCameraError?.(error.code);
          }
        },
      });
      scannerRef.current = scanner;
      void scanner.start();
      return () => {
        scanner.dispose();
        scannerRef.current = null;
      };
    }, []);

    useEffect(() => {
      const scanner = scannerRef.current;
      if (!scanner || cameraId === startedCameraId.current) return;
      startedCameraId.current = cameraId;
      void scanner.switchCamera(cameraId);
    }, [cameraId]);

    return (
      <View style={[styles.container, style]} {...rest}>
        {createElement('video', {
          ref: videoRef,
          style: videoStyle,
          muted: true,
          playsInline: true,
          autoPlay: true,
        })}
        {children}
      </View>
    );
  },
);
