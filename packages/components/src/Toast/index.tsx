import { type PropsWithChildren, useEffect } from 'react';

import {
  ToastProvider as TMToastProvider,
  Toast,
  ToastViewport,
  useToastController,
  useToastState,
} from '@tamagui/toast';
import { YStack } from 'tamagui';

import { removePortalComponent, setPortalComponent } from '../Portal';

import type { CreateNativeToastOptions } from '@tamagui/toast/src/types';

function ToastInstance() {
  const currentToast = useToastState();
  if (!currentToast || currentToast.isHandledNatively) return null;
  return (
    <Toast
      key={currentToast.id}
      duration={currentToast.duration}
      enterStyle={{ opacity: 0, scale: 0.5, y: -25 }}
      exitStyle={{ opacity: 0, scale: 1, y: -20 }}
      y={0}
      opacity={1}
      scale={1}
      animation="100ms"
      viewportName={currentToast.viewportName}
    >
      <YStack>
        <Toast.Title>{currentToast.title}</Toast.Title>
        {!!currentToast.message && (
          <Toast.Description>{currentToast.message}</Toast.Description>
        )}
      </YStack>
    </Toast>
  );
}

export function ToastProvider({ children }: PropsWithChildren<unknown>) {
  return (
    <TMToastProvider native={false}>
      {children}
      <ToastViewport
        multipleToasts
        marginTop="$16"
        width="100%"
        justifyContent="center"
        alignContent="center"
      />
      <ToastInstance />
    </TMToastProvider>
  );
}

interface CustomData {
  [key: string]: any;
}

type ShowOptions = CreateNativeToastOptions &
  CustomData & {
    /**
     * Used when need custom data
     * @deprecated Use `customData` instead
     */
    additionalInfo?: CustomData;
    /**
     * Used when need custom data
     */
    customData?: CustomData;
    /**
     * Which viewport to send this toast to. This is only intended to be used with custom toasts and you should wire it up when creating the toast.
     */
    viewportName?: string | 'default';
  };
type ToastOptions = {
  title: string;
} & ShowOptions;

type ToastProps = {
  name: string;
  options: ToastOptions;
};
function ToastControllerInstance({
  name,
  options: { title, ...restProps },
}: ToastProps) {
  const toast = useToastController();
  // only run once time
  useEffect(() => {
    toast.show(title, restProps);
    removePortalComponent(name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export const ToastController = {
  show: (type: string, options: ToastOptions) => {
    setPortalComponent(
      <ToastControllerInstance
        options={options}
        name={Math.random().toString()}
      />,
    );
  },
};
