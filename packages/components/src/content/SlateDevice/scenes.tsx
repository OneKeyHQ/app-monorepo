import type { ComponentType } from 'react';
import { useMemo } from 'react';

import { Image, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Path, Svg } from 'react-native-svg';

import { SizableText } from '../../primitives';
import { trackAt } from '../deviceScene';
import { LinearGradient } from '../LinearGradient';

import {
  CONFIRM_SWEEP_TRACK,
  PIN_DOT_TRACKS,
  PIN_SHEEN_TRACKS,
  useConfirmOnSlateAnimation,
  useEnterPinOnSlateAnimation,
  useSlateScreenAnimation,
} from './animation';
import { SLATE_SCREEN_H, SLATE_SCREEN_W, SlateDeviceShell } from './shell';

import type { IKeyframe } from '../deviceScene';
import type { ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

/**
 * Built-in scenes of the Slate device, keyed by the name its `animation`
 * prop takes. enterPin and confirm are stills transcribed 1:1 from their
 * Figma frames (enterPin 20553:1290 authored at 480x813, scaled x0.6;
 * confirm 20553:1265 authored on the 934x1582 screen raster, scaled
 * x288/934 — both land on the same 288x484 canvas grid); connecting shows
 * the wallpaper the device idles on. SlateDevice renders a scene's content
 * onto the black glass as it settles and fades it off before handing over
 * (the resident opacity every scene receives), and no scene ever sleeps.
 * Once lit, connecting holds the wallpaper while enterPin
 * and confirm loop their light choreography: the keypad sheen with the
 * entry dots landing, and the one light crossing the whole confirm
 * screen.
 */
export type ISlateDeviceScene =
  | 'connecting'
  | 'enterPin'
  | 'enterPassphrase'
  | 'confirm';

/**
 * Which scenes put content on the glass. SlateDevice consults the scene
 * being replaced to decide whether there is anything to fade off before
 * the next one takes over.
 */
export const SCENE_LIT: Record<ISlateDeviceScene, boolean> = {
  connecting: true,
  enterPin: true,
  enterPassphrase: false,
  confirm: true,
};

/**
 * Scenes whose pixels are not on screen when their layout is. An image's
 * are fetched and decoded asynchronously, well after the layout event, so
 * such a scene reports readiness itself (`onReady`) and SlateDevice holds
 * its entrance until then; otherwise the ramp plays over an empty view and
 * the picture lands on it already bright.
 */
export const SCENE_DEFERS_ENTRY: Record<ISlateDeviceScene, boolean> = {
  connecting: true,
  enterPin: false,
  enterPassphrase: false,
  confirm: false,
};

interface ISceneProps {
  width?: number;
  /** Resident opacity of the scene's screen content, driven by SlateDevice. */
  screenIn: Readonly<SharedValue<number>>;
  /** Call when the scene's pixels are on the glass; see SCENE_DEFERS_ENTRY. */
  onReady: () => void;
}

/* --------------------------- palette --------------------------- *
 * The screens' design tokens over the shell's own black: labels/primary
 * white, keyboard/primary gray. Skeleton fills are white at the file's two
 * opacities, baked into rgba so nothing compounds. */

const LABEL = '#FFFFFF';
const KEY_BG = '#4B4B4C';
const FILL_STRONG = 'rgba(255,255,255,0.7)';
const FILL_FAINT = 'rgba(255,255,255,0.2)';
/** The traveling light's peak brightness, shared by every sheen layer. */
const SHEEN_COLOR = 'rgba(255,255,255,0.22)';

const CENTER: ViewStyle = { alignItems: 'center', justifyContent: 'center' };

function blockFrame(
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
    ...CENTER,
  };
}

const sceneStyles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  wallpaper: {
    width: SLATE_SCREEN_W,
    height: SLATE_SCREEN_H,
  },
});

/* ------------------------- connecting ------------------------- *
 * The wallpaper the physical device idles on while the app reaches for it
 * (an exact 288x484 render, laid flat with no cropping). */

const WALLPAPER_SOURCE = require('./screen-connecting.png');

