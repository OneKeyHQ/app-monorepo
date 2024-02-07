import type { RefObject } from 'react';
import { createRef } from 'react';

import { ToastProvider } from '@tamagui/toast';
import { toast } from 'burnt';
import { getTokens } from 'tamagui';

import { Portal } from '../../hocs';
import { Icon } from '../../primitives';

import { ShowToaster, ShowToasterClose } from './ShowToaster';

import type { IShowToasterInstance, IShowToasterProps } from './ShowToaster';
import type { IPortalManager } from '../../hocs';

export interface IToastProps {
  title: string;
  message?: string;
  /**
   * Duration in seconds.
   */
  duration?: number;
}

export interface IToastBaseProps extends IToastProps {
  title: string;
  message?: string;
  /**
   * Duration in seconds.
   */
  duration?: number;
  haptic?: 'success' | 'warning' | 'error' | 'none';
  preset?: 'done' | 'error' | 'none' | 'custom';
}

const iconMap = {
  success: {
    ios: {
      name: 'checkmark.circle.fill',
      color: getTokens().color.iconSuccessLight.val,
    },
    web: <Icon name="CheckRadioSolid" color="$iconSuccess" size="$5" />,
  },
  error: {
    ios: {
      name: 'x.circle.fill',
      color: getTokens().color.iconCriticalLight.val,
    },
    web: <Icon name="XCircleSolid" color="$iconCritical" size="$5" />,
  },
};

function burntToast({
  title,
  message,
  duration,
  haptic,
  preset = 'custom',
}: IToastBaseProps) {
  toast({
    title,
    message,
    duration,
    haptic,
    preset,
    icon: iconMap[haptic as keyof typeof iconMap],
  });
}

export { default as Toaster } from './Toaster';

export const Toast = {
  success: (props: IToastProps) => {
    burntToast({ haptic: 'success', ...props });
  },
  error: (props: IToastProps) => {
    burntToast({ haptic: 'error', ...props });
  },
  message: (props: IToastProps) => {
    burntToast({ haptic: 'warning', preset: 'none', ...props });
  },
  show: ({ onClose, children }: IShowToasterProps) => {
    let instanceRef: RefObject<IShowToasterInstance> | undefined =
      createRef<IShowToasterInstance>();
    let portalRef:
      | {
          current: IPortalManager;
        }
      | undefined;

    const handleClose = (closeFlag?: string) =>
      new Promise<void>((resolve) => {
        // Remove the React node after the animation has finished.
        setTimeout(() => {
          if (instanceRef) {
            instanceRef = undefined;
          }
          if (portalRef) {
            portalRef.current.destroy();
            portalRef = undefined;
          }
          void onClose?.(closeFlag);
          resolve();
        }, 300);
      });
    portalRef = {
      current: Portal.Render(
        Portal.Constant.TOASTER_OVERLAY_PORTAL,
        <ShowToaster ref={instanceRef} onClose={handleClose}>
          {children}
        </ShowToaster>,
      ),
    };
    return {
      close: async (closeFlag?: string) =>
        instanceRef?.current?.close(closeFlag),
    };
  },
  Close: ShowToasterClose,
};

export { useToaster } from './ShowToaster';
export type { IShowToasterProps } from './ShowToaster';

export function ShowToastProvider() {
  return (
    <ToastProvider swipeDirection="up">
      <Portal.Container name={Portal.Constant.TOASTER_OVERLAY_PORTAL} />
    </ToastProvider>
  );
}
