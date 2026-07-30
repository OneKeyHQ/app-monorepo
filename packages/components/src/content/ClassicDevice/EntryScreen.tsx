import { useState } from 'react';
import type { ReactNode } from 'react';

import { StyleSheet } from 'react-native';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { G, Path, Svg } from 'react-native-svg';

import { SizableText, Stack } from '../../primitives';

import { SCREEN_SLOT_TOP } from './shell';

import type { SharedValue } from 'react-native-reanimated';

/**
 * Shared screen of the character-entry scenes (Enter PIN / Enter Passphrase):
 * a literal-text title in the app font over a nine-slot row. A scene supplies
 * only its two glyphs, authored around the origin - this component translates
 * each into its slot. The cursor carets, the check that replaces the cursor
 * glyph once every character is in (the final press is the confirm), and the
 * entered-state wiring live here.
 */

const SLOT_N = 9;
const SLOT_PITCH = 13;
const ROW_CY = 38.5;
const slotX = (i: number) => 64 + (i - 4) * SLOT_PITCH;
const slotTransform = (i: number) => `translate(${slotX(i)} ${ROW_CY})`;
// Title baseline sits at 20 on the glass; the slot already starts lower.
const TITLE_TOP = 20 - SCREEN_SLOT_TOP;

const CHECK_GLYPH = (
  <Path
    d="M-3.3 0.3L-0.9 2.7L3.5 -2.9"
    stroke="#fff"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

const CARETS = (
  <>
    <Path
      d="M-2.7 -9.2L0 -11.6L2.7 -9.2"
      stroke="#fff"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M-2.7 9.2L0 11.6L2.7 9.2"
      stroke="#fff"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </>
);

export interface IEntryScreenProps {
  /** Characters entered so far, from useEntryOnClassicAnimation. */
  entered: Readonly<SharedValue<number>>;
  /** How many characters this scenario asks for. */
  fillCount: number;
  title: string;
  /** Glyph of an entered character, drawn around the slot origin. */
  enteredGlyph: ReactNode;
  /** Glyph of a pending slot, also shown under the cursor while typing. */
  pendingGlyph: ReactNode;
}

// Owns the discrete entered count so fills only re-render this small subtree,
// never the 76-element device body (its screenContent stays referentially
// stable).
export function EntryScreen({
  entered,
  fillCount,
  title,
  enteredGlyph,
  pendingGlyph,
}: IEntryScreenProps) {
  const [count, setCount] = useState(0);
  useAnimatedReaction(
    () => entered.value,
    (value, previous) => {
      if (value !== previous) runOnJS(setCount)(value);
    },
    [entered],
  );
  const cursor = Math.min(count, SLOT_N - 1);
  return (
    <Stack flex={1}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 128 64"
        fill="none"
        style={StyleSheet.absoluteFill}
      >
        {Array.from({ length: SLOT_N }, (_, i) => {
          let glyph = pendingGlyph;
          if (i < count) glyph = enteredGlyph;
          else if (i === cursor && count >= fillCount) glyph = CHECK_GLYPH;
          return (
            <G key={i} transform={slotTransform(i)}>
              {glyph}
            </G>
          );
        })}
        <G transform={slotTransform(cursor)}>{CARETS}</G>
      </Svg>
      <SizableText
        position="absolute"
        top={TITLE_TOP}
        left={0}
        right={0}
        textAlign="center"
        color="#fff"
        fontSize={20}
        lineHeight={24}
        fontWeight="500"
      >
        {title}
      </SizableText>
    </Stack>
  );
}
