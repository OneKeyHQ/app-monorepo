import { useMemo } from 'react';

import { ClassicDevice } from '.';

import { Rect } from 'react-native-svg';

import { useEntryOnClassicAnimation } from './animation';
import { ENTRY_ROW_CY, EntryScreen } from './EntryScreen';

/**
 * Enter PIN scene: one diamond language on the row - hollow = pending,
 * filled = entered. Everything else (schedule, carets, the final-confirm
 * check) comes from the shared entry vocabulary.
 */

const renderEntered = (cx: number) => (
  <Rect
    x={-3.45}
    y={-3.45}
    width={6.9}
    height={6.9}
    rx={1.2}
    transform={`translate(${cx} ${ENTRY_ROW_CY}) rotate(45)`}
    fill="#fff"
  />
);

// Hollow diamond, sized so its outer edge matches the filled one.
const renderPending = (cx: number) => (
  <Rect
    x={-2.95}
    y={-2.95}
    width={5.9}
    height={5.9}
    rx={1}
    transform={`translate(${cx} ${ENTRY_ROW_CY}) rotate(45)`}
    stroke="#fff"
    strokeWidth={1.5}
  />
);

export interface IEnterPinOnClassicProps {
  /** Same contract as ClassicDevice: rendered width in points. */
  width?: number;
}

export function EnterPinOnClassic({ width }: IEnterPinOnClassicProps) {
  const { animation, clock } = useEntryOnClassicAnimation();
  const screenContent = useMemo(
    () => (
      <EntryScreen
        clock={clock}
        title="Enter PIN"
        renderEntered={renderEntered}
        renderPending={renderPending}
      />
    ),
    [clock],
  );
  return (
    <ClassicDevice
      width={width}
      animation={animation}
      screenContent={screenContent}
    />
  );
}
