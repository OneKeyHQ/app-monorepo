export type IPaneDragHandleProps = {
  top: number;
  label: string;
  testID: string;
  mode: 'resize' | 'move';
  title?: string;
  onStart: () => void;
  onDrag: (deltaY: number, finished: boolean, cancelled: boolean) => void;
  /** Web resize handles: a double click restores the default pane heights. */
  onReset?: () => void;
};
