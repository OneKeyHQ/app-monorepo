import { StyleSheet } from 'react-native';
import { G, Path, Rect, Svg } from 'react-native-svg';

import {
  ENTRY_LOOP,
  ENTRY_OK_TRACK,
  PRESS_IDLE_TRACK,
  useOkPressDrive,
} from '../ClassicDevice/animation';
import { EntryScreen, createEntryGeometry } from '../ClassicDevice/EntryScreen';
import {
  ASTERISK_ENTERED,
  DIAMOND_ENTERED,
  DIAMOND_PENDING,
  LOGO_D,
  UNDERSCORE_PENDING,
} from '../ClassicDevice/scenes';
import { CONFIRM_LOOP } from '../deviceScene';
import { GlassSweep } from '../deviceSceneHost';

import { SCREEN_GLASS_H, SCREEN_GLASS_W } from './shell';

import type { IClassicDeviceScene } from '../ClassicDevice/scenes';
import type {
  IDeviceSceneContentProps,
  IDeviceSceneSpec,
} from '../deviceSceneHost';

/**
 * The Mini's built-in scenes: the Classic's four, word for word — the
 * Mini is the same monochrome OLED family and its screen shows the same
 * things — re-laid for its near-square glass. The content grid stays the
 * family's 128 wide (one unit = glass width / 128, so glyphs keep their
 * size relative to the screen); the glass is ~131 units tall instead of
 * 64, and the extra height is spent the way each screen's anchoring
 * asks: what the Classic centres (the mark, the entry title-and-row, the
 * confirm body bars) rides to the taller glass's centre, what it pins
 * to an edge (the confirm title pill at the top, the x/check key hints
 * at the bottom corners) keeps its edge inset. Scene names and the press
 * drive are the Classic's, so the routing above sees one vocabulary.
 */
export type IMiniDeviceScene = IClassicDeviceScene;

/** Canvas px per grid unit, and the glass height in units. */
const UNIT = SCREEN_GLASS_W / 128;
const GRID_H = SCREEN_GLASS_H / UNIT;
const VIEW_BOX = `0 0 128 ${GRID_H}`;
/** How far the Classic's 64-tall composition drops to sit centred. */
const CENTER_OFFSET = (GRID_H - 64) / 2;

/* ------------------------- connecting ------------------------- */

const CONNECTING_LOGO = (
  <Svg width="100%" height="100%" viewBox={VIEW_BOX} fill="none">
    <Path
      transform={`translate(54 ${22 + CENTER_OFFSET}) scale(0.5)`}
      d={LOGO_D}
      fill="#fff"
      fillRule="evenodd"
    />
  </Svg>
);

function ConnectingScreen({ clock }: IDeviceSceneContentProps) {
  useOkPressDrive(clock, PRESS_IDLE_TRACK);
  return CONNECTING_LOGO;
}

/* ------------------------- confirm ------------------------- */

const CONFIRM_SKELETON = (
  <Svg width="100%" height="100%" viewBox={VIEW_BOX} fill="none">
    <Rect
      x={32}
      y={3}
      width={64}
      height={10}
      rx={5}
      fill="#fff"
      fillOpacity={0.59}
    />
    <Rect
      x={18}
      y={23 + CENTER_OFFSET}
      width={92}
      height={7}
      rx={3.5}
      fill="#fff"
      fillOpacity={0.28}
    />
    <Rect
      x={36}
      y={35 + CENTER_OFFSET}
      width={56}
      height={7}
      rx={3.5}
      fill="#fff"
      fillOpacity={0.28}
    />
    <G transform={`translate(0 ${GRID_H - 64})`}>
      <Path
        d="M6.5 53.5L12.5 59.5M12.5 53.5L6.5 59.5"
        stroke="#fff"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M113.5 57L116.4 59.8L121.5 53.6"
        stroke="#fff"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </G>
  </Svg>
);

// The content canvas is the whole glass, so the sweep's clip is the glass.
const confirmStyles = StyleSheet.create({
  sweepClip: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SCREEN_GLASS_W,
    height: SCREEN_GLASS_H,
    overflow: 'hidden',
  },
});

function ConfirmScreen({ clock }: IDeviceSceneContentProps) {
  useOkPressDrive(clock, PRESS_IDLE_TRACK);
  return (
    <>
      {CONFIRM_SKELETON}
      <GlassSweep
        clock={clock}
        width={SCREEN_GLASS_W}
        height={SCREEN_GLASS_H}
        clipStyle={confirmStyles.sweepClip}
      />
    </>
  );
}

/* ---------------------- character entry ---------------------- */

// The Classic's slot composition (title top 4, row centre 38.5 on its
// 64-tall slot), centred on the taller glass.
const MINI_ENTRY = createEntryGeometry({
  unit: UNIT,
  centerX: 64,
  rowCy: 38.5 + CENTER_OFFSET,
  titleTop: 4 + CENTER_OFFSET,
});

function EnterPinScreen({ clock }: IDeviceSceneContentProps) {
  useOkPressDrive(clock, ENTRY_OK_TRACK);
  return (
    <EntryScreen
      clock={clock}
      geometry={MINI_ENTRY}
      title="Enter PIN"
      enteredGlyph={DIAMOND_ENTERED}
      pendingGlyph={DIAMOND_PENDING}
    />
  );
}

function EnterPassphraseScreen({ clock }: IDeviceSceneContentProps) {
  useOkPressDrive(clock, ENTRY_OK_TRACK);
  return (
    <EntryScreen
      clock={clock}
      geometry={MINI_ENTRY}
      title="Enter Passphrase"
      enteredGlyph={ASTERISK_ENTERED}
      pendingGlyph={UNDERSCORE_PENDING}
    />
  );
}

export const SCENES: Record<IMiniDeviceScene, IDeviceSceneSpec> = {
  connecting: { content: ConnectingScreen },
  confirm: { content: ConfirmScreen, loop: CONFIRM_LOOP },
  enterPin: { content: EnterPinScreen, loop: ENTRY_LOOP },
  enterPassphrase: { content: EnterPassphraseScreen, loop: ENTRY_LOOP },
};
