// Extra room, beyond the safe area, that content beside the window corners
// must leave for system window controls.
export type IWindowControlsInsets = {
  top: number;
  left: number;
  bottom: number;
  right: number;
};

export const ZERO_WINDOW_CONTROLS_INSETS: IWindowControlsInsets = {
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
};
