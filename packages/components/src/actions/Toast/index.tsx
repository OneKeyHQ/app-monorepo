import { toast } from 'burnt';
import { getTokens } from 'tamagui';

import { Icon } from '../../primitives';

interface IToastProps {
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
};
