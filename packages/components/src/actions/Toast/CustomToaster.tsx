import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import type { ForwardedRef, PropsWithChildren } from 'react';

import { Toast, useToastState } from '@tamagui/toast';

export type ICustomToasterProps = PropsWithChildren<{
  onClose?: () => Promise<void> | void;
  onDismiss?: () => void;
}>;

let toastId = 1;

export interface ICustomToasterInstance {
  close: () => Promise<void> | void;
}
function BasicCustomToaster(
  { children, onClose }: ICustomToasterProps,
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
  const currentToast = useToastState();

  return (
    <Toast
      key={key}
      testID="TOAST_ID"
      open={isOpen}
      enterStyle={{ opacity: 0, scale: 0.5, y: -25 }}
      exitStyle={{ opacity: 0, scale: 1, y: -20 }}
      y={0}
      opacity={1}
      scale={1}
      animation="quick"
      viewportName="CustomViewPort"
    >
      {children}
    </Toast>
  );
}

export const CustomToaster = forwardRef<
  ICustomToasterInstance,
  ICustomToasterProps
>(BasicCustomToaster);