/* ------------------------- enter PIN ------------------------- *
 * Title and four entered marks up top, a 4x3 numeric pad flush to the
 * bottom band, and the side scroll hint hugging the right edge where the
 * power button sits. The file sets the entered marks as text bullets;
 * four discs at the glyph's rendered size draw the same without a font
 * dependence. Choreography (schedule in ./animation.ts): a sheen sweeps
 * the keypad corner to corner, then the dots land one by one — progress
 * without ever performing a PIN. */

const PIN_KEY_W = 86.4;
const PIN_KEY_H = 66;
const PIN_KEY_R = 28.8;
const PIN_COLS = [7.2, 100.8, 194.4];
const PIN_ROWS = [195, 268.2, 341.4, 414.6];

const pinStyles = StyleSheet.create({
  dotsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 81,
    height: 32.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7.5,
  },
  dot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 2.75,
    backgroundColor: LABEL,
  },
  // The traveling sheen's slice on one key cap: peak brightness lives in
  // the fill, position in each key's stagger. It reads as nothing on the
  // white enter cap, where the wave melts into the brightest key.
  keySheen: {
    ...StyleSheet.absoluteFill,
    borderRadius: PIN_KEY_R,
    backgroundColor: SHEEN_COLOR,
  },
  scrollHint: {
    position: 'absolute',
    right: 0,
    top: 84,
    width: 4.8,
    height: 57.6,
    borderTopLeftRadius: 3.6,
    borderBottomLeftRadius: 3.6,
    backgroundColor: 'rgba(255,255,255,0.6)',
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
    frame: blockFrame(
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

const PIN_CROSS_FRAME = blockFrame(
  PIN_COLS[0],
  PIN_ROWS[3],
  PIN_KEY_W,
  PIN_KEY_H,
  PIN_KEY_R,
  KEY_BG,
);
const PIN_ENTER_FRAME = blockFrame(
  PIN_COLS[2],
  PIN_ROWS[3],
  PIN_KEY_W,
  PIN_KEY_H,
  PIN_KEY_R,
  LABEL,
);

// Exact key glyphs from the Figma screen, stroke outlines pre-baked into
// fills. Both are authored in screen-raster units; the sizes are those
// boxes on the canvas grid (62.266 -> 19.2 square, 77.834x70.05 -> 24x21.6).
const CROSS_D =
  'M55.6232 1.13984C57.143 -0.379948 59.6064 -0.379948 61.1262 1.13984C' +
  '62.646 2.65963 62.646 5.12311 61.1262 6.6429L36.6361 31.133L61.1262 ' +
  '55.6232C62.646 57.143 62.646 59.6064 61.1262 61.1262C59.6064 62.646 ' +
  '57.143 62.646 55.6232 61.1262L31.133 36.6361L6.6429 61.1262C5.12311 ' +
  '62.646 2.65963 62.646 1.13984 61.1262C-0.379948 59.6064 -0.379948 ' +
  '57.143 1.13984 55.6232L25.63 31.133L1.13984 6.6429C-0.379948 5.12311 ' +
  '-0.379948 2.65963 1.13984 1.13984C2.65963 -0.379948 5.12311 -0.379948 ' +
  '6.6429 1.13984L31.133 25.63L55.6232 1.13984Z';
const CHECK_D =
  'M76.2397 0.751105C77.9743 2.02019 78.3517 4.45519 77.0826 6.18982L' +
  '31.5273 68.4565C30.902 69.3111 29.9555 69.874 28.9061 70.0154C27.8566 ' +
  '70.1568 26.7949 69.8645 25.9658 69.2058L1.47115 49.7475C-0.211774 ' +
  '48.4106 -0.49228 45.9625 0.84462 44.2796C2.18152 42.5967 4.62957 ' +
  '42.3162 6.31249 43.6531L27.6365 60.5927L70.801 1.59405C72.0701 ' +
  '-0.140583 74.5051 -0.517982 76.2397 0.751105Z';

const CROSS_GLYPH = (
  <Svg width={19.2} height={19.2} viewBox="0 0 62.2661 62.2661" fill="none">
    <Path d={CROSS_D} fill={LABEL} />
  </Svg>
);
const CHECK_GLYPH = (
  <Svg width={24} height={21.6} viewBox="0 0 77.8337 70.0503" fill="none">
    <Path fillRule="evenodd" clipRule="evenodd" d={CHECK_D} fill="#000" />
  </Svg>
);

function PinDigitGlyph({ digit }: { digit: string }) {
  return (
    <SizableText
      color={LABEL}
      fontSize={28.8}
      lineHeight={32.4}
      letterSpacing={-1.2}
      fontWeight="600"
    >
      {digit}
    </SizableText>
  );
}

const PIN_TITLE = (
  <SizableText
    position="absolute"
    top={30}
    left={0}
    right={0}
    textAlign="center"
    color={LABEL}
    fontSize={24}
    lineHeight={32.4}
    letterSpacing={-1.2}
    fontWeight="600"
  >
    Enter PIN
  </SizableText>
);

/**
 * A layer whose opacity follows one keyframe track of the scene clock —
 * both of this screen's animated parts, a key's slice of the traveling
 * sheen and an entry dot, are exactly that.
 */
function TrackedLayer({
  clock,
  track,
  baseStyle,
}: {
  clock: SharedValue<number>;
  track: IKeyframe[];
  baseStyle: ViewStyle;
}) {
  const animatedStyle = useAnimatedStyle(
    () => ({ opacity: trackAt(clock.value, track) }),
    [clock, track],
  );
  const style = useMemo(
    () => [baseStyle, animatedStyle],
    [animatedStyle, baseStyle],
  );
  return <Animated.View pointerEvents="none" style={style} />;
}

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
      <View style={PIN_CROSS_FRAME}>
        {CROSS_GLYPH}
        <TrackedLayer
          clock={clock}
          track={PIN_SHEEN_TRACKS[3]}
          baseStyle={pinStyles.keySheen}
        />
      </View>
      <View style={PIN_ENTER_FRAME}>
        {CHECK_GLYPH}
        <TrackedLayer
          clock={clock}
          track={PIN_SHEEN_TRACKS[5]}
          baseStyle={pinStyles.keySheen}
        />
      </View>
      <View style={pinStyles.scrollHint} />
    </View>
  );
}

