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

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useSafeAreaInsets } from '../../hooks';
import { Stack } from '../../primitives';
import { Trigger } from '../Trigger';

export type IShowToasterProps = PropsWithChildren<{
  onClose?: () => Promise<void> | void;
  onDismiss?: () => void;
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
        onPress={handleClose}
      />
      <Toast
        unstyled
        width="100%"
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
