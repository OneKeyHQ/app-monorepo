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
import type { IMultiQrSymbol } from '../../utils/multiQrSymbols';
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
type ICaptureActivity = {
  status: 'idle' | 'active' | 'paused' | 'disposed';
  epoch: number;
};

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
      onFrameSymbols,
      multiSymbol,
      frozen,
      onCameraError,
      onCameraReady,
      cameraId,
      disableNavigationGuard,
      style,
    },
    ref,
  ) {
    const [activity, setActivity] = useState<ICaptureActivity>({
      status: disableNavigationGuard ? 'active' : 'idle',
      epoch: 0,
    });
    // Navigation events retire capture before React commits the next view.
    const requestedActivity = useRef(activity);
    const mountedRef = useRef(true);
    const hasOnFrameSymbols = typeof onFrameSymbols === 'function';
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

    const onActiveChange = useCallback((active: boolean) => {
      const current = requestedActivity.current;
      const status = active ? 'active' : 'paused';
      if (
        current.status === 'disposed' ||
        current.status === status ||
        (!active && current.status === 'idle')
      )
        return;
      // A resume needs a fresh view even if React batches away active={false}.
      const next: ICaptureActivity = {
        status,
        epoch: current.epoch + (active && current.status === 'paused' ? 1 : 0),
      };
      requestedActivity.current = next;
      setActivity(next);
    }, []);

    const dispose = useCallback(() => {
      const current = requestedActivity.current;
      if (current.status === 'disposed') return;
      const next = { ...current, status: 'disposed' } as const;
      requestedActivity.current = next;
      setActivity(next);
    }, []);

    useImperativeHandle(ref, () => ({ dispose }), [dispose]);

    useLayoutEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
      };
    }, []);

    const { epoch } = activity;
    const nativeCallbacks = useMemo(() => {
      let current: { generation: number; ready: boolean } | undefined;
      const isCurrent = (generation: number) =>
        mountedRef.current &&
        requestedActivity.current.status === 'active' &&
        requestedActivity.current.epoch === epoch &&
        generation >= (current?.generation ?? 0);

      return {
        onReady: callback((generation: number, activeCameraId?: string) => {
          if (!isCurrent(generation)) return;
          current = { generation, ready: true };
          handlers.current.onCameraReady?.(activeCameraId);
        }),
        onFrameText: callback((text: string, generation: number) => {
          if (
            !isCurrent(generation) ||
            !current?.ready ||
            generation !== current.generation
          ) {
            return;
          }
          handlers.current.handleScanResult?.(text);
        }),
        ...(hasOnFrameSymbols
          ? {
              onFrameSymbols: callback(
                (symbols: IMultiQrSymbol[], generation: number) => {
                  if (
                    !isCurrent(generation) ||
                    !current?.ready ||
                    generation !== current.generation
                  ) {
                    return;
                  }
                  handlers.current.onFrameSymbols?.({
                    symbols,
                    coordinateSpace: 'view',
                  });
                },
              ),
            }
          : null),
        onError: callback(
          (code: string, _message: string, generation: number) => {
            if (!isCurrent(generation)) return;
            current = { generation, ready: false };
            handlers.current.onCameraError?.(toErrorCode(code));
          },
        ),
      };
    }, [epoch, hasOnFrameSymbols]);

    const extraNativeProps = {
      ...(multiSymbol !== undefined ? { multiSymbol } : null),
      ...(frozen !== undefined ? { frozen } : null),
    };

    return (
      <>
        {!disableNavigationGuard && qrScanner ? (
          <ScreenCameraActivity onActiveChange={onActiveChange} />
        ) : null}
        {qrScanner ? (
          <qrScanner.QrScannerView
            style={[{ flex: 1 }, style]}
            key={epoch}
            active={activity.status === 'active'}
            cameraId={cameraId}
            {...extraNativeProps}
            {...nativeCallbacks}
          />
        ) : null}
        {children}
      </>
    );
  },
);
