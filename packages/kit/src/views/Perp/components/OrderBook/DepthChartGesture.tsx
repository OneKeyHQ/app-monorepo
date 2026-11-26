import type { ReactElement } from 'react';

export type IDepthChartGestureProps = {
  children: ReactElement;
  onTouchMove: (x: number) => void;
  onTouchEnd: () => void;
};

export function DepthChartGesture({ children }: IDepthChartGestureProps) {
  return children;
}
