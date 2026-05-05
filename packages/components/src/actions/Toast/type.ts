import type { ToastT } from 'sonner';

export type IToastMessageOptions = {
  renderContent: (props?: { width?: number }) => JSX.Element;
  /**
   * Stable ID for programmatic dismissal via Toast.dismiss(id).
   */
  toastId?: string;
  /**
   * Defaults to `done`.
   */
  preset?: 'done' | 'error' | 'none' | 'custom';
  /**
   * Duration in seconds.
   */
  duration: number;
  haptic?: 'success' | 'warning' | 'info' | 'error' | 'loading' | 'none';
  /**
   * Defaults to `true`.
   */
  shouldDismissByDrag?: boolean;
  /**
   * Change the presentation side.
   * @platform ios
   */
  from?: 'top' | 'bottom';
  /**
   * Change the position of the toast.
   * Only works on web platform.
   * @platform web
   */
  position?: ToastT['position'];
};
