import type { ComponentType, ReactNode } from 'react';
import { useMemo } from 'react';

import { Image, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Path, Svg } from 'react-native-svg';

import { SizableText } from '../../primitives';
import { trackAt } from '../deviceScene';
import { LinearGradient } from '../LinearGradient';

import {
  CONFIRM_LOOP,
  GLASS_SWEEP_TRACK,
  PASSPHRASE_DOT_SHIFT_TRACKS,
  PASSPHRASE_DOT_TRACKS,
  PASSPHRASE_LOOP,
  PIN_DOT_SHIFT_TRACKS,
  PIN_DOT_TRACKS,
  PIN_LOOP,
  PIN_SHEEN_TRACKS,
} from './animation';
import { SLATE_SCREEN_H, SLATE_SCREEN_W } from './shell';

import type { IKeyframe } from '../deviceScene';
import type { ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

/**
 * Built-in scenes of the Slate device, keyed by the name its `animation`
 * prop takes. enterPin, enterPassphrase and confirm are stills transcribed
 * 1:1 from their Figma frames (enterPin 20553:1290 and enterPassphrase
 * 35429:1320 authored at 480x813, scaled x0.6; confirm 20553:1265 authored
 * on the 934x1582 screen raster, scaled x288/934 — all land on the same
 * 288x484 canvas grid); connecting shows the wallpaper the device idles
 * on. Once lit, connecting holds the wallpaper while the other scenes loop
 * their light choreography: the keypad sheen and the panel sweep with the
 * entered marks landing, and the one light crossing the whole confirm
 * screen.
 *
 * A scene is nothing but screen content plus the SCENES registry entry
 * declaring how SlateDevice runs it; entrances, exits and the clock are
 * the device's shared machinery, so no scene carries transition code.
 */
export type ISlateDeviceScene =
  | 'connecting'
  | 'enterPin'
  | 'enterPassphrase'
  | 'confirm';

/** What a scene's content component receives. */
export interface ISlateSceneContentProps {
  /** Scene clock for looping choreography, held at 0 through the entry. */
  clock: SharedValue<number>;
  /** Report the pixels on the glass; only `defersEntry` scenes need to. */
  onReady: () => void;
}

interface ISlateSceneSpec {
  /**
   * Screen content on the 288x484 canvas, or null for a scene the
   * physical device spends with a dark screen: the glass just stays
   * dark, and a swap treats the scene as having nothing to fade.
   */
  content: ComponentType<ISlateSceneContentProps> | null;
  /**
   * The content's pixels land later than its layout (an image is decoded
   * asynchronously, well after the layout event), so the entrance must
   * additionally wait for the content's own `onReady` — otherwise the
   * ramp plays over an empty view and the picture lands already bright.
   */
  defersEntry?: true;
  /** Looping choreography, evaluated on the scene clock after the entry. */
  loop?: { loopMs: number; restMs: number };
}

/* --------------------------- palette --------------------------- *
 * The screens' design tokens over the shell's own black: labels/primary
 * white, keyboard/primary gray. Skeleton fills are white at the file's two
 * opacities, baked into rgba so nothing compounds. */

const LABEL = '#FFFFFF';
const KEY_BG = '#4B4B4C';
/** Letter caps and the space bar of the ASCII keyboard. */
const LETTER_BG = '#6F6F70';
/** The ASCII keyboard panel's material and hairline. */
const PANEL_BG = '#2C2C2E';
const PANEL_BORDER = 'rgba(60,60,67,0.29)';
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

/* ---------------------- shared entry furniture ---------------------- *
 * The title and the entered-marks row are the same design components on
 * both keyboard screens (enterPin and enterPassphrase), placed at the
 * same spots. The file sets the marks as text bullets; discs at the
 * glyph's rendered size draw the same without a font dependence. */

const entryStyles = StyleSheet.create({
  marksRow: {
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
  mark: {
    width: 5.5,
    height: 5.5,
    borderRadius: 2.75,
    backgroundColor: LABEL,
  },
});

/** The screens' shared title treatment (the Page Lead line). */
function screenTitle(text: string) {
  return (
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
      {text}
    </SizableText>
  );
}

/* ------------------------- connecting ------------------------- *
 * The wallpaper the physical device idles on while the app reaches for it
 * (an exact 288x484 render, laid flat with no cropping). */

/**
 * Decoded-size budget for this asset: iOS only keeps decoded bitmaps of
 * up to 2 MiB in its image cache (RCTImageCache), i.e. width x height must
 * stay under 524,288 px at 4 bytes per pixel. Past that every entrance
 * re-decodes the file and the pixels land mid-ramp. Current export is
 * 540x908 (~1.87 MiB) - keep any replacement under the line.
 */
const WALLPAPER_SOURCE = require('./screen-connecting.png');

/* ------------------------- enter PIN ------------------------- *
 * Title and four entered marks up top, a 4x3 numeric pad flush to the
 * bottom band, and the side scroll hint hugging the right edge where the
 * power button sits. Choreography (schedule in ./animation.ts): a sheen
 * sweeps the keypad corner to corner, then the marks land one by one —
 * progress without ever performing a PIN. */

const PIN_KEY_W = 86.4;
const PIN_KEY_H = 66;
const PIN_KEY_R = 28.8;
const PIN_COLS = [7.2, 100.8, 194.4];
const PIN_ROWS = [195, 268.2, 341.4, 414.6];

const pinStyles = StyleSheet.create({
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

const PIN_TITLE = screenTitle('Enter PIN');

/**
 * A layer following keyframe tracks of the scene clock: opacity always,
 * and with `shiftTrack` a horizontal slide too. Every animated part of
 * the entry screens — a key's slice of the traveling sheen, an entered
 * mark riding its cluster — is exactly that.
 */
function TrackedLayer({
  clock,
  track,
  shiftTrack,
  baseStyle,
}: {
  clock: SharedValue<number>;
  track: IKeyframe[];
  shiftTrack?: IKeyframe[];
  baseStyle: ViewStyle;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const opacity = trackAt(clock.value, track);
    if (!shiftTrack) {
      return { opacity };
    }
    return {
      opacity,
      transform: [{ translateX: trackAt(clock.value, shiftTrack) }],
    };
  }, [clock, track, shiftTrack]);
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
      <View style={entryStyles.marksRow}>
        {PIN_DOT_TRACKS.map((track, index) => (
          <TrackedLayer
            key={index}
            clock={clock}
            track={track}
            shiftTrack={PIN_DOT_SHIFT_TRACKS[index]}
            baseStyle={entryStyles.mark}
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

/**
 * The traveling glass light over a `width` x `height` region, inside
 * `clipStyle` (the region's own box, overflow hidden): a region-sized
 * band translated along the diagonal. The band's carrier is the region
 * scaled 3x and centered, so the gradient axis stays parallel to the
 * region's diagonal while the carrier's edges — where a diagonal band
 * tapers toward the rectangle's corners — never enter it mid-crossing.
 * Confirm plays it across the whole screen; enterPassphrase inside the
 * keyboard panel.
 */
function GlassSweep({
  clock,
  width,
  height,
  clipStyle,
}: {
  clock: SharedValue<number>;
  width: number;
  height: number;
  clipStyle: ViewStyle;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const shift =
      (trackAt(clock.value, GLASS_SWEEP_TRACK) * 2 - 1) * SWEEP_TRAVEL_FACTOR;
    return {
      transform: [
        { translateX: shift * width },
        { translateY: shift * height },
      ],
    };
  }, [clock, height, width]);
  const style = useMemo(
    () => [
      {
        position: 'absolute' as const,
        left: -width,
        top: -height,
        width: width * 3,
        height: height * 3,
      },
      animatedStyle,
    ],
    [animatedStyle, height, width],
  );
  return (
    <View pointerEvents="none" style={clipStyle}>
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
      <GlassSweep
        clock={clock}
        width={SLATE_SCREEN_W}
        height={SLATE_SCREEN_H}
        clipStyle={confirmStyles.sweepClip}
      />
    </View>
  );
}

/* ---------------------- enter passphrase ---------------------- *
 * Title and six entered marks up top, and the ASCII keyboard panel docked
 * to the bottom band (Figma 35429:1320, authored at 480x813 like
 * enterPin, scaled x0.6 onto the 288x484 canvas; the panel's bottom
 * safe-area padding runs 3.8pt past the canvas and the screen clips it).
 * The file's dim input caret is deliberately left out — at replica scale
 * it reads as a stray mark, not a caret. The entered marks are the same
 * design component as on the PIN screen, so the row is shared above.
 * Choreography (schedule in ./animation.ts): the glass sweep crosses the
 * keyboard panel corner to corner, clipped to the panel's rounded box,
 * then six marks land one by one. */

const PASS_KEY_H = 39.6;
const PASS_KEY_R = 9.6;
const PASS_PANEL_TOP = 262.2;
const PASS_PANEL_H = 225.6;
const PASS_PANEL_R = 19.2;
/**
 * Uniform gutter, a review call: the panel's side insets equal the key
 * gap (the file's 4px half-gutter crowded the rounded corners), so the
 * letter caps give up the difference — 39.2 design px instead of 40 —
 * and every space in the grid reads as one gap unit.
 */
const PASS_GUTTER = 4.8;
const PASS_LETTER_W = 23.52;
/** Letter pitch: key width plus the gutter gap. */
const PASS_PITCH = PASS_LETTER_W + PASS_GUTTER;
const PASS_ROW_TOPS = [281.4, 328.2, 375, 421.8];

const passStyles = StyleSheet.create({
  // The panel's top edge sits 8 design px above the file's, opening the
  // tight 24px inset over the first key row up to 32px — a review call.
  panel: {
    position: 'absolute',
    left: 0,
    top: PASS_PANEL_TOP,
    width: SLATE_SCREEN_W,
    height: PASS_PANEL_H,
    borderTopLeftRadius: PASS_PANEL_R,
    borderTopRightRadius: PASS_PANEL_R,
    borderWidth: 0.6,
    borderColor: PANEL_BORDER,
    backgroundColor: PANEL_BG,
  },
  // The sweep's clip: the panel's own rounded box, so the light exists
  // only inside the panel — its material and its keys.
  sweepClip: {
    position: 'absolute',
    left: 0,
    top: PASS_PANEL_TOP,
    width: SLATE_SCREEN_W,
    height: PASS_PANEL_H,
    borderTopLeftRadius: PASS_PANEL_R,
    borderTopRightRadius: PASS_PANEL_R,
    overflow: 'hidden',
  },
});

// Key glyphs from the Figma screen, exact vector paths at their rendered
// sizes inside the 36px icon slot (scaled x0.6 like everything else).
const SHIFT_D =
  'M14.3657 0.784543C15.5114 -0.261515 17.2657 -0.261514 18.4114 ' +
  '0.784544L31.7939 13.0034C33.8165 14.8501 32.51 18.2188 29.7711 ' +
  '18.2188H25.3886V24.2188C25.3886 26.7041 23.3738 28.7188 20.8886 ' +
  '28.7188H11.8886C9.40327 28.7188 7.38855 26.7041 7.38855 ' +
  '24.2188V18.2188H3.00604C0.267116 18.2188 -1.03943 14.8501 0.98323 ' +
  '13.0034L14.3657 0.784543ZM16.3886 3L3.00604 15.2188H8.88855C9.71698 ' +
  '15.2188 10.3886 15.8904 10.3886 16.7188V24.2188C10.3886 25.0472 ' +
  '11.0601 25.7188 11.8886 25.7188H20.8886C21.717 25.7188 22.3886 ' +
  '25.0472 22.3886 24.2188V16.7188C22.3886 15.8904 23.0601 15.2188 ' +
  '23.8886 15.2188H29.7711L16.3886 3Z';
const BACKSPACE_BODY_D =
  'M10.3929 0C9.01198 0 7.70756 0.633996 6.85443 1.7198L0.961568 ' +
  '9.2198C-0.320521 10.8516 -0.320524 13.1484 0.961566 14.7802L6.85443 ' +
  '22.2802C7.70756 23.366 9.01198 24 10.3929 24H25.4348C27.92 24 ' +
  '29.9348 21.9853 29.9348 19.5V4.5C29.9348 2.01472 27.92 0 25.4348 ' +
  '0H10.3929ZM10.3929 3C9.93257 3 9.49776 3.21133 9.21338 3.57327L' +
  '3.32052 11.0733C2.89316 11.6172 2.89316 12.3828 3.32052 12.9267L' +
  '9.21338 20.4267C9.49776 20.7887 9.93257 21 10.3929 21H25.4348C' +
  '26.2632 21 26.9348 20.3284 26.9348 19.5V4.5C26.9348 3.67157 26.2632 ' +
  '3 25.4348 3H10.3929Z';
const BACKSPACE_X_D =
  'M14.8679 7.93934C14.2821 7.35355 13.3324 7.35355 12.7466 7.93934C' +
  '12.1608 8.52513 12.1608 9.47487 12.7466 10.0607L14.6884 12.0025L' +
  '12.7491 13.9418C12.1633 14.5276 12.1633 15.4774 12.7491 16.0632C' +
  '13.3349 16.6489 14.2846 16.6489 14.8704 16.0632L16.8098 14.1238L' +
  '18.7491 16.0632C19.3349 16.6489 20.2846 16.6489 20.8704 16.0632C' +
  '21.4562 15.4774 21.4562 14.5276 20.8704 13.9418L18.9311 12.0025L' +
  '20.8729 10.0607C21.4587 9.47487 21.4587 8.52513 20.8729 7.93934C' +
  '20.2871 7.35355 19.3374 7.35355 18.7516 7.93934L16.8098 9.88118L' +
  '14.8679 7.93934Z';
const PASS_ENTER_D =
  'M29.8235 0.430572C30.8285 1.16152 31.0507 2.56872 30.3197 3.57364L' +
  '13.1359 27.1986C12.7763 27.693 12.2311 28.0197 11.6257 28.1038C' +
  '11.0202 28.1878 10.4066 28.0219 9.92599 27.6442L0.859807 20.5192C' +
  '-0.117218 19.7514 -0.286808 18.3369 0.481027 17.3598C1.24886 ' +
  '16.3828 2.66336 16.2132 3.64039 16.981L10.8704 22.663L26.6804 ' +
  '0.926667C27.4114 -0.0782577 28.8187 -0.300363 29.8235 0.430572Z';

const SHIFT_GLYPH = (
  <Svg width={19.67} height={17.23} viewBox="0 0 32.7771 28.7188" fill="none">
    <Path fillRule="evenodd" clipRule="evenodd" d={SHIFT_D} fill={LABEL} />
  </Svg>
);
const BACKSPACE_GLYPH = (
  <Svg width={17.96} height={14.4} viewBox="0 0 29.9348 24" fill="none">
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d={BACKSPACE_BODY_D}
      fill={LABEL}
    />
    <Path d={BACKSPACE_X_D} fill={LABEL} />
  </Svg>
);
const PASS_ENTER_GLYPH = (
  <Svg width={18.45} height={16.88} viewBox="0 0 30.7503 28.1252" fill="none">
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d={PASS_ENTER_D}
      fill="#2B2B2E"
    />
  </Svg>
);

/** A key cap's frame on its row. */
function passKey(
  left: number,
  row: number,
  width: number,
  backgroundColor: string,
): ViewStyle {
  return blockFrame(
    left,
    PASS_ROW_TOPS[row],
    width,
    PASS_KEY_H,
    PASS_KEY_R,
    backgroundColor,
  );
}

// Letter-row starts: the top row spans gutter to gutter, the other two
// center their blocks (the middle row on the full width, the bottom row
// between the shift and backspace caps, clearing both by equal margins).
const PASS_LETTER_ROWS = [
  { keys: 'qwertyuiop', left: PASS_GUTTER },
  { keys: 'asdfghjkl', left: 18.96 },
  { keys: 'zxcvbnm', left: 47.28 },
];

interface IPassKey {
  name: string;
  label?: string;
  icon?: ReactNode;
  frame: ViewStyle;
}

const PASS_KEYS: IPassKey[] = [
  ...PASS_LETTER_ROWS.flatMap(({ keys, left }, row) =>
    keys.split('').map((letter, index) => ({
      name: letter,
      label: letter,
      frame: passKey(left + index * PASS_PITCH, row, PASS_LETTER_W, LETTER_BG),
    })),
  ),
  { name: 'shift', icon: SHIFT_GLYPH, frame: passKey(4.8, 2, 33.6, KEY_BG) },
  {
    name: 'backspace',
    icon: BACKSPACE_GLYPH,
    frame: passKey(249.6, 2, 33.6, KEY_BG),
  },
  { name: '123', label: '123', frame: passKey(4.8, 3, 55.68, KEY_BG) },
  { name: 'space', frame: passKey(65.28, 3, 157.44, LETTER_BG) },
  {
    name: 'enter',
    icon: PASS_ENTER_GLYPH,
    frame: passKey(227.52, 3, 55.68, LABEL),
  },
];

function PassKeyGlyph({ label }: { label: string }) {
  return (
    <SizableText
      color={LABEL}
      fontSize={19.2}
      lineHeight={20.4}
      letterSpacing={-0.6}
      fontWeight="600"
    >
      {label}
    </SizableText>
  );
}

const PASSPHRASE_TITLE = screenTitle('Enter Passphrase');

function PassphraseScreen({ clock }: { clock: SharedValue<number> }) {
  return (
    <View style={sceneStyles.screen}>
      {PASSPHRASE_TITLE}
      <View style={entryStyles.marksRow}>
        {PASSPHRASE_DOT_TRACKS.map((track, index) => (
          <TrackedLayer
            key={index}
            clock={clock}
            track={track}
            shiftTrack={PASSPHRASE_DOT_SHIFT_TRACKS[index]}
            baseStyle={entryStyles.mark}
          />
        ))}
      </View>
      <View style={passStyles.panel} />
      {PASS_KEYS.map(({ name, label, icon, frame }) => (
        <View key={name} style={frame}>
          {label ? <PassKeyGlyph label={label} /> : icon}
        </View>
      ))}
      <GlassSweep
        clock={clock}
        width={SLATE_SCREEN_W}
        height={PASS_PANEL_H}
        clipStyle={passStyles.sweepClip}
      />
    </View>
  );
}

/* --------------------------- registry --------------------------- */

function ConnectingContent({ onReady }: ISlateSceneContentProps) {
  return (
    <Image
      source={WALLPAPER_SOURCE}
      style={sceneStyles.wallpaper}
      fadeDuration={0}
      onLoad={onReady}
    />
  );
}

/**
 * The scene registry — the one table every per-scene trait lives in.
 * Adding a scene is adding one entry; nothing else consults a scene by
 * name.
 */
export const SCENES: Record<ISlateDeviceScene, ISlateSceneSpec> = {
  connecting: { content: ConnectingContent, defersEntry: true },
  enterPin: { content: PinScreen, loop: PIN_LOOP },
  enterPassphrase: { content: PassphraseScreen, loop: PASSPHRASE_LOOP },
  confirm: { content: ConfirmScreen, loop: CONFIRM_LOOP },
};
