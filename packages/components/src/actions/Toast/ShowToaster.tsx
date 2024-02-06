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
import { getTokenValue } from 'tamagui';
import { useDebouncedCallback } from 'use-debounce';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useSafeAreaInsets } from '../../hooks/useLayout';
import { Stack } from '../../primitives';
import { Trigger } from '../Trigger';

export type IShowToasterProps = PropsWithChildren<{
  onClose?: (isTriggeredByUser: boolean) => Promise<void> | void;
  dismissOnOverlayPress?: boolean;
  duration?: number;
  disableSwipeGesture?: boolean;
}>;

export interface IShowToasterInstance {
  close: () => Promise<void> | void;
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
    (isTriggeredByUser: boolean) => {
      setIsOpen(false);
      return onClose?.(isTriggeredByUser);
    },
    [onClose],
  );
  const handleImperativeClose = useCallback(
    () => handleClose(false),
    [handleClose],
  );

  const handleContainerClose = useCallback(
    () => handleClose(true),
    [handleClose],
  );

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
  const mdPadding = '$10';
  const mdPaddingValue = getTokenValue(mdPadding, 'space') as number;
  return (
    <>
      <ToastViewport
        name={SHOW_TOAST_VIEWPORT_NAME}
        width="100%"
        alignContent="center"
        multipleToasts={false}
        justifyContent="center"
        $md={{
          px: mdPadding,
        }}
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
        onPress={handleContainerClose}
      />
      <Toast
        unstyled
        width="100%"
        onSwipeEnd={handleSwipeEnd}
        $md={{
          width: platformEnv.isRuntimeBrowser
            ? `calc(100vw - ${mdPaddingValue * 2}px)`
            : '100%',
        }}
        justifyContent="center"
        open={isOpen}
        borderRadius={0}
        enterStyle={{ opacity: 0, scale: 0.5, y: -25 }}
        exitStyle={{ opacity: 0, scale: 1, y: -20 }}
        duration={duration}
        opacity={1}
        scale={1}
        animation="quick"
        viewportName={SHOW_TOAST_VIEWPORT_NAME}
      >
        <CustomToasterContext.Provider value={value}>
          <Stack mt={top} bg="$bg" br="$3">
            {children}
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
