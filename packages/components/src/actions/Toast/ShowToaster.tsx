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

import { Toast, ToastViewport } from '@tamagui/toast';
import { StyleSheet } from 'react-native';
import { useDebouncedCallback } from 'use-debounce';

import { useSafeAreaInsets } from '../../hooks/useLayout';
import { Stack, ThemeableStack } from '../../primitives';
import { Trigger } from '../Trigger';

export type IShowToasterProps = PropsWithChildren<{
  onClose?: (extra?: { flag?: string }) => Promise<void> | void;
  dismissOnOverlayPress?: boolean;
  duration?: number;
  disableSwipeGesture?: boolean;
}>;

export interface IShowToasterInstance {
  close: (extra?: { flag?: string }) => Promise<void> | void;
}

export type IContextType = {
  close: IShowToasterInstance['close'];
};

const CustomToasterContext = createContext({} as IContextType);
const SHOW_TOAST_VIEWPORT_NAME = 'SHOW_TOAST_VIEWPORT_NAME';

function BasicShowToaster(
  {
    children,
    onClose,
    duration = Infinity,
    dismissOnOverlayPress = true,
  }: IShowToasterProps,
  ref: ForwardedRef<IShowToasterInstance>,
) {
  const [isOpen, setIsOpen] = useState(true);
  const handleClose = useCallback(
    (extra?: { flag?: string }) => {
      setIsOpen(false);
      return onClose?.(extra);
    },
    [onClose],
  );
  const handleImperativeClose = useCallback(
    (extra?: { flag?: string }) => handleClose(extra),
    [handleClose],
  );

  const handleContainerClose = useCallback(() => handleClose(), [handleClose]);

  const handleSwipeEnd = useDebouncedCallback(() => {
    void handleContainerClose();
  }, 50);

  useImperativeHandle(
    ref,
    () => ({
      close: handleImperativeClose,
    }),
    [handleImperativeClose],
  );

  const value = useMemo(
    () => ({
      close: handleContainerClose,
    }),
    [handleContainerClose],
  );
  const { top } = useSafeAreaInsets();
  return (
    <>
      <ToastViewport
        name={SHOW_TOAST_VIEWPORT_NAME}
        width="100%"
        alignContent="center"
        multipleToasts={false}
        justifyContent="center"
        px="$8"
        py={top || '$12'}
      />

      <Stack
        width="100%"
        height="100%"
        flex={1}
        pointerEvents="auto"
        position="absolute"
        onPress={dismissOnOverlayPress ? handleContainerClose : undefined}
      />
      <Toast
        unstyled
        onSwipeEnd={handleSwipeEnd}
        justifyContent="center"
        open={isOpen}
        borderRadius={0}
        enterStyle={{ opacity: 0, scale: 0.8, y: -20 }}
        exitStyle={{ opacity: 0, scale: 0.8, y: -20 }}
        duration={duration}
        animation="quick"
        viewportName={SHOW_TOAST_VIEWPORT_NAME}
      >
        <CustomToasterContext.Provider value={value}>
          <Stack
            testID="confirm-on-device-toast-container"
            borderRadius="$2.5"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderSubdued"
          >
            <ThemeableStack bg="$bg" borderRadius="$2.5" elevation={44}>
              {children}
            </ThemeableStack>
          </Stack>
        </CustomToasterContext.Provider>
      </Toast>
    </>
  );
}

export const useToaster = () => useContext(CustomToasterContext);

export function ShowToasterClose({ children }: PropsWithChildren) {
  const { close } = useToaster();
  const handleClose = useCallback(() => {
    void close();
  }, [close]);
  return <Trigger onPress={handleClose}>{children}</Trigger>;
}

export const ShowToaster = forwardRef<IShowToasterInstance, IShowToasterProps>(
  BasicShowToaster,
);
