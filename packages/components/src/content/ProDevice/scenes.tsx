import { useMemo, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Path, Svg } from 'react-native-svg';

import { SizableText, Stack } from '../../primitives';

import {
  CONFIRM_PRO_TAP_TRACK,
  ENTRY_PRO_SUBMIT_ENABLE_TRACK,
  ENTRY_PRO_SUBMIT_TRACK,
  ENTRY_PRO_TAP_TRACKS,
  useConfirmOnProAnimation,
  useEntryOnProAnimation,
  useTapHighlight,
} from './animation';
import { ProDeviceShell } from './shell';

import type { ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

/**
 * Built-in scenes of the Pro device, keyed by the name its `animation` prop
 * takes. Layouts and the tap choreography are transcribed from the Pro
 * Lottie files (confirm / enter-pin / enter-passphrase, dark theme): every
 * interaction is a tap on the touchscreen - the tapped key snaps to the
 * brand green, holds, and fades back while the entry row grows a dot.
 * All tap feedback is opacity cross-fades, never color animation.
 */
export type IProDeviceScene =
  | 'connecting'
  | 'confirm'
  | 'enterPin'
  | 'enterPassphrase';

interface ISceneProps {
  width?: number;
}

/* --------------------------- palette --------------------------- *
 * Key/tap colors from the Lottie keyframes; surface grays and the red
 * PIN backspace from real firmware screenshots. */

const KEY_BG = '#1F1F21';
const KEY_LIT = '#00FF33';
const PRESSED_BG = '#2C2C2C';
const CONFIRM_PRESSED_BG = '#4A4A4A';
const PIN_BSP_BG = '#FF3B30';
const SUBMIT_DISABLED_BG = '#219A39';
const GLYPH = '#EEEEEE';
const GLYPH_LIT = '#202020';

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

const sharedStyles = StyleSheet.create({
  litFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: KEY_LIT,
  },
  pressedFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PRESSED_BG,
  },
  glyphFill: {
    ...StyleSheet.absoluteFillObject,
    ...CENTER,
  },
});

/* ------------------------ key primitives ------------------------ */

/** A key the scene never taps: base fill and an optional glyph. */
function StaticKey({
  frame,
  children,
}: {
  frame: ViewStyle;
  children?: ReactNode;
}) {
  return <View style={frame}>{children}</View>;
}

/**
 * A scripted key: on tap the green fill snaps in above the base and the
 * glyph cross-fades to its lit variant, both driven by one highlight value.
 */
function TapKey({
  frame,
  highlight,
  children,
  litChildren,
}: {
  frame: ViewStyle;
  highlight: Readonly<SharedValue<number>>;
  children: ReactNode;
  litChildren: ReactNode;
}) {
  const litOp = useAnimatedStyle(
    () => ({ opacity: highlight.value }),
    [highlight],
  );
  const baseOp = useAnimatedStyle(
    () => ({ opacity: 1 - highlight.value }),
    [highlight],
  );
  const litFillStyle = useMemo(() => [sharedStyles.litFill, litOp], [litOp]);
  const baseGlyphStyle = useMemo(
    () => [sharedStyles.glyphFill, baseOp],
    [baseOp],
  );
  const litGlyphStyle = useMemo(() => [sharedStyles.glyphFill, litOp], [litOp]);
  return (
    <View style={frame}>
      <Animated.View pointerEvents="none" style={litFillStyle} />
      <Animated.View pointerEvents="none" style={baseGlyphStyle}>
        {children}
      </Animated.View>
      <Animated.View pointerEvents="none" style={litGlyphStyle}>
        {litChildren}
      </Animated.View>
    </View>
  );
}

/**
 * The green submit key of the entry scenes. Disabled (dim green) until the
 * first character, then bright; the final tap swaps it to the pressed fill
 * with a light check, exactly as in the Lottie.
 */
