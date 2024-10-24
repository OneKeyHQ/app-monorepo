import { useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { Camera } from 'react-native-camera-kit/src';

import { Button, usePreventRemove } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

import type { IScanCameraProps } from './types';

export type { IScanCameraProps };

export function ScanCamera({
  style,
  children,
  handleScanResult,
  ...rest
}: IScanCameraProps) {
  const [isFocus, setIsFocus] = useState(true);
  const navigation = useNavigation();
  const onUsePreventRemove = useCallback(
    ({
      data,
    }: {
      data: {
        action: Readonly<{
          type: string;
          payload?: object | undefined;
          source?: string | undefined;
          target?: string | undefined;
        }>;
      };
    }) => {
      setIsFocus(false);
      setTimeout(() => {
        navigation.dispatch(data.action);
      }, 350);
    },
    [navigation],
  );
  usePreventRemove(true, onUsePreventRemove);

  return (
    <>
      <Button onPress={() => setIsFocus((prev) => !prev)}>test</Button>
      {isFocus ? (
        <Camera
          key={Math.random().toString()}
          style={{ flex: 1 }}
          resizeMode="cover"
          scanBarcode
          onReadCode={({ nativeEvent: { codeStringValue } }) => {
            if (typeof codeStringValue !== 'string') {
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
}
