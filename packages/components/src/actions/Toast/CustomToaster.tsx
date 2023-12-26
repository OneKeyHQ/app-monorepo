import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import type { ForwardedRef, PropsWithChildren } from 'react';

import { Toast, ToastViewport, useToastState } from '@tamagui/toast';
import { Stack } from 'tamagui';

import { useSafeAreaInsets } from '../../hooks';
import { Trigger } from '../Trigger';

import type { GestureResponderEvent } from 'react-native';

export type ICustomToasterProps = PropsWithChildren<{
  onClose?: () => Promise<void> | void;
  onDismiss?: () => void;
  dismissOnOverlayPress?: boolean;
  duration?: number;
  disableSwipeGesture?: boolean;
}>;

let toastId = 1;

export interface ICustomToasterInstance {
  close: () => Promise<void> | void;
}

export type IContextType = {
  close: ICustomToasterInstance['close'];
};

const CustomToasterContext = createContext({} as IContextType);

function BasicCustomToaster(
  {
    children,
    onClose,
    duration = Infinity,
    dismissOnOverlayPress = true,
    disableSwipeGesture = true,
  }: ICustomToasterProps,
  ref: ForwardedRef<ICustomToasterInstance>,
) {
  const key = useMemo(() => {
    toastId += 1;
    return toastId;
  }, []);
  const [isOpen, setIsOpen] = useState(true);
  const handleClose = useCallback(() => {
    setIsOpen(false);
    return onClose?.();
  }, [onClose]);
  useImperativeHandle(
    ref,
    () => ({
      close: handleClose,
    }),
    [handleClose],
  );
  console.log(isOpen);
  const value = useMemo(
    () => ({
      close: handleClose,
    }),
    [handleClose],
  );

  const handleSwipeStart = useCallback(
    (event: GestureResponderEvent) => {
      if (disableSwipeGesture) {
        event.preventDefault();
      }
    },
    [disableSwipeGesture],
  );
  const { top } = useSafeAreaInsets();
  return (
    <>
      <ToastViewport
        name="CustomViewPort"
        width="100%"
        alignContent="center"
        multipleToasts={false}
        justifyContent="center"
        $gtMd={{
          top: '$5',
        }}
      />

      <Stack
        width="100%"
        height="100%"
        flex={1}
        pointerEvents={dismissOnOverlayPress ? 'auto' : 'none'}
        position="absolute"
        onPress={handleClose}
      />
      <Toast
        key={key}
        unstyled
        width="100%"
        testID="TOAST_ID"
        justifyContent="center"
        open={isOpen}
        borderRadius={0}
        enterStyle={{ opacity: 0, scale: 0.5, y: -25 }}
        exitStyle={{ opacity: 0, scale: 1, y: -20 }}
        duration={duration}
        opacity={1}
        scale={1}
        animation="quick"
        viewportName="CustomViewPort"
      >
        <CustomToasterContext.Provider value={value}>
          <Stack pt={top} bg="$bg" br="$3">
            {children}
          </Stack>
        </CustomToasterContext.Provider>
      </Toast>
    </>
  );
}

export const useCustomToaster = () => useContext(CustomToasterContext);

export function CustomToasterClose({ children }: PropsWithChildren) {
  const { close } = useCustomToaster();
  const handleClose = useCallback(() => {
    void close();
  }, [close]);
  return <Trigger onPress={handleClose}>{children}</Trigger>;
}

export const CustomToaster = forwardRef<
  ICustomToasterInstance,
  ICustomToasterProps
>(BasicCustomToaster);
