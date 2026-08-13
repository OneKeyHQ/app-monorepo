import { StyleSheet } from 'react-native';
import { Path, Rect, Svg } from 'react-native-svg';

import { CONFIRM_LOOP } from '../deviceScene';
import { GlassSweep } from '../deviceSceneHost';

import {
  ENTRY_LOOP,
  ENTRY_OK_TRACK,
  PRESS_IDLE_TRACK,
  useOkPressDrive,
} from './animation';
import { EntryScreen } from './EntryScreen';
import { SCREEN_SLOT_TOP } from './shell';

import type {
  IDeviceSceneContentProps,
  IDeviceSceneSpec,
} from '../deviceSceneHost';

/**
 * Built-in scenes, keyed by the name ClassicDevice's `animation` prop takes,
 * on the shared presence registry contract (../deviceSceneHost). A scene
 * supplies its screen content on the 128x64 OLED canvas and steers the OK
 * key through the press drive; entrance, exit and the clock are the shared
 * machinery.
 */
export type IClassicDeviceScene =
  | 'connecting'
  | 'confirm'
  | 'enterPin'
  | 'enterPassphrase';

/* ------------------------- connecting ------------------------- *
 * The OneKey mark the physical device shows while the app reaches for it
 * (Figma 20650:1302): a 24x24-cell pixel rendering, 40pt in the node and
 * half that here on the halved OLED canvas, centered. One even-odd path:
 * the digits are unlit holes, not black paint, so the panel's faint glow
 * shows through them like every other dark pixel. The digit subpaths are
 * the Figma asset translated to its measured (13.333, 7.5) offset inside
 * the mark. */

const LOGO_D =
  'M28.333 1.66699H31.666V3.33301H35V5H36.666V8.33301H38.333V11.667H40V28.333H38.333V31.666H36.666V35H35V36.666H31.666V38.333H28.333V40H11.667V38.333H8.33301V36.666H5V35H3.33301V31.666H1.66699V28.333H0V11.667H1.66699V8.33301H3.33301V5H5V3.33301H8.33301V1.66699H11.667V0H28.333V1.66699Z' +
  'M23.333 20.834H25V22.5H26.666V29.167H25V30.834H23.333V32.5H16.666V30.834H15V29.167H13.333V22.5H15V20.834H16.666V19.167H23.333V20.834ZM18.333 24.167H16.666V27.5H18.333V29.167H21.666V27.5H23.333V24.167H21.666V22.5H18.333V24.167Z' +
  'M21.667 17.5H18.333V10.833H15V9.167H16.667V7.5H21.667V17.5Z';

const CONNECTING_LOGO = (
  <Svg width="100%" height="100%" viewBox="0 0 128 64" fill="none">
    <Path
      transform="translate(54 22) scale(0.5)"
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

/* ------------------------- confirm ------------------------- *
 * Confirmation scenarios are unbounded, so the screen abstracts to skeleton
 * structure: a title pill, two body bars, and literal x / check corner
 * glyphs - the invariants of every confirm screen. The scene deliberately
 * presses nothing: this is the screen the user should read, and acting out
 * an OK press would perform the approval for them. The glass light passes
 * over the still instead, same as on the Pro and the Slate. */

const CONFIRM_SKELETON = (
  <Svg width="100%" height="100%" viewBox="0 0 128 64" fill="none">
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
      y={23}
      width={92}
      height={7}
      rx={3.5}
      fill="#fff"
      fillOpacity={0.28}
    />
    <Rect
      x={36}
      y={35}
      width={56}
      height={7}
      rx={3.5}
      fill="#fff"
      fillOpacity={0.28}
    />
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
  </Svg>
);

// The sweep travels the whole glass, not just the lit slot: the slot sits
// at (4, SCREEN_SLOT_TOP) in the 264x152 glass, whose own overflow does the
// final clipping.
const confirmStyles = StyleSheet.create({
  sweepClip: {
    position: 'absolute',
    left: -4,
    top: -SCREEN_SLOT_TOP,
    width: 264,
    height: 152,
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
        width={264}
        height={152}
        clipStyle={confirmStyles.sweepClip}
      />
    </>
  );
}

/* ---------------------- character entry ---------------------- *
 * PIN and Passphrase differ only in glyphs, each authored around its slot
 * origin; the schedule, the carets, the final-confirm check and the row's
 * loop-seam fade come from the shared entry vocabulary (./animation and
 * ./EntryScreen). */

const DIAMOND_ENTERED = (
  <Rect
    x={-3.45}
    y={-3.45}
    width={6.9}
    height={6.9}
    rx={1.2}
    transform="rotate(45)"
    fill="#fff"
  />
);

// Hollow diamond, sized so its outer edge matches the filled one.
const DIAMOND_PENDING = (
  <Rect
    x={-2.95}
    y={-2.95}
    width={5.9}
    height={5.9}
    rx={1}
    transform="rotate(45)"
    stroke="#fff"
    strokeWidth={1.5}
  />
);

// Asterisk: three crossed strokes (masked character).
const ASTERISK_ENTERED = (
  <Path
    d="M0 -3.8L0 3.8M-3.29 -1.9L3.29 1.9M3.29 -1.9L-3.29 1.9"
    stroke="#fff"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

// Underscore, sitting just below the row centre.
const UNDERSCORE_PENDING = (
  <Rect x={-3.5} y={2.3} width={7} height={1.6} rx={0.8} fill="#fff" />
);

function EnterPinScreen({ clock }: IDeviceSceneContentProps) {
  useOkPressDrive(clock, ENTRY_OK_TRACK);
  return (
    <EntryScreen
      clock={clock}
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
      title="Enter Passphrase"
      enteredGlyph={ASTERISK_ENTERED}
      pendingGlyph={UNDERSCORE_PENDING}
    />
  );
}

export const SCENES: Record<IClassicDeviceScene, IDeviceSceneSpec> = {
  connecting: { content: ConnectingScreen },
  confirm: { content: ConfirmScreen, loop: CONFIRM_LOOP },
  enterPin: { content: EnterPinScreen, loop: ENTRY_LOOP },
  enterPassphrase: { content: EnterPassphraseScreen, loop: ENTRY_LOOP },
};
