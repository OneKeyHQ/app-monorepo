import { useState } from 'react';
import type { ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { G, Path, Svg } from 'react-native-svg';

import { SizableText } from '../../primitives';

import { ENTRY_FILL_COUNT, entryEnteredAt } from './animation';

import type { SharedValue } from 'react-native-reanimated';

/**
 * Shared screen of the character-entry scenes (Enter PIN / Enter Passphrase):
 * a literal-text title in the app font over a nine-slot row. A scene supplies
 * only its two glyphs - entered and pending; the cursor carets, the check
 * that replaces the cursor glyph once all six characters are in (the final
 * press is the confirm), and the entered-state wiring live here.
 */

export const ENTRY_ROW_CY = 38.5;
const SLOT_N = 9;
const SLOT_PITCH = 13;
const slotX = (i: number) => 64 + (i - 4) * SLOT_PITCH;

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  title: {
    position: 'absolute',
    // Screen-relative 20 minus the content slot's 12pt top offset.
    top: 8,
    left: 0,
    right: 0,
    textAlign: 'center',
  },
});

function CheckGlyph({ cx }: { cx: number }) {
  return (
    <Path
      d={`M${cx - 3.3} ${ENTRY_ROW_CY + 0.3}L${cx - 0.9} ${
        ENTRY_ROW_CY + 2.7
      }L${cx + 3.5} ${ENTRY_ROW_CY - 2.9}`}
      stroke="#fff"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function Carets({ cx }: { cx: number }) {
  return (
    <>
      <Path
        d={`M${cx - 2.7} ${ENTRY_ROW_CY - 9.2}L${cx} ${ENTRY_ROW_CY - 11.6}L${
          cx + 2.7
        } ${ENTRY_ROW_CY - 9.2}`}
        stroke="#fff"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={`M${cx - 2.7} ${ENTRY_ROW_CY + 9.2}L${cx} ${ENTRY_ROW_CY + 11.6}L${
          cx + 2.7
        } ${ENTRY_ROW_CY + 9.2}`}
        stroke="#fff"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

export interface IEntryScreenProps {
  /** The scene's master clock, from useEntryOnClassicAnimation. */
  clock: Readonly<SharedValue<number>>;
  title: string;
  /** Glyph of an entered character, centred on (cx, ENTRY_ROW_CY). */
  renderEntered: (cx: number) => ReactNode;
  /** Glyph of a pending slot (also shown under the cursor while typing). */
  renderPending: (cx: number) => ReactNode;
}

// Owns the discrete entered state so fills only re-render this small subtree,
// never the 76-element device body (its screenContent stays referentially
// stable).
export function EntryScreen({
  clock,
  title,
  renderEntered,
  renderPending,
}: IEntryScreenProps) {
  const [entered, setEntered] = useState(0);
  useAnimatedReaction(
    () => entryEnteredAt(clock.value),
    (value, previous) => {
      if (value !== previous) runOnJS(setEntered)(value);
    },
    [clock],
  );
  const cursor = Math.min(entered, SLOT_N - 1);
  return (
    <View style={styles.fill}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 128 64"
        fill="none"
        style={StyleSheet.absoluteFill}
      >
        {Array.from({ length: SLOT_N }, (_, i) => {
          const cx = slotX(i);
          if (i < entered) return <G key={i}>{renderEntered(cx)}</G>;
          if (i === cursor && entered >= ENTRY_FILL_COUNT) {
            return (
              <G key={i}>
                <CheckGlyph cx={cx} />
              </G>
            );
          }
          return <G key={i}>{renderPending(cx)}</G>;
        })}
        <Carets cx={slotX(cursor)} />
      </Svg>
      <SizableText
        style={styles.title}
        color="#fff"
        fontSize={20}
        lineHeight={24}
        fontWeight="500"
      >
        {title}
      </SizableText>
    </View>
  );
}
