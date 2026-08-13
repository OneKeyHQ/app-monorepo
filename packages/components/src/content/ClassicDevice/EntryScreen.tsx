import { Fragment, useMemo } from 'react';
import type { ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import { SizableText, Stack } from '../../primitives';
import { TrackedLayer } from '../deviceSceneHost';

import {
  ENTRY_FILL_COUNT,
  ENTRY_ROW_TRACK,
  ENTRY_SLOT_IN_TRACKS,
  ENTRY_SLOT_OUT_TRACKS,
  entryCaretShiftTrack,
} from './animation';
import { SCREEN_SLOT_TOP } from './shell';

import type { ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

/**
 * Shared screen of the character-entry scenes (Enter PIN / Enter
 * Passphrase): a literal-text title in the app font over a nine-slot row.
 * A scene supplies only its two glyphs, authored around the origin on the
 * 128x64 grid — this component gives each a 2x pixel box in its slot.
 * Every changing element rides a keyframe track of the scene clock, so
 * nothing snaps: a fill cross-fades pending -> entered, the check
 * cross-fades in over the cursor's glyph, the caret pair slides to the
 * next slot, and the whole row fades out and back in around the loop
 * seam (the title holds) while the tracks reset off-glass.
 */

const SLOT_N = 9;
const SLOT_PITCH = 13;
const ROW_CY = 38.5;
const slotX = (i: number) => 64 + (i - 4) * SLOT_PITCH;
// Title baseline sits at 20 on the glass; the slot already starts lower.
const TITLE_TOP = 20 - SCREEN_SLOT_TOP;

// The content canvas is the 256x128 slot, 2x the 128x64 authoring grid; a
// glyph gets a box around its slot centre, the carets a taller one (they
// reach +-11.6 grid units past it).
const GLYPH_BOX = 24;
const GLYPH_VIEW_BOX = '-6 -6 12 12';
const CARET_W = 24;
const CARET_H = 52;
const CARET_VIEW_BOX = '-6 -13 12 26';

const SLOT_GLYPH_STYLES: ViewStyle[] = Array.from(
  { length: SLOT_N },
  (_, i) => ({
    position: 'absolute',
    left: 2 * slotX(i) - GLYPH_BOX / 2,
    top: 2 * ROW_CY - GLYPH_BOX / 2,
    width: GLYPH_BOX,
    height: GLYPH_BOX,
  }),
);
const CARET_STYLE: ViewStyle = {
  position: 'absolute',
  left: 2 * slotX(0) - CARET_W / 2,
  top: 2 * ROW_CY - CARET_H / 2,
  width: CARET_W,
  height: CARET_H,
};
const ROW_STYLE: ViewStyle = { ...StyleSheet.absoluteFill };

const CARET_SHIFT_TRACK = entryCaretShiftTrack(2 * SLOT_PITCH);

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

function glyphSvg(glyph: ReactNode, viewBox = GLYPH_VIEW_BOX) {
  return (
    <Svg width="100%" height="100%" viewBox={viewBox} fill="none">
      {glyph}
    </Svg>
  );
}

const CHECK_SVG = glyphSvg(CHECK_GLYPH);
const CARETS_SVG = glyphSvg(CARETS, CARET_VIEW_BOX);

export interface IEntryScreenProps {
  /** Scene clock every track evaluates against. */
  clock: SharedValue<number>;
  title: string;
  /** Glyph of an entered character, drawn around the slot origin. */
  enteredGlyph: ReactNode;
  /** Glyph of a pending slot, also shown under the cursor while typing. */
  pendingGlyph: ReactNode;
}

export function EntryScreen({
  clock,
  title,
  enteredGlyph,
  pendingGlyph,
}: IEntryScreenProps) {
  // One element per glyph, reused across slots: element descriptors are
  // immutable, and a fresh node per slot would re-extract all its SVG
  // props on every render.
  const pendingSvg = useMemo(() => glyphSvg(pendingGlyph), [pendingGlyph]);
  const enteredSvg = useMemo(() => glyphSvg(enteredGlyph), [enteredGlyph]);
  return (
    <Stack flex={1}>
      <TrackedLayer clock={clock} track={ENTRY_ROW_TRACK} baseStyle={ROW_STYLE}>
        {SLOT_GLYPH_STYLES.map((style, i) =>
          i > ENTRY_FILL_COUNT ? (
            // Slots the schedule never reaches: pending, still.
            <View key={i} pointerEvents="none" style={style}>
              {pendingSvg}
            </View>
          ) : (
            <Fragment key={i}>
              <TrackedLayer
                clock={clock}
                track={ENTRY_SLOT_OUT_TRACKS[i]}
                baseStyle={style}
              >
                {pendingSvg}
              </TrackedLayer>
              <TrackedLayer
                clock={clock}
                track={ENTRY_SLOT_IN_TRACKS[i]}
                baseStyle={style}
              >
                {/* The cursor's final slot fills with the check. */}
                {i === ENTRY_FILL_COUNT ? CHECK_SVG : enteredSvg}
              </TrackedLayer>
            </Fragment>
          ),
        )}
        <TrackedLayer
          clock={clock}
          shiftTrack={CARET_SHIFT_TRACK}
          baseStyle={CARET_STYLE}
        >
          {CARETS_SVG}
        </TrackedLayer>
      </TrackedLayer>
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
