import { useState } from 'react';
import type { ReactNode } from 'react';

import { Image, StyleSheet, View } from 'react-native';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { Path, Svg } from 'react-native-svg';

import { SizableText } from '../../primitives';
import { CONFIRM_LOOP, PIN_SHEEN_TRACKS } from '../deviceScene';
import { GlassSweep, SHEEN_COLOR, TrackedLayer } from '../deviceSceneHost';

import {
  PASSPHRASE_DOT_TRACKS,
  PASSPHRASE_LOOP,
  PIN_DOT_SHIFT_TRACKS,
  PIN_DOT_TRACKS,
  PIN_LOOP,
  passphraseEnteredAt,
} from './animation';
import { PRO_SCREEN_BG, PRO_SCREEN_H, PRO_SCREEN_W } from './shell';

import type {
  IDeviceSceneContentProps,
  IDeviceSceneSpec,
} from '../deviceSceneHost';
import type { ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

/**
 * Built-in scenes of the Pro device, keyed by the name its `animation` prop
 * takes. Screen layouts are transcribed from the Pro Lottie files (confirm /
 * enter-pin / enter-passphrase, dark theme) with surface grays and the red
 * PIN backspace from real firmware screenshots; the choreography is the
 * shared presence vocabulary (../deviceScene), aligned with the Slate by
 * design call (2026-08-12): no key is ever pressed — the keypad plays the
 * traveling sheen, the keyboard catches the glass sweep on its caps, the
 * confirm still takes the sweep across the whole screen, and the entered
 * marks land on their own. connecting shows the wallpaper the device idles
 * on (the Slate's asset, same by design call).
 *
 * A scene is nothing but screen content plus the SCENES registry entry
 * declaring how ProDevice runs it; entrances, exits and the clock are the
 * shared presence machinery (../deviceSceneHost), so no scene carries
 * transition code.
 *
 * The Touch shows these same screens (../TouchDevice), on a panel of a
 * different black: the one place a scene paints the bare panel itself —
 * the passphrase keyboard's grille — takes that color from
 * `createScenes`, and everything else composites over whatever the shell
 * put under it.
 */
export type IProDeviceScene =
  | 'connecting'
  | 'confirm'
  | 'enterPin'
  | 'enterPassphrase';

/* --------------------------- palette --------------------------- *
 * Key colors from the Lottie keyframes; surface grays and the red PIN
 * backspace from real firmware screenshots. Skeleton fills are the shared
 * confirm-still whites (the Slate's), baked into rgba. */

const KEY_BG = '#1F1F21';
const KEY_LIT = '#00FF33';
const PRESSED_BG = '#2C2C2C';
const PIN_BSP_BG = '#FF3B30';
const SUBMIT_DISABLED_BG = '#219A39';
const GLYPH = '#EEEEEE';
const GLYPH_LIT = '#202020';
const FILL_STRONG = 'rgba(255,255,255,0.7)';
const FILL_FAINT = 'rgba(255,255,255,0.2)';

const CENTER: ViewStyle = { alignItems: 'center', justifyContent: 'center' };

function keyFrame(
  left: number,
  top: number,
  width: number,
  height: number,
  borderRadius: number,
  backgroundColor: string,
): ViewStyle {
  return {
    position: 'absolute',
    left,
    top,
    width,
    height,
    borderRadius,
    backgroundColor,
    overflow: 'hidden',
    ...CENTER,
  };
}

const sceneStyles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  wallpaper: {
    width: PRO_SCREEN_W,
    height: PRO_SCREEN_H,
  },
});

/* --------------------------- glyphs --------------------------- */

function checkGlyph(size: number, color: string) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12.5L10 17.5L19 7.5"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function backspaceGlyph(size: number, color: string, cutColor: string) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.2 5.5H19a1.8 1.8 0 0 1 1.8 1.8v9.4A1.8 1.8 0 0 1 19 18.5H9.2a1.8 1.8 0 0 1-1.4-.66L3.4 12.6a1 1 0 0 1 0-1.2l4.4-5.24a1.8 1.8 0 0 1 1.4-.66Z"
        fill={color}
      />
      <Path
        d="M11.6 9.6l4.8 4.8M16.4 9.6l-4.8 4.8"
        stroke={cutColor}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** The firmware's n/50 length counter under the passphrase field. */