function SubmitKey({
  frame,
  enable,
  press,
  glyph,
  litGlyph,
}: {
  frame: ViewStyle;
  enable: Readonly<SharedValue<number>>;
  press: Readonly<SharedValue<number>>;
  glyph: ReactNode;
  litGlyph: ReactNode;
}) {
  const enableOp = useAnimatedStyle(
    () => ({ opacity: enable.value }),
    [enable],
  );
  const pressOp = useAnimatedStyle(() => ({ opacity: press.value }), [press]);
  const baseOp = useAnimatedStyle(
    () => ({ opacity: 1 - press.value }),
    [press],
  );
  const enabledFillStyle = useMemo(
    () => [sharedStyles.litFill, enableOp],
    [enableOp],
  );
  const pressedFillStyle = useMemo(
    () => [sharedStyles.pressedFill, pressOp],
    [pressOp],
  );
  const baseGlyphStyle = useMemo(
    () => [sharedStyles.glyphFill, baseOp],
    [baseOp],
  );
  const litGlyphStyle = useMemo(
    () => [sharedStyles.glyphFill, pressOp],
    [pressOp],
  );
  return (
    <View style={frame}>
      <Animated.View pointerEvents="none" style={enabledFillStyle} />
      <Animated.View pointerEvents="none" style={pressedFillStyle} />
      <Animated.View pointerEvents="none" style={baseGlyphStyle}>
        {glyph}
      </Animated.View>
      <Animated.View pointerEvents="none" style={litGlyphStyle}>
        {litGlyph}
      </Animated.View>
    </View>
  );
}

/** Entry dots: one filled dot per entered character, none pending. */
function EntryDots({
  entered,
  dotStyle,
  rowStyle,
}: {
  entered: Readonly<SharedValue<number>>;
  dotStyle: ViewStyle;
  rowStyle: ViewStyle;
}) {
  const [count, setCount] = useState(0);
  useAnimatedReaction(
    () => entered.value,
    (value, previous) => {
      if (value !== previous) runOnJS(setCount)(value);
    },
    [entered],
  );
  return (
    <View style={rowStyle}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={dotStyle} />
      ))}
    </View>
  );
}

/** The firmware's n/50 length counter under the passphrase field. */
function EntryCounter({
  entered,
  top,
}: {
  entered: Readonly<SharedValue<number>>;
  top: number;
}) {
  const [count, setCount] = useState(0);
  useAnimatedReaction(
    () => entered.value,
    (value, previous) => {
      if (value !== previous) runOnJS(setCount)(value);
    },
    [entered],
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

/* ------------------------- confirm ------------------------- *
 * Confirmation scenarios are unbounded, so one animation abstracts them
 * all: a bright title bar and a dimmer body bar as skeletons, over the
 * real invariants of every Pro confirm screen - the Cancel / Confirm pill
 * pair (firmware reference). The tap darkens the green pill to the pressed
 * fill and flips its label light, then both ease back. */

const confirmStyles = StyleSheet.create({
  titleBar: {
    position: 'absolute',
    left: 24,
    top: 44,
    width: 180,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#565656',
  },
  bodyBar: {
    position: 'absolute',
    left: 24,
    top: 90,
    width: 120,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#383838',
  },
  cancelPill: keyFrame(10.5, 414, 127, 60, 30, PRESSED_BG),
  confirmPill: keyFrame(150.5, 414, 127, 60, 30, KEY_LIT),
  confirmPressed: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CONFIRM_PRESSED_BG,
  },
});

function ConfirmPillLabel({ lit }: { lit?: boolean }) {
  return (
    <SizableText
      color={lit ? GLYPH : GLYPH_LIT}
      fontSize={18}
      lineHeight={24}
      fontWeight="600"
    >
      Confirm
    </SizableText>
  );
}

function ConfirmProScreen({ tap }: { tap: Readonly<SharedValue<number>> }) {
  const pressOp = useAnimatedStyle(() => ({ opacity: tap.value }), [tap]);
  const idleOp = useAnimatedStyle(() => ({ opacity: 1 - tap.value }), [tap]);
  const pressedFillStyle = useMemo(
    () => [confirmStyles.confirmPressed, pressOp],
    [pressOp],
  );
  const idleLabelStyle = useMemo(
    () => [sharedStyles.glyphFill, idleOp],
    [idleOp],
  );
  const litLabelStyle = useMemo(
    () => [sharedStyles.glyphFill, pressOp],
    [pressOp],
  );
  return (
    <Stack flex={1}>
      <View style={confirmStyles.titleBar} />
      <View style={confirmStyles.bodyBar} />
      <View style={confirmStyles.cancelPill}>
        <SizableText
          color={GLYPH}
          fontSize={18}
          lineHeight={24}
          fontWeight="600"
        >
          Cancel
        </SizableText>
      </View>
      <View style={confirmStyles.confirmPill}>
        <Animated.View pointerEvents="none" style={pressedFillStyle} />
        <Animated.View pointerEvents="none" style={idleLabelStyle}>
          <ConfirmPillLabel />
        </Animated.View>
        <Animated.View pointerEvents="none" style={litLabelStyle}>
          <ConfirmPillLabel lit />
        </Animated.View>
      </View>
    </Stack>
  );
}

function ConfirmScene({ width }: ISceneProps) {
  const { animation, clock } = useConfirmOnProAnimation();
  const tap = useTapHighlight(clock, CONFIRM_PRO_TAP_TRACK);
  const screenContent = useMemo(() => <ConfirmProScreen tap={tap} />, [tap]);
  return (
    <ProDeviceShell
      width={width}
      animation={animation}
      screenContent={screenContent}
    />
  );
}

/* ------------------------- enter PIN ------------------------- *
 * Numeric pad, near edge-to-edge and bottom-flush like the firmware. The
 * scene types 1-2-4-5-7-8 (the Lottie's sequence) and confirms with the
 * green key; the backspace key is the firmware's red. */

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
});

