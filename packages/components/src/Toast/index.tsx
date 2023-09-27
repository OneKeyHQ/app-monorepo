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
import useSafeAreaInsets from '../Provider/hooks/useSafeAreaInsets';
import { Text } from '../Text';

import type { CreateNativeToastOptions } from '@tamagui/toast/src/types';

function ToastInstance() {
  const currentToast = useToastState();
  if (!currentToast || currentToast.isHandledNatively) return null;
  return (
    <Toast
      key={currentToast.id}
      duration={currentToast.duration}
      enterStyle={{ opacity: 0, scale: 0.9, y: -16 }}
      exitStyle={{ opacity: 0, scale: 0.9, y: -16 }}
      y={0}
      opacity={1}
      scale={1}
      animation="quick"
      viewportName={currentToast.viewportName}
    >
      <YStack>
        <Toast.Title asChild>
          <YStack>
            <Text variant="$bodyLg">{currentToast.title}</Text>
          </YStack>
        </Toast.Title>
        {!!currentToast.message && (
          <Toast.Description>{currentToast.message}</Toast.Description>
        )}
      </YStack>
    </Toast>
  );
}

export function ToastProvider({ children }: PropsWithChildren<unknown>) {
  // const { top } = useSafeAreaInsets();

  return (
    <TMToastProvider>
      {children}
      <ToastViewport
        flexDirection="column-reverse"
        // top={top || '$5'}
        top="$16"
        right={0}
        left={0}
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