function EntryCounter({
  clock,
  top,
}: {
  clock: SharedValue<number>;
  top: number;
}) {
  const [count, setCount] = useState(0);
  useAnimatedReaction(
    () => passphraseEnteredAt(clock.value),
    (value, previous) => {
      if (value !== previous) runOnJS(setCount)(value);
    },
    [clock],
  );
  return (
    <SizableText
      position="absolute"
      top={top}
      left={0}
      right={0}
      textAlign="center"
      color="#8C8C8C"
      fontSize={13}
      lineHeight={17}
    >
      {count}/50
    </SizableText>
  );
}

/* ------------------------- connecting ------------------------- *
 * The wallpaper the device idles on while the app reaches for it — the
 * same asset the Slate shows, by design call (one file, owned there along
 * with its decoded-size budget note), laid flat on the same 288x484. */

const WALLPAPER_SOURCE = require('../SlateDevice/screen-connecting.png');

function ConnectingContent({ onReady }: IDeviceSceneContentProps) {
  return (
    <Image
      source={WALLPAPER_SOURCE}
      style={sceneStyles.wallpaper}
      fadeDuration={0}
      onLoad={onReady}
    />
  );
}

/* ------------------------- enter PIN ------------------------- *
 * Title and four entered marks up top, a numeric pad near edge-to-edge and
 * bottom-flush like the firmware, the backspace in the firmware's red.
 * Choreography (schedule in ../deviceScene): the sheen sweeps the keypad
 * corner to corner, then the marks land one by one — progress without ever
 * performing a PIN. The marks row is centered, so each landing nudges the
 * cluster half a slot left. */

const PIN_KEY_W = 90;
const PIN_KEY_H = 74;
const PIN_KEY_R = 22;
const PIN_COLS = [4, 99, 194];
const PIN_ROWS = [169, 248, 327, 406];

const pinStyles = StyleSheet.create({
  dotsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 108,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#fff',
  },
  // The traveling sheen's slice on one key cap: peak brightness lives in
  // the fill, position in each key's stagger.
  keySheen: {
    ...StyleSheet.absoluteFill,
    borderRadius: PIN_KEY_R,
    backgroundColor: SHEEN_COLOR,
  },
});

const PIN_DIGIT_KEYS = [
  ...Array.from({ length: 9 }, (_, i) => String(i + 1)),
  '0',
].map((digit) => {
  const i = digit === '0' ? 10 : Number(digit) - 1;
  const col = i % 3;
  const row = Math.floor(i / 3);
  return {
    digit,
    frame: keyFrame(
      PIN_COLS[col],
      PIN_ROWS[row],
      PIN_KEY_W,
      PIN_KEY_H,
      PIN_KEY_R,
      KEY_BG,
    ),
    /** Grid diagonal, the key's position in the sheen's wavefront. */
    diagonal: col + row,
  };
});

const PIN_BSP_FRAME = keyFrame(
  PIN_COLS[0],
  PIN_ROWS[3],
  PIN_KEY_W,
  PIN_KEY_H,
  PIN_KEY_R,
  PIN_BSP_BG,
);
const PIN_SUBMIT_FRAME = keyFrame(
  PIN_COLS[2],
  PIN_ROWS[3],
  PIN_KEY_W,
  PIN_KEY_H,
  PIN_KEY_R,
  SUBMIT_DISABLED_BG,
);

const PIN_BSP_GLYPH = backspaceGlyph(28, '#fff', PIN_BSP_BG);
const PIN_CHECK_GLYPH = checkGlyph(28, GLYPH_LIT);

function PinDigitGlyph({ digit }: { digit: string }) {
  return (
    <SizableText color={GLYPH} fontSize={32} lineHeight={40} fontWeight="500">
      {digit}
    </SizableText>
  );
}

const PIN_TITLE = (
  <SizableText
    position="absolute"
    top={40}
    left={0}
    right={0}
    textAlign="center"
    color="#fff"
    fontSize={26}
    lineHeight={32}
    fontWeight="600"
  >
    Enter PIN Code
  </SizableText>
);