interface IPinKeySpec {
  digit: string;
  frame: ViewStyle;
  /** Index into ENTRY_PRO_TAP_TRACKS when the scene taps this key. */
  track?: number;
}

const PIN_TAP_ORDER: Record<string, number> = {
  '1': 0,
  '2': 1,
  '4': 2,
  '5': 3,
  '7': 4,
  '8': 5,
};

const PIN_DIGIT_KEYS: IPinKeySpec[] = [
  ...Array.from({ length: 9 }, (_, i) => String(i + 1)),
  '0',
].map((digit) => {
  const i = digit === '0' ? 10 : Number(digit) - 1;
  return {
    digit,
    frame: keyFrame(
      PIN_COLS[i % 3],
      PIN_ROWS[Math.floor(i / 3)],
      PIN_KEY_W,
      PIN_KEY_H,
      PIN_KEY_R,
      KEY_BG,
    ),
    track: PIN_TAP_ORDER[digit],
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
const PIN_CHECK_DARK = checkGlyph(28, GLYPH_LIT);
const PIN_CHECK_LIGHT = checkGlyph(28, GLYPH);

function PinDigitGlyph({ digit, lit }: { digit: string; lit?: boolean }) {
  return (
    <SizableText
      color={lit ? GLYPH_LIT : GLYPH}
      fontSize={32}
      lineHeight={40}
      fontWeight="500"
    >
      {digit}
    </SizableText>
  );
}

// Split from the static path so untapped keys carry no per-frame work.
function TapDigitKey({
  spec,
  track,
  clock,
}: {
  spec: IPinKeySpec;
  track: number;
  clock: SharedValue<number>;
}) {
  const highlight = useTapHighlight(clock, ENTRY_PRO_TAP_TRACKS[track]);
  const litGlyph = useMemo(
    () => <PinDigitGlyph digit={spec.digit} lit />,
    [spec.digit],
  );
  return (
    <TapKey frame={spec.frame} highlight={highlight} litChildren={litGlyph}>
      <PinDigitGlyph digit={spec.digit} />
    </TapKey>
  );
}

function PinKey({
  spec,
  clock,
}: {
  spec: IPinKeySpec;
  clock: SharedValue<number>;
}) {
  if (spec.track === undefined) {
    return (
      <StaticKey frame={spec.frame}>
        <PinDigitGlyph digit={spec.digit} />
      </StaticKey>
    );
  }
  return <TapDigitKey spec={spec} track={spec.track} clock={clock} />;
}

function PinScreen({
  clock,
  entered,
}: {
  clock: SharedValue<number>;
  entered: Readonly<SharedValue<number>>;
}) {
  const submitEnable = useTapHighlight(clock, ENTRY_PRO_SUBMIT_ENABLE_TRACK);
  const submitPress = useTapHighlight(clock, ENTRY_PRO_SUBMIT_TRACK);
  return (
    <Stack flex={1}>
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
      <EntryDots
        entered={entered}
        rowStyle={pinStyles.dotsRow}
        dotStyle={pinStyles.dot}
      />
      {PIN_DIGIT_KEYS.map((spec) => (
        <PinKey key={spec.digit} spec={spec} clock={clock} />
      ))}
      <StaticKey frame={PIN_BSP_FRAME}>{PIN_BSP_GLYPH}</StaticKey>
      <SubmitKey
        frame={PIN_SUBMIT_FRAME}
        enable={submitEnable}
        press={submitPress}
        glyph={PIN_CHECK_DARK}
        litGlyph={PIN_CHECK_LIGHT}
      />
    </Stack>
  );
}

function EnterPinScene({ width }: ISceneProps) {
  const { animation, clock, entered } = useEntryOnProAnimation();
  const screenContent = useMemo(
    () => <PinScreen clock={clock} entered={entered} />,
    [clock, entered],
  );
  return (
    <ProDeviceShell
      width={width}
      animation={animation}
      screenContent={screenContent}
    />
  );
}

/* ---------------------- enter passphrase ---------------------- *
 * Label, a large entry field with the n/50 counter under it, and a qwerty
 * keyboard with the firmware's bottom row (backspace, 123, space, submit).
 * The scene types g-a-i-e-t-y (the Lottie's word) and confirms with the
 * green key. */

const KB_KEY_W = 25;
const KB_KEY_H = 38;
const KB_KEY_R = 8;
const KB_PITCH = 27.5;
const KB_ROW_TOPS = [304, 348, 392, 436];
const KB_ROW1_LEFT = 7.75;
const KB_ROW2_LEFT = 21.5;
const KB_ROW3_ABC_W = 38;
const KB_ROW3_LEFT = KB_ROW1_LEFT + KB_ROW3_ABC_W + 4;

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
});

interface IKbKeySpec {
  letter: string;
  frame: ViewStyle;
  track?: number;
}

const KB_TAP_ORDER: Record<string, number> = {
  g: 0,
  a: 1,
  i: 2,
  e: 3,
  t: 4,
  y: 5,
};

const KB_LETTER_KEYS: IKbKeySpec[] = [
  ...'qwertyuiop'.split('').map((letter, i) => ({
    letter,
    frame: keyFrame(
      KB_ROW1_LEFT + i * KB_PITCH,
      KB_ROW_TOPS[0],
      KB_KEY_W,
      KB_KEY_H,
      KB_KEY_R,
      KEY_BG,
    ),
    track: KB_TAP_ORDER[letter],
  })),
  ...'asdfghjkl'.split('').map((letter, i) => ({
    letter,
    frame: keyFrame(
      KB_ROW2_LEFT + i * KB_PITCH,
      KB_ROW_TOPS[1],
      KB_KEY_W,
      KB_KEY_H,
      KB_KEY_R,
      KEY_BG,
    ),
    track: KB_TAP_ORDER[letter],
  })),
  ...'zxcvbnm'.split('').map((letter, i) => ({
    letter,
    frame: keyFrame(
      KB_ROW3_LEFT + i * KB_PITCH,
      KB_ROW_TOPS[2],
      KB_KEY_W,
      KB_KEY_H,
      KB_KEY_R,
      KEY_BG,
    ),
    track: KB_TAP_ORDER[letter],
  })),
];

const KB_ABC_FRAME = keyFrame(
  KB_ROW1_LEFT,
  KB_ROW_TOPS[2],
  KB_ROW3_ABC_W,
  KB_KEY_H,
  KB_KEY_R,
  KEY_BG,
);
// Bottom row, firmware proportions: backspace, 123, a wide blank space
// key, and the green submit on the right.
const KB_BSP_FRAME = keyFrame(
  KB_ROW1_LEFT,
  KB_ROW_TOPS[3],
  52,
  KB_KEY_H,
  KB_KEY_R,
  KEY_BG,
);
const KB_123_FRAME = keyFrame(
  63.75,
  KB_ROW_TOPS[3],
  40,
  KB_KEY_H,
  KB_KEY_R,
  KEY_BG,
);
const KB_SPACE_FRAME = keyFrame(
  107.75,
  KB_ROW_TOPS[3],
  112.5,
  KB_KEY_H,
  KB_KEY_R,
  KEY_BG,
);
const KB_SUBMIT_FRAME = keyFrame(
  288 - KB_ROW1_LEFT - 56,
  KB_ROW_TOPS[3],
  56,
  KB_KEY_H,
  KB_KEY_R,
  SUBMIT_DISABLED_BG,
);

const KB_BSP_GLYPH = backspaceGlyph(20, GLYPH, KEY_BG);
const KB_CHECK_DARK = checkGlyph(20, GLYPH_LIT);
const KB_CHECK_LIGHT = checkGlyph(20, GLYPH);

function KbLetterGlyph({ letter, lit }: { letter: string; lit?: boolean }) {
  return (
    <SizableText
      color={lit ? '#000' : '#fff'}
      fontSize={14}
      lineHeight={18}
      fontWeight="500"
    >
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

// Split from the static path so untapped keys carry no per-frame work.
function TapLetterKey({
  spec,
  track,
  clock,
}: {
  spec: IKbKeySpec;
  track: number;
  clock: SharedValue<number>;
}) {
  const highlight = useTapHighlight(clock, ENTRY_PRO_TAP_TRACKS[track]);
  const litGlyph = useMemo(
    () => <KbLetterGlyph letter={spec.letter} lit />,
    [spec.letter],
  );
  return (
    <TapKey frame={spec.frame} highlight={highlight} litChildren={litGlyph}>
      <KbLetterGlyph letter={spec.letter} />
    </TapKey>
  );
}

function KbKey({
  spec,
  clock,
}: {
  spec: IKbKeySpec;
  clock: SharedValue<number>;
}) {
  if (spec.track === undefined) {
    return (
      <StaticKey frame={spec.frame}>
        <KbLetterGlyph letter={spec.letter} />
      </StaticKey>
    );
  }
  return <TapLetterKey spec={spec} track={spec.track} clock={clock} />;
}

function PassphraseScreen({
  clock,
  entered,
}: {
  clock: SharedValue<number>;
  entered: Readonly<SharedValue<number>>;
}) {
  const submitEnable = useTapHighlight(clock, ENTRY_PRO_SUBMIT_ENABLE_TRACK);
  const submitPress = useTapHighlight(clock, ENTRY_PRO_SUBMIT_TRACK);
  return (
    <Stack flex={1}>
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
      <View style={passStyles.field} />
      <EntryDots
        entered={entered}
        rowStyle={passStyles.dotsRow}
        dotStyle={passStyles.dot}
      />
      <EntryCounter entered={entered} top={226} />
      {KB_LETTER_KEYS.map((spec) => (
        <KbKey key={spec.letter} spec={spec} clock={clock} />
      ))}
      <StaticKey frame={KB_ABC_FRAME}>
        <KbFnGlyph label="ABC" />
      </StaticKey>
      <StaticKey frame={KB_BSP_FRAME}>{KB_BSP_GLYPH}</StaticKey>
      <StaticKey frame={KB_123_FRAME}>
        <KbFnGlyph label="123" />
      </StaticKey>
      <StaticKey frame={KB_SPACE_FRAME} />
      <SubmitKey
        frame={KB_SUBMIT_FRAME}
        enable={submitEnable}
        press={submitPress}
        glyph={KB_CHECK_DARK}
        litGlyph={KB_CHECK_LIGHT}
      />
    </Stack>
  );
}

function EnterPassphraseScene({ width }: ISceneProps) {
  const { animation, clock, entered } = useEntryOnProAnimation();
  const screenContent = useMemo(
    () => <PassphraseScreen clock={clock} entered={entered} />,
    [clock, entered],
  );
  return (
    <ProDeviceShell
      width={width}
      animation={animation}
      screenContent={screenContent}
    />
  );
}

/* ------------------------- connecting ------------------------- *
 * While the app is reaching for the device the physical screen shows
 * nothing, so the scene is the still shell with the panel dark. */

function ConnectingScene({ width }: ISceneProps) {
  return <ProDeviceShell width={width} />;
}

export const SCENES: Record<IProDeviceScene, ComponentType<ISceneProps>> = {
  connecting: ConnectingScene,
  confirm: ConfirmScene,
  enterPin: EnterPinScene,
  enterPassphrase: EnterPassphraseScene,
};
