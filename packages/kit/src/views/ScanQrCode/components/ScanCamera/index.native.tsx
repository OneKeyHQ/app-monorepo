import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useNavigation } from '@react-navigation/native';
import { callback } from 'react-native-nitro-modules';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type {
  IScanCameraInfo,
  IScanCameraProps,
  IScanCameraRef,
} from './types';
import type { QrScannerErrorCode } from '@onekeyfe/react-native-qr-scanner';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ParamListBase } from '@react-navigation/routers';

// Mac Catalyst has no scanner camera; image decoding still works there.
const qrScanner = platformEnv.isNativeIOSMacCatalyst
  ? undefined
  : (require('@onekeyfe/react-native-qr-scanner') as typeof import('@onekeyfe/react-native-qr-scanner'));

const QR_SCANNER_ERROR_CODES: readonly QrScannerErrorCode[] = [
  'permission-denied',
  'no-camera',
  'camera-busy',
  'decoder-unavailable',
  'invalid-image',
  'resource-limit',
];

function toErrorCode(code: string): QrScannerErrorCode {
  return (QR_SCANNER_ERROR_CODES as readonly string[]).includes(code)
    ? (code as QrScannerErrorCode)
    : 'decoder-unavailable';
}

export type { IScanCameraInfo, IScanCameraProps, IScanCameraRef };

type ICameraNavigation = NativeStackNavigationProp<ParamListBase>;

function ScreenCameraActivity({
  onActiveChange,
}: {
  onActiveChange: (active: boolean) => void;
}) {
  const navigation = useNavigation<ICameraNavigation>();

  useLayoutEffect(() => {
    const navigations: ICameraNavigation[] = [];
    let current: ICameraNavigation | undefined = navigation;
    while (current) {
      navigations.push(current);
      current = current.getParent<ICameraNavigation | undefined>();
    }

    const transitioningAway = new Map<ICameraNavigation, boolean>();
    const updateActivity = () => {
      onActiveChange(
        navigation.isFocused() &&
          navigations.every((item) => !transitioningAway.get(item)),
      );
    };

    const unsubscribe = navigations.flatMap((item) => [
      item.addListener('transitionStart', ({ data }) => {
        transitioningAway.set(item, data.closing);
        updateActivity();
      }),
      item.addListener('transitionEnd', ({ data }) => {
        transitioningAway.set(item, data.closing);
        updateActivity();
      }),
      item.addListener('gestureCancel', () => {
        transitioningAway.delete(item);
        updateActivity();
      }),
      item.addListener('focus', updateActivity),
      item.addListener('blur', updateActivity),
    ]);
    updateActivity();
    return () => {
      unsubscribe.forEach((removeListener) => removeListener());
    };
  }, [navigation, onActiveChange]);

  return null;
}

export const ScanCamera = forwardRef<IScanCameraRef, IScanCameraProps>(
  function ScanCamera(
    {
      children,
      handleScanResult,
      onCameraError,
      onCameraReady,
      cameraId,
      disableNavigationGuard,
      style,
    },
    ref,
  ) {
    const [screenActive, setScreenActive] = useState(
      disableNavigationGuard === true,
    );
    const [disposed, setDisposed] = useState(false);
    const disposedRef = useRef(false);
    // Read by frame callbacks, so a pause drops frames before React re-renders.
    const activeRef = useRef(disableNavigationGuard === true);
    const mountedRef = useRef(true);
    const handlers = useRef({ handleScanResult, onCameraError, onCameraReady });
    handlers.current = { handleScanResult, onCameraError, onCameraReady };
    // Frames of an older capture generation can arrive after a restart.
    const latestGeneration = useRef(0);
    const pausedGeneration = useRef(0);
    const readyGeneration = useRef<number | undefined>(undefined);

    const onActiveChange = useCallback((active: boolean) => {
      if (disposedRef.current) return;
      if (!active) {
        pausedGeneration.current = latestGeneration.current;
        readyGeneration.current = undefined;
      }
      activeRef.current = active;
      setScreenActive(active);
    }, []);

    const dispose = useCallback(() => {
      if (disposedRef.current) return;
      disposedRef.current = true;
      activeRef.current = false;
      setDisposed(true);
    }, []);

    useImperativeHandle(ref, () => ({ dispose }), [dispose]);

    useLayoutEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
      };
    }, []);

    const nativeCallbacks = useMemo(() => {
      const isCurrent = (generation: number) =>
        !disposedRef.current &&
        mountedRef.current &&
        activeRef.current &&
        generation > pausedGeneration.current &&
        generation >= latestGeneration.current;

      return {
        onReady: callback((generation: number) => {
          if (!activeRef.current) {
            pausedGeneration.current = Math.max(
              pausedGeneration.current,
              generation,
            );
            return;
          }
          if (!isCurrent(generation)) return;
          latestGeneration.current = generation;
          readyGeneration.current = generation;
          handlers.current.onCameraReady?.();
        }),
        onFrameText: callback((text: string, generation: number) => {
          if (
            !isCurrent(generation) ||
            generation !== readyGeneration.current
          ) {
            return;
          }
          handlers.current.handleScanResult?.(text);
        }),
        onError: callback(
          (code: string, _message: string, generation: number) => {
            if (!isCurrent(generation)) return;
            latestGeneration.current = generation;
            readyGeneration.current = undefined;
            handlers.current.onCameraError?.(toErrorCode(code));
          },
        ),
      };
    }, []);

    return (
      <>
        {!disableNavigationGuard && qrScanner ? (
          <ScreenCameraActivity onActiveChange={onActiveChange} />
        ) : null}
        {qrScanner ? (
          <qrScanner.QrScannerView
            style={[{ flex: 1 }, style]}
            active={screenActive && !disposed}
            cameraId={cameraId}
            {...nativeCallbacks}
          />
        ) : null}
        {children}
      </>
    );
  },
);
