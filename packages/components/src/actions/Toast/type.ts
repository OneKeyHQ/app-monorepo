export type IToastMessageOptions = {
  title: JSX.Element;
  message?: string;
  /**
   * Defaults to `done`.
   */
  preset?: 'done' | 'error' | 'none' | 'custom';
  /**
   * Duration in seconds.
   */
  duration: number;
  haptic?: 'success' | 'warning' | 'error' | 'none';
  /**
   * Defaults to `true`.
   */
  shouldDismissByDrag?: boolean;
  /**
   * Change the presentation side.
   * @platform ios
   */
  from?: 'top' | 'bottom';
  icon?: JSX.Element;
};
