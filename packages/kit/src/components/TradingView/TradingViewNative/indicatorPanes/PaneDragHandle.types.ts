export type IPaneDragHandleProps = {
  top: number;
  label: string;
  testID: string;
  mode: 'resize' | 'move';
  title?: string;
  onStart: () => void;
  onDrag: (deltaY: number, finished: boolean, cancelled: boolean) => void;
};
