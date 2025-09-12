import type { ToastT } from 'sonner';

export type IToastMessageOptions = {
  renderContent: (props?: { width?: number }) => JSX.Element;
  /**
   * Defaults to `done`.
   */
  preset?: 'done' | 'error' | 'none' | 'custom';
  /**
   * Duration in seconds.
   */
  duration: number;
  haptic?: 'success' | 'warning' | 'info' | 'error' | 'none';
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
