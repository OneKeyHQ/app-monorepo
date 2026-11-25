import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import type { MouseEvent } from 'react';

import {
  QrScannerError,
  createWebQrScanner,
} from '@onekeyfe/react-native-qr-scanner/web';
import { StyleSheet, View } from 'react-native';

import { readDomFocusPoint, useDomFocusBox } from './FocusBox';
import { ensureWebQrScannerConfigured } from './webQrScanner';

import type {
  IScanCameraInfo,
  IScanCameraProps,
  IScanCameraRef,
} from './types';
import type {
  IMultiQrFrameEvent,
  IMultiQrRgbaFrame,
} from '../../utils/multiQrSymbols';
import type { WebQrScanner } from '@onekeyfe/react-native-qr-scanner/web';

type IExtendedWebQrScanner = WebQrScanner & {
  focus?: (point?: { x: number; y: number }) => Promise<boolean>;
  setMultiSymbol?: (enabled: boolean) => void;
  setFrozen?: (frozen: boolean) => void;
};

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
      onFrameSymbols,
      multiSymbol,
      frozen,
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
    const frozenCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const latestFrameRef = useRef<IMultiQrRgbaFrame | undefined>(undefined);
    const scannerRef = useRef<IExtendedWebQrScanner | null>(null);
    const { showFocusBox, focusBoxElement } = useDomFocusBox();
    const handlers = useRef({
      handleScanResult,
      onFrameSymbols,
      onCameraError,
      onCameraReady,
    });
    handlers.current = {
      handleScanResult,
      onFrameSymbols,
      onCameraError,
      onCameraReady,
    };
    // The camera at mount; later changes go through switchCamera().
    const startedCameraId = useRef(cameraId);
    const initialMultiSymbol = useRef(Boolean(multiSymbol));

    const onVideoClick = useCallback(
      (event: MouseEvent<HTMLVideoElement>) => {
        const scanner = scannerRef.current as
          | (WebQrScanner & {
              focus?: (point?: { x: number; y: number }) => Promise<boolean>;
            })
          | null;
        if (!scanner?.focus) return;
        const point = readDomFocusPoint(event);
        void scanner
          .focus({ x: point.normalizedX, y: point.normalizedY })
          .then((focused) => {
            if (focused) showFocusBox(point);
          })
          .catch(() => {});
      },
      [showFocusBox],
    );

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
        ...({
          multiSymbol: initialMultiSymbol.current,
          onFrameSymbols: (event: IMultiQrFrameEvent) => {
            if (event.frame) {
              latestFrameRef.current = event.frame;
            }
            handlers.current.onFrameSymbols?.(event);
          },
        } as Record<string, unknown>),
        onError: (error) => {
          // Static mode never ends a session with a UR error.
          if (error instanceof QrScannerError) {
            console.error('[ScanCamera] camera error', error.code);
            handlers.current.onCameraError?.(error.code);
          }
        },
      }) as IExtendedWebQrScanner;
      scannerRef.current = scanner;
      void scanner.start();
      return () => {
        latestFrameRef.current = undefined;
        scanner.dispose();
        scannerRef.current = null;
      };
    }, []);

    useEffect(() => {
      scannerRef.current?.setMultiSymbol?.(Boolean(multiSymbol));
    }, [multiSymbol]);

    useEffect(() => {
      const nextFrozen = Boolean(frozen);
      scannerRef.current?.setFrozen?.(nextFrozen);
      const canvas = frozenCanvasRef.current;
      if (!canvas) return;
      if (nextFrozen && latestFrameRef.current) {
        const frame = latestFrameRef.current;
        canvas.width = frame.width;
        canvas.height = frame.height;
        const ctx = canvas.getContext('2d');
        if (ctx && typeof ImageData === 'function') {
          const copy = new Uint8ClampedArray(frame.data.length);
          copy.set(frame.data);
          ctx.putImageData(
            new ImageData(copy, frame.width, frame.height),
            0,
            0,
          );
        }
        canvas.style.display = 'block';
      } else {
        canvas.style.display = 'none';
      }
    }, [frozen]);

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
          onClick: onVideoClick,
        })}
        {createElement('canvas', {
          ref: frozenCanvasRef,
          style: { ...videoStyle, display: 'none', pointerEvents: 'none' },
        })}
        {focusBoxElement}
        {children}
      </View>
    );
  },
);
