import { useMemo } from 'react';

import { ClassicDevice } from '.';

import { Path, Rect } from 'react-native-svg';

import { useEntryOnClassicAnimation } from './animation';
import { ENTRY_ROW_CY, EntryScreen } from './EntryScreen';

/**
 * Enter Passphrase scene: asterisk = entered (masked character), underscore =
 * pending, on the shared entry schedule (the original Lottie files for PIN and
 * passphrase are frame-identical - glyphs are the only delta here too).
 */

// Asterisk: three crossed strokes.
const renderEntered = (cx: number) => (
  <Path
    d={`M${cx} ${ENTRY_ROW_CY - 3.8}L${cx} ${ENTRY_ROW_CY + 3.8}M${cx - 3.29} ${
      ENTRY_ROW_CY - 1.9
    }L${cx + 3.29} ${ENTRY_ROW_CY + 1.9}M${cx + 3.29} ${ENTRY_ROW_CY - 1.9}L${
      cx - 3.29
    } ${ENTRY_ROW_CY + 1.9}`}
    stroke="#fff"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

// Underscore on the row baseline.
const renderPending = (cx: number) => (
  <Rect x={cx - 3.5} y={40.8} width={7} height={1.6} rx={0.8} fill="#fff" />
);

export interface IEnterPassphraseOnClassicProps {
  /** Same contract as ClassicDevice: rendered width in points. */
  width?: number;
}

export function EnterPassphraseOnClassic({
  width,
}: IEnterPassphraseOnClassicProps) {
  const { animation, clock } = useEntryOnClassicAnimation();
  const screenContent = useMemo(
    () => (
      <EntryScreen
        clock={clock}
        title="Enter Passphrase"
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