function PinScreen({ clock }: { clock: SharedValue<number> }) {
  return (
    <View style={sceneStyles.screen}>
      {PIN_TITLE}
      <View style={pinStyles.dotsRow}>
        {PIN_DOT_TRACKS.map((track, index) => (
          <TrackedLayer
            key={index}
            clock={clock}
            track={track}
            shiftTrack={PIN_DOT_SHIFT_TRACKS[index]}
            baseStyle={pinStyles.dot}
          />
        ))}
      </View>
      {PIN_DIGIT_KEYS.map(({ digit, frame, diagonal }) => (
        <View key={digit} style={frame}>
          <PinDigitGlyph digit={digit} />
          <TrackedLayer
            clock={clock}
            track={PIN_SHEEN_TRACKS[diagonal]}
            baseStyle={pinStyles.keySheen}
          />
        </View>
      ))}
      {/* Bottom-row caps, at their grid diagonals (col + row). */}
      <View style={PIN_BSP_FRAME}>
        {PIN_BSP_GLYPH}
        <TrackedLayer
          clock={clock}
          track={PIN_SHEEN_TRACKS[3]}
          baseStyle={pinStyles.keySheen}
        />
      </View>
      <View style={PIN_SUBMIT_FRAME}>
        {PIN_CHECK_GLYPH}
        <TrackedLayer
          clock={clock}
          track={PIN_SHEEN_TRACKS[5]}
          baseStyle={pinStyles.keySheen}
        />
      </View>
    </View>
  );
}

/* ------------------------- confirm ------------------------- *
 * Confirmation scenarios are unbounded, so the design abstracts to the
 * shared skeleton structure (the Slate's): a two-line title block, three
 * body lines, and the Cancel / Confirm pill pair on the bottom band — the
 * pills in the Pro firmware's own fills and geometry, label-less like the
 * rest of the still. Choreography: one gradient light crossing the glass
 * corner to corner, above the still — the light lives on the screen, not
 * on its elements. */

const confirmStyles = StyleSheet.create({
  titleLine1: keyFrame(14.4, 50.4, 153, 13.8, 6.9, FILL_STRONG),
  titleLine2: keyFrame(14.4, 80.9, 94.2, 13.8, 6.9, FILL_STRONG),
  bodyLine1: keyFrame(14.4, 128.1, 259.2, 9.6, 4.8, FILL_FAINT),
  bodyLine2: keyFrame(14.4, 154.4, 259.2, 9.6, 4.8, FILL_FAINT),
  bodyLine3: keyFrame(14.4, 180.7, 126.6, 9.6, 4.8, FILL_FAINT),
  cancelPill: keyFrame(10.5, 414, 127, 60, 30, PRESSED_BG),
  confirmPill: keyFrame(150.5, 414, 127, 60, 30, KEY_LIT),
  sweepClip: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
});

const CONFIRM_SKELETON = (
  <>
    <View style={confirmStyles.titleLine1} />
    <View style={confirmStyles.titleLine2} />
    <View style={confirmStyles.bodyLine1} />
    <View style={confirmStyles.bodyLine2} />
    <View style={confirmStyles.bodyLine3} />
    <View style={confirmStyles.cancelPill} />
    <View style={confirmStyles.confirmPill} />
  </>
);

function ConfirmScreen({ clock }: { clock: SharedValue<number> }) {
  return (
    <View style={sceneStyles.screen}>
      {CONFIRM_SKELETON}
      <GlassSweep
        clock={clock}
        width={PRO_SCREEN_W}
        height={PRO_SCREEN_H}
        clipStyle={confirmStyles.sweepClip}
      />
    </View>
  );
}

/* ---------------------- enter passphrase ---------------------- *
 * Label, a large entry field with the n/50 counter under it, and a qwerty
 * keyboard with the firmware's bottom row (backspace, 123, space, submit).
 * Choreography: the glass sweep crosses the keyboard corner to corner —
 * the Pro's keyboard has no panel box, so one keyboard-wide band runs
 * under the gap grille (below), leaving the light caught by the caps
 * alone with its edges the keys' own — then six marks land one by one.
 * The marks sit left-aligned in the field, so they land in place, and
 * the counter follows them. */

