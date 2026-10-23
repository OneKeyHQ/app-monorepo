import type { ReactNode } from 'react';

export type IChartInteractionProps = {
  children: ReactNode;
  width: number;
  height: number;
  accessibilityLabel: string;
  onSelect: (x: number) => void;
  onEnd: () => void;
};

export function ChartInteraction({
  children,
  width,
  height,
  accessibilityLabel,
  onSelect,
  onEnd,
}: IChartInteractionProps) {
  return (
    <div
      role="img"
      aria-label={accessibilityLabel}
      style={{ width, height, position: 'relative' }}
      onPointerMove={(event) => {
        if (event.pointerType === 'mouse') {
          onSelect(
            event.clientX - event.currentTarget.getBoundingClientRect().left,
          );
        }
      }}
      onPointerLeave={onEnd}
      onPointerDown={(event) => {
        onSelect(
          event.clientX - event.currentTarget.getBoundingClientRect().left,
        );
      }}
      onPointerUp={(event) => {
        if (event.pointerType !== 'mouse') onEnd();
      }}
      onPointerCancel={onEnd}
    >
      {children}
    </div>
  );
}