/* ------------------------- confirm ------------------------- *
 * Confirmation scenarios are unbounded, so the design abstracts to
 * skeleton structure: a two-line title block, three body lines, and the
 * Cancel / Confirm pill pair on the bottom band, labels left to the real
 * firmware. Choreography (schedule in ./animation.ts): one gradient light
 * crossing the glass corner to corner, above the still — the light lives
 * on the screen, not on its elements. */

const confirmStyles = StyleSheet.create({
  titleLine1: blockFrame(14.4, 50.4, 153, 13.8, 6.9, FILL_STRONG),
  titleLine2: blockFrame(14.4, 80.9, 94.2, 13.8, 6.9, FILL_STRONG),
  bodyLine1: blockFrame(14.4, 128.1, 259.2, 9.6, 4.8, FILL_FAINT),
  bodyLine2: blockFrame(14.4, 154.4, 259.2, 9.6, 4.8, FILL_FAINT),
  bodyLine3: blockFrame(14.4, 180.7, 126.6, 9.6, 4.8, FILL_FAINT),
  cancelPill: blockFrame(14.4, 414.6, 121.25, 58.8, 28.8, FILL_FAINT),
  confirmPill: blockFrame(152.35, 414.6, 121.25, 58.8, 28.8, FILL_STRONG),
  sweepClip: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  // The band's carrier: the screen scaled 3x and centered, so the gradient
  // axis stays parallel to the glass diagonal while the carrier's edges —
  // where a diagonal band tapers toward the rectangle's corners — never
  // enter the screen mid-crossing. A screen-sized carrier clips the band
  // visibly on its way in and out.
  sweepBand: {
    position: 'absolute',
    left: -SLATE_SCREEN_W,
    top: -SLATE_SCREEN_H,
    width: SLATE_SCREEN_W * 3,
    height: SLATE_SCREEN_H * 3,
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

// The gradient wrapper runs style through Tamagui's usePropsAndStyle, which
// expects a plain object (same note as the Classic shell).
const SWEEP_GRADIENT_FILL = { flex: 1 };
// Gradient axis pinned corner to corner; white-transparent ends so nothing
// darkens through the fade. The center tenth of the 3x carrier is the same
// ~30% of the glass diagonal the band always spanned.
const SWEEP_START = { x: 0, y: 0 } as const;
const SWEEP_END = { x: 1, y: 1 } as const;
const SWEEP_COLORS = [
  'rgba(255,255,255,0)',
  SHEEN_COLOR,
  'rgba(255,255,255,0)',
];
const SWEEP_LOCATIONS = [0.45, 0.5, 0.55] as const;
/** Carrier shift each way, in screen sizes: parks the band past a corner. */
const SWEEP_TRAVEL_FACTOR = 0.75;

/** The light itself: a screen-sized band translated along the diagonal. */
function ConfirmSweep({ clock }: { clock: SharedValue<number> }) {
  const animatedStyle = useAnimatedStyle(() => {
    const shift =
      (trackAt(clock.value, CONFIRM_SWEEP_TRACK) * 2 - 1) * SWEEP_TRAVEL_FACTOR;
    return {
      transform: [
        { translateX: shift * SLATE_SCREEN_W },
        { translateY: shift * SLATE_SCREEN_H },
      ],
    };
  }, [clock]);
  const style = useMemo(
    () => [confirmStyles.sweepBand, animatedStyle],
    [animatedStyle],
  );
  return (
    <View pointerEvents="none" style={confirmStyles.sweepClip}>
      <Animated.View style={style}>
        <LinearGradient
          colors={SWEEP_COLORS}
          locations={SWEEP_LOCATIONS}
          start={SWEEP_START}
          end={SWEEP_END}
          style={SWEEP_GRADIENT_FILL}
        />
      </Animated.View>
    </View>
  );
}

function ConfirmScreen({ clock }: { clock: SharedValue<number> }) {
  return (
    <View style={sceneStyles.screen}>
      {CONFIRM_SKELETON}
      <ConfirmSweep clock={clock} />
    </View>
  );
}

/* --------------------------- scenes --------------------------- */

function ConnectingScene({ width, screenIn, onReady }: ISceneProps) {
  const { animation } = useSlateScreenAnimation(screenIn);
  // Referentially stable: the shell memoizes its body on screenContent.
  const screen = useMemo(
    () => (
      <Image
        source={WALLPAPER_SOURCE}
        style={sceneStyles.wallpaper}
        fadeDuration={0}
        onLoad={onReady}
      />
    ),
    [onReady],
  );
  return (
    <SlateDeviceShell
      width={width}
      animation={animation}
      screenContent={screen}
    />
  );
}

function EnterPinScene({ width, screenIn }: ISceneProps) {
  const { animation, clock } = useEnterPinOnSlateAnimation(screenIn);
  // Referentially stable: the shell memoizes its body on screenContent.
  const screen = useMemo(() => <PinScreen clock={clock} />, [clock]);
  return (
    <SlateDeviceShell
      width={width}
      animation={animation}
      screenContent={screen}
    />
  );
}

/** No design yet: the passphrase step holds the dark glass. */
function EnterPassphraseScene({ width }: ISceneProps) {
  return <SlateDeviceShell width={width} />;
}

function ConfirmScene({ width, screenIn }: ISceneProps) {
  const { animation, clock } = useConfirmOnSlateAnimation(screenIn);
  // Referentially stable: the shell memoizes its body on screenContent.
  const screen = useMemo(() => <ConfirmScreen clock={clock} />, [clock]);
  return (
    <SlateDeviceShell
      width={width}
      animation={animation}
      screenContent={screen}
    />
  );
}

export const SCENES: Record<ISlateDeviceScene, ComponentType<ISceneProps>> = {
  connecting: ConnectingScene,
  enterPin: EnterPinScene,
  enterPassphrase: EnterPassphraseScene,
  confirm: ConfirmScene,
};
