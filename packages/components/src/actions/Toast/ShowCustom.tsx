import type { ForwardedRef, PropsWithChildren } from 'react';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';

import { Toast, ToastViewport } from '@tamagui/toast';
import { isNil } from 'lodash';
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
  open?: boolean;
  onOpenChange?: (visible: boolean) => void;
  name?: string;
}>;

export interface IShowToasterInstance {
  close: (extra?: { flag?: string }) => Promise<void> | void;
}

export type IContextType = {
  close: IShowToasterInstance['close'];
};

const CustomToasterContext = createContext({} as IContextType);
const SHOW_TOAST_VIEWPORT_NAME = 'SHOW_TOAST_VIEWPORT_NAME';
let toastNameIndex = 0;
function BasicShowToaster(
  {
    children,
    onClose,
    duration = Infinity,
    dismissOnOverlayPress = true,
    open,
    onOpenChange,
    name,
  }: IShowToasterProps,
  ref: ForwardedRef<IShowToasterInstance>,
) {
  const containerName = useMemo(() => {
    if (name) {
      return name;
    }
    toastNameIndex += 1;
    return `${SHOW_TOAST_VIEWPORT_NAME}-${toastNameIndex}`;
  }, [name]);
  const [isOpenState, setIsOpenState] = useState(true);
  const isControlled = !isNil(open);
  const isOpen = isControlled ? open : isOpenState;
  const setIsOpen = useCallback(
    (value: boolean) => {
      if (isControlled) {
        onOpenChange?.(value);
      }
      setIsOpenState(value);
    },
    [isControlled, onOpenChange],
  );
  const handleClose = useCallback(
    (extra?: { flag?: string }) => {
      setIsOpen(false);
      return onClose?.(extra);
    },
    [onClose, setIsOpen],
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
  // when Stack's pointerEvents is set to 'auto',
  //  if there is no click event assigned, clicks will pass through on Android.
  const handleNoop = useCallback(() => {}, []);
  return (
    <>
      <ToastViewport
        name={containerName}
        width="100%"
        alignContent="center"
        multipleToasts={false}
        justifyContent="center"
        px="$5"
        py={top || '$5'}
      />

      {isOpen ? (
        <Stack
          width="100%"
          height="100%"
          flex={1}
          pointerEvents="auto"
          position="absolute"
          onPress={dismissOnOverlayPress ? handleContainerClose : handleNoop}
        />
      ) : null}

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
        viewportName={containerName}
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

export const ShowCustom = forwardRef<IShowToasterInstance, IShowToasterProps>(
  BasicShowToaster,
);
