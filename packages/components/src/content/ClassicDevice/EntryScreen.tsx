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

import type { IKeyframe } from '../deviceScene';
import type { ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

/**
 * Shared screen of the character-entry scenes (Enter PIN / Enter
 * Passphrase): a literal-text title in the app font over a nine-slot row.
 * A scene supplies only its two glyphs, authored around the origin on the
 * OLED family's 128-wide grid — this component gives each a pixel box in
 * its slot, sized by the device's geometry (see IEntryLayout: the Classic
 * lights the grid at 2x on its 256x128 slot, the Mini at its own unit on
 * a near-square glass). Every changing element rides a keyframe track of
 * the scene clock, so nothing snaps: a fill cross-fades pending ->
 * entered, the check cross-fades in over the cursor's glyph, the caret
 * pair slides to the next slot, and the whole row fades out and back in
 * around the loop seam (the title holds) while the tracks reset
 * off-glass.
 */

const SLOT_N = 9;
/** Slot pitch, glyph box and caret box, in grid units — the row's own
 * vocabulary, the same on every device of the family. */
const SLOT_PITCH = 13;
const GLYPH_BOX = 12;
const GLYPH_VIEW_BOX = '-6 -6 12 12';
const CARET_W = 12;
// The carets reach +-11.6 grid units past the slot centre.
const CARET_H = 26;
const CARET_VIEW_BOX = '-6 -13 12 26';
/** The title's metrics in grid units (the Classic's 20/24 at 2x). */
const TITLE_FONT = 10;
const TITLE_LINE = 12;

/**
 * Where a device lays the entry screen on its content canvas, in grid
 * units: the canvas px per unit, the slot row's centre (the slots fan
 * out from `centerX`), and the title's top edge.
 */
export interface IEntryLayout {
  unit: number;
  centerX: number;
  rowCy: number;
  titleTop: number;
}

/** The layout resolved to canvas styles and the caret's slide track —
 * built once per device at module scope (see createEntryGeometry). */
export interface IEntryGeometry {
  slotStyles: ViewStyle[];
  caretStyle: ViewStyle;
  caretShiftTrack: IKeyframe[];
  titleTop: number;
  titleFontSize: number;
  titleLineHeight: number;
}

export function createEntryGeometry({
  unit,
  centerX,
  rowCy,
  titleTop,
}: IEntryLayout): IEntryGeometry {
  const slotX = (i: number) => centerX + (i - 4) * SLOT_PITCH;
  const glyphBox = GLYPH_BOX * unit;
  const caretW = CARET_W * unit;
  const caretH = CARET_H * unit;
  return {
    slotStyles: Array.from({ length: SLOT_N }, (_, i) => ({
      position: 'absolute',
      left: unit * slotX(i) - glyphBox / 2,
      top: unit * rowCy - glyphBox / 2,
      width: glyphBox,
      height: glyphBox,
    })),
    caretStyle: {
      position: 'absolute',
      left: unit * slotX(0) - caretW / 2,
      top: unit * rowCy - caretH / 2,
      width: caretW,
      height: caretH,
    },
    caretShiftTrack: entryCaretShiftTrack(unit * SLOT_PITCH),
    titleTop: unit * titleTop,
    titleFontSize: unit * TITLE_FONT,
    titleLineHeight: unit * TITLE_LINE,
  };
}

const ROW_STYLE: ViewStyle = { ...StyleSheet.absoluteFill };

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
  /** The device's resolved layout (a module constant). */
  geometry: IEntryGeometry;
  title: string;
  /** Glyph of an entered character, drawn around the slot origin. */
  enteredGlyph: ReactNode;
  /** Glyph of a pending slot, also shown under the cursor while typing. */
  pendingGlyph: ReactNode;
}

export function EntryScreen({
  clock,
  geometry,
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
        {geometry.slotStyles.map((style, i) =>
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
          shiftTrack={geometry.caretShiftTrack}
          baseStyle={geometry.caretStyle}
        >
          {CARETS_SVG}
        </TrackedLayer>
      </TrackedLayer>
      <SizableText
        position="absolute"
        top={geometry.titleTop}
        left={0}
        right={0}
        textAlign="center"
        color="#fff"
        fontSize={geometry.titleFontSize}
        lineHeight={geometry.titleLineHeight}
        fontWeight="500"
      >
        {title}
      </SizableText>
    </Stack>
  );
}
