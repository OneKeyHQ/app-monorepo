import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';

import { useNavigation } from '@react-navigation/native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IScanCameraProps, IScanCameraRef } from './types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ParamListBase } from '@react-navigation/routers';
import type { CameraApi } from 'react-native-camera-kit';

const nativeCamera = platformEnv.isNativeIOSMacCatalyst
  ? undefined
  : (require('react-native-camera-kit') as typeof import('react-native-camera-kit'));

export type { IScanCameraProps, IScanCameraRef };

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
    { children, handleScanResult, disableNavigationGuard, ...rest },
    ref,
  ) {
    const activeRef = useRef(disableNavigationGuard === true);
    const mountedRef = useRef(true);
    const disposedRef = useRef(false);
    const cameraRef = useRef<CameraApi | null>(null);

    const onActiveChange = useCallback((active: boolean) => {
      if (disposedRef.current) return;
      activeRef.current = active;
      cameraRef.current?.setActive(active);
    }, []);

    const setCameraRef = useCallback((camera: CameraApi | null) => {
      cameraRef.current = camera;
      if (!camera) return;
      if (disposedRef.current) {
        camera.dispose();
      } else {
        camera.setActive(activeRef.current);
      }
    }, []);

    const dispose = useCallback(() => {
      if (disposedRef.current) return;
      disposedRef.current = true;
      activeRef.current = false;
      cameraRef.current?.dispose();
    }, []);

    useImperativeHandle(ref, () => ({ dispose }), [dispose]);

    useLayoutEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
      };
    }, []);

    return (
      <>
        {!disableNavigationGuard && nativeCamera ? (
          <ScreenCameraActivity onActiveChange={onActiveChange} />
        ) : null}
        {nativeCamera ? (
          <nativeCamera.Camera
            ref={setCameraRef}
            style={{ flex: 1 }}
            resizeMode="cover"
            showFrame={false}
            zoom={1}
            zoomMode="on"
            cameraType={nativeCamera.CameraType.Back}
            scanBarcode
            onReadCode={({ nativeEvent: { codeStringValue } }) => {
              if (
                disposedRef.current ||
                !mountedRef.current ||
                !activeRef.current ||
                typeof codeStringValue !== 'string'
              ) {
                return;
              }
              handleScanResult?.(codeStringValue);
            }}
            {...rest}
          />
        ) : null}
        {children}
      </>
    );
  },
);
