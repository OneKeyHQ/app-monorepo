import type { RefObject } from 'react';
import { createRef } from 'react';

import { ToastProvider } from '@tamagui/toast';
import { toast } from 'burnt';
import { getTokens } from 'tamagui';

import { Portal } from '../../hocs';
import { Icon } from '../../primitives';

import { CustomToaster } from './CustomToaster';

import type {
  ICustomToasterInstance,
  ICustomToasterProps,
} from './CustomToaster';
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
  show: ({ onClose, children, onDismiss }: ICustomToasterProps) => {
    let instanceRef: RefObject<ICustomToasterInstance> | undefined =
      createRef<ICustomToasterInstance>();
    let portalRef:
      | {
          current: IPortalManager;
        }
      | undefined;

    const handleClose = () =>
      new Promise<void>((resolve) => {
        void onClose?.();
        // Remove the React node after the animation has finished.
        setTimeout(() => {
          if (instanceRef) {
            instanceRef = undefined;
          }
          if (portalRef) {
            portalRef.current.destroy();
            portalRef = undefined;
          }
          onDismiss?.();
          resolve();
        }, 300);
      });
    portalRef = {
      current: Portal.Render(
        Portal.Constant.TOASTER_OVERLAY_PORTAL,
        <CustomToaster ref={instanceRef} onClose={handleClose}>
          {children}
        </CustomToaster>,
      ),
    };
    return {
      close: async () => instanceRef?.current?.close(),
    };
  },
};

export type { ICustomToasterProps } from './CustomToaster';

export const CustomToastProvider = ToastProvider;
