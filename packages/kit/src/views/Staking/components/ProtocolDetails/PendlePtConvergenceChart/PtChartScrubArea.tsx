import { useCallback } from 'react';
import type { PointerEvent } from 'react';

import type { IPtChartScrubAreaProps } from './PtChartScrubArea.types';

// A mouse reads the price under the cursor; a finger drags across the chart.
// `pan-y` leaves vertical page scrolling to the browser.
const AREA_STYLE = {
  position: 'absolute',
  left: 0,
  top: 0,
  touchAction: 'pan-y',
} as const;

export function PtChartScrubArea({
  width,
  height,
  onScrub,
  onScrubEnd,
}: IPtChartScrubAreaProps) {
  const handleMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      onScrub(event.clientX - rect.left);
    },
    [onScrub],
  );
  // A mouse keeps hovering after a click; a lifted finger is done.
  const handleUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== 'mouse') {
        onScrubEnd();
      }
    },
    [onScrubEnd],
  );

  return (
    <div
      onPointerDown={handleMove}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerLeave={onScrubEnd}
      onPointerCancel={onScrubEnd}
      style={{ ...AREA_STYLE, width, height }}
    />
  );
}
