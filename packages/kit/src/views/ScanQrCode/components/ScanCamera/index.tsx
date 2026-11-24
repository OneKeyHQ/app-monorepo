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

import type { IScanCameraProps, IScanCameraRef } from './types';
import type { WebQrScanner } from '@onekeyfe/react-native-qr-scanner/web';

export type { IScanCameraProps, IScanCameraRef };

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
      // Screen activity is a native concern; the web camera runs while mounted.
      disableNavigationGuard,
      ...rest
    },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const scannerRef = useRef<WebQrScanner | null>(null);
    const handlers = useRef({ handleScanResult, onCameraError });
    handlers.current = { handleScanResult, onCameraError };

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