const KB_KEY_W = 25;
const KB_KEY_H = 38;
const KB_KEY_R = 8;
const KB_PITCH = 27.5;
const KB_ROW_TOPS = [304, 348, 392, 436];
const KB_ROW1_LEFT = 7.75;
const KB_ROW2_LEFT = 21.5;
const KB_ROW3_ABC_W = 38;
const KB_ROW3_LEFT = KB_ROW1_LEFT + KB_ROW3_ABC_W + 4;

/* The band's region: the keyboard's bounding box, gutter-symmetric. */
const KB_REGION_LEFT = KB_ROW1_LEFT;
const KB_REGION_TOP = KB_ROW_TOPS[0];
const KB_REGION_W = PRO_SCREEN_W - 2 * KB_ROW1_LEFT;
const KB_REGION_H = KB_ROW_TOPS[3] + KB_KEY_H - KB_ROW_TOPS[0];

const passStyles = StyleSheet.create({
  field: {
    position: 'absolute',
    left: 12,
    top: 54,
    width: 264,
    height: 164,
    borderRadius: 20,
    backgroundColor: KEY_BG,
  },
  dotsRow: {
    position: 'absolute',
    left: 30,
    top: 80,
    flexDirection: 'row',
    gap: 7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  // The band's clip: the keyboard's bounding box. What shows through is
  // decided by the grille above it, not by this rectangle.
  sweepClip: {
    position: 'absolute',
    left: KB_REGION_LEFT,
    top: KB_REGION_TOP,
    width: KB_REGION_W,
    height: KB_REGION_H,
    overflow: 'hidden',
  },
  grille: {
    position: 'absolute',
    left: KB_REGION_LEFT,
    top: KB_REGION_TOP,
  },
});

const KB_BSP_GLYPH = backspaceGlyph(20, GLYPH, KEY_BG);
const KB_CHECK_GLYPH = checkGlyph(20, GLYPH_LIT);

function KbLetterGlyph({ letter }: { letter: string }) {
  return (
    <SizableText color="#fff" fontSize={14} lineHeight={18} fontWeight="500">
      {letter}
    </SizableText>
  );
}

function KbFnGlyph({ label }: { label: string }) {
  return (
    <SizableText color={GLYPH} fontSize={12} lineHeight={16} fontWeight="500">
      {label}
    </SizableText>
  );
}

interface IKbKeySpec {
  name: string;
  left: number;
  top: number;
  width: number;
  frame: ViewStyle;
  children?: ReactNode;
}

/** A key cap's spec on its row; left/top/width double as its grille hole. */
function kbKey(
  name: string,
  left: number,
  row: number,
  width: number,
  background: string,
  children?: ReactNode,
): IKbKeySpec {
  const top = KB_ROW_TOPS[row];
  return {
    name,
    left,
    top,
    width,
    frame: keyFrame(left, top, width, KB_KEY_H, KB_KEY_R, background),
    children,
  };
}

// Letter rows plus the firmware's bottom rows: ABC on the third row's
// left, then backspace, 123, a wide blank space key, and the green submit.
const KB_KEYS: IKbKeySpec[] = [
  ...'qwertyuiop'
    .split('')
    .map((letter, i) =>
      kbKey(
        letter,
        KB_ROW1_LEFT + i * KB_PITCH,
        0,
        KB_KEY_W,
        KEY_BG,
        <KbLetterGlyph letter={letter} />,
      ),
    ),
  ...'asdfghjkl'
    .split('')
    .map((letter, i) =>
      kbKey(
        letter,
        KB_ROW2_LEFT + i * KB_PITCH,
        1,
        KB_KEY_W,
        KEY_BG,
        <KbLetterGlyph letter={letter} />,
      ),
    ),
  ...'zxcvbnm'
    .split('')
    .map((letter, i) =>
      kbKey(
        letter,
        KB_ROW3_LEFT + i * KB_PITCH,
        2,
        KB_KEY_W,
        KEY_BG,
        <KbLetterGlyph letter={letter} />,
      ),
    ),
  kbKey(
    'abc',
    KB_ROW1_LEFT,
    2,
    KB_ROW3_ABC_W,
    KEY_BG,
    <KbFnGlyph label="ABC" />,
  ),
  kbKey('backspace', KB_ROW1_LEFT, 3, 52, KEY_BG, KB_BSP_GLYPH),
  kbKey('123', 63.75, 3, 40, KEY_BG, <KbFnGlyph label="123" />),
  kbKey('space', 107.75, 3, 112.5, KEY_BG),
  kbKey(
    'submit',
    PRO_SCREEN_W - KB_ROW1_LEFT - 56,
    3,
    56,
    SUBMIT_DISABLED_BG,
    KB_CHECK_GLYPH,
  ),
];

/* The gap grille: the bare screen surface between and around the caps,
 * painted back over the keyboard-wide sweep, so the light exists only on
 * the caps and its edges are the caps' own rounded corners. One static
 * even-odd path — the region rect with a rounded hole per cap — where
 * windowing the band inside every cap cost a carrier-sized CPU-raster
 * gradient bitmap per key at scene mount (a main-thread burst that ate
 * the entry ramp). Opaque panel color over panel color: invisible at
 * every entry opacity. */

function grilleHole({ left, top, width }: IKbKeySpec): string {
  const x = left - KB_REGION_LEFT;
  const y = top - KB_REGION_TOP;
  const r = KB_KEY_R;
  const rightRun = width - 2 * r;
  const downRun = KB_KEY_H - 2 * r;
  return (
    `M${x + r} ${y}h${rightRun}` +
    `a${r} ${r} 0 0 1 ${r} ${r}v${downRun}` +
    `a${r} ${r} 0 0 1 ${-r} ${r}h${-rightRun}` +
    `a${r} ${r} 0 0 1 ${-r} ${-r}v${-downRun}` +
    `a${r} ${r} 0 0 1 ${r} ${-r}Z`
  );
}

const GRILLE_D = `M0 0H${KB_REGION_W}V${KB_REGION_H}H0Z${KB_KEYS.map(
  grilleHole,
).join('')}`;

function grille(surface: string) {
  return (
    <Svg
      pointerEvents="none"
      width={KB_REGION_W}
      height={KB_REGION_H}
      viewBox={`0 0 ${KB_REGION_W} ${KB_REGION_H}`}
      fill="none"
      style={passStyles.grille}
    >
      <Path d={GRILLE_D} fill={surface} fillRule="evenodd" />
    </Svg>
  );
}

const PASS_TITLE = (
  <SizableText
    position="absolute"
    top={18}
    left={12}
    color="#8C8C8C"
    fontSize={22}
    lineHeight={28}
    fontWeight="500"
  >
    Enter Passphrase:
  </SizableText>
);

function PassphraseScreen({
  clock,
  grilleNode,
}: {
  clock: SharedValue<number>;
  grilleNode: ReactNode;
}) {
  return (
    <View style={sceneStyles.screen}>
      {PASS_TITLE}
      <View style={passStyles.field} />
      <View style={passStyles.dotsRow}>
        {PASSPHRASE_DOT_TRACKS.map((track, index) => (
          <TrackedLayer
            key={index}
            clock={clock}
            track={track}
            baseStyle={passStyles.dot}
          />
        ))}
      </View>
      <EntryCounter clock={clock} top={226} />
      {KB_KEYS.map(({ name, frame, children }) => (
        <View key={name} style={frame}>
          {children}
        </View>
      ))}
      <GlassSweep
        clock={clock}
        width={KB_REGION_W}
        height={KB_REGION_H}
        clipStyle={passStyles.sweepClip}
      />
      {grilleNode}
    </View>
  );
}

/* --------------------------- registry --------------------------- */

/**
 * The scene registry — the one table every per-scene trait lives in.
 * Adding a scene is adding one entry; nothing else consults a scene by
 * name. Built per panel color (see the header): a shell calls this once
 * at module scope with the black its screen composites over.
 */
export function createScenes(
  surface: string,
): Record<IProDeviceScene, IDeviceSceneSpec> {
  const grilleNode = grille(surface);
  const PassphraseContent = ({ clock }: IDeviceSceneContentProps) => (
    <PassphraseScreen clock={clock} grilleNode={grilleNode} />
  );
  return {
    connecting: { content: ConnectingContent, defersEntry: true },
    enterPin: { content: PinScreen, loop: PIN_LOOP },
    enterPassphrase: { content: PassphraseContent, loop: PASSPHRASE_LOOP },
    confirm: { content: ConfirmScreen, loop: CONFIRM_LOOP },
  };
}

export const SCENES = createScenes(PRO_SCREEN_BG);
