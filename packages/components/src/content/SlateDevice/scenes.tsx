import type { ComponentType } from 'react';

import { Image, StyleSheet, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import { SizableText } from '../../primitives';

import { useConnectingOnSlateAnimation } from './animation';
import { SLATE_SCREEN_H, SLATE_SCREEN_W, SlateDeviceShell } from './shell';

import type { ViewStyle } from 'react-native';

/**
 * Built-in scenes of the Slate device, keyed by the name its `animation`
 * prop takes. enterPin and confirm are static stills transcribed 1:1 from
 * their Figma frames (enterPin 20553:1290 authored at 480x813, scaled
 * x0.6; confirm 20553:1265 authored on the 934x1582 screen raster, scaled
 * x288/934 — both land on the same 288x484 canvas grid), lit with the
 * shell's steady-on luminance; their tap choreography arrives once the
 * scenes are motion designed. connecting is animated the quiet way: a
 * slowed take of the shared wake plays once, and the wallpaper then just
 * holds lit — connecting has no natural end, so the screen never sleeps.
 */
export type ISlateDeviceScene =
  | 'connecting'
  | 'enterPin'
  | 'enterPassphrase'
  | 'confirm';

interface ISceneProps {
  width?: number;
}

/* --------------------------- palette --------------------------- *
 * The screens' design tokens over the shell's own black: labels/primary
 * white, keyboard/primary gray. Skeleton fills are white at the file's two
 * opacities, baked into rgba so nothing compounds. */

const LABEL = '#FFFFFF';
const KEY_BG = '#4B4B4C';
const FILL_STRONG = 'rgba(255,255,255,0.7)';
const FILL_FAINT = 'rgba(255,255,255,0.2)';

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
 * (an exact 288x484 render, laid flat with no cropping), woken from pure
 * black by a slowed take of the boot vocabulary and held lit. */

const CONNECTING_SCREEN = (
  <Image
    source={require('./screen-connecting.png')}
    style={sceneStyles.wallpaper}
    fadeDuration={0}
  />
);

/* ------------------------- enter PIN ------------------------- *
 * Title and four entered marks up top, a 4x3 numeric pad flush to the
 * bottom band, and the side scroll hint hugging the right edge where the
 * power button sits. The file sets the entered marks as text bullets;
 * four discs at the glyph's rendered size draw the same without a font
 * dependence. */

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
  return {
    digit,
    frame: blockFrame(
      PIN_COLS[i % 3],
      PIN_ROWS[Math.floor(i / 3)],
      PIN_KEY_W,
      PIN_KEY_H,
      PIN_KEY_R,
      KEY_BG,
    ),
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

const PIN_SCREEN = (
  <View style={sceneStyles.screen}>
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
    <View style={pinStyles.dotsRow}>
      <View style={pinStyles.dot} />
      <View style={pinStyles.dot} />
      <View style={pinStyles.dot} />
      <View style={pinStyles.dot} />
    </View>
    {PIN_DIGIT_KEYS.map(({ digit, frame }) => (
      <View key={digit} style={frame}>
        <PinDigitGlyph digit={digit} />
      </View>
    ))}
    <View style={PIN_CROSS_FRAME}>{CROSS_GLYPH}</View>
    <View style={PIN_ENTER_FRAME}>{CHECK_GLYPH}</View>
    <View style={pinStyles.scrollHint} />
  </View>
);

/* ------------------------- confirm ------------------------- *
 * Confirmation scenarios are unbounded, so the design abstracts to
 * skeleton structure: a two-line title block, three body lines, and the
 * Cancel / Confirm pill pair on the bottom band, labels left to the real
 * firmware. */

const confirmStyles = StyleSheet.create({
  titleLine1: blockFrame(14.4, 50.4, 153, 13.8, 6.9, FILL_STRONG),
  titleLine2: blockFrame(14.4, 80.9, 94.2, 13.8, 6.9, FILL_STRONG),
  bodyLine1: blockFrame(14.4, 128.1, 259.2, 9.6, 4.8, FILL_FAINT),
  bodyLine2: blockFrame(14.4, 154.4, 259.2, 9.6, 4.8, FILL_FAINT),
  bodyLine3: blockFrame(14.4, 180.7, 126.6, 9.6, 4.8, FILL_FAINT),
  cancelPill: blockFrame(14.4, 414.6, 121.25, 58.8, 28.8, FILL_FAINT),
  confirmPill: blockFrame(152.35, 414.6, 121.25, 58.8, 28.8, FILL_STRONG),
});

const CONFIRM_SCREEN = (
  <View style={sceneStyles.screen}>
    <View style={confirmStyles.titleLine1} />
    <View style={confirmStyles.titleLine2} />
    <View style={confirmStyles.bodyLine1} />
    <View style={confirmStyles.bodyLine2} />
    <View style={confirmStyles.bodyLine3} />
    <View style={confirmStyles.cancelPill} />
    <View style={confirmStyles.confirmPill} />
  </View>
);

/* --------------------------- scenes --------------------------- */

function ConnectingScene({ width }: ISceneProps) {
  const { animation } = useConnectingOnSlateAnimation();
  return (
    <SlateDeviceShell
      width={width}
      animation={animation}
      screenContent={CONNECTING_SCREEN}
    />
  );
}

function EnterPinScene({ width }: ISceneProps) {
  return <SlateDeviceShell width={width} screenContent={PIN_SCREEN} />;
}

/** No design yet: the passphrase step holds the dark glass. */
function EnterPassphraseScene({ width }: ISceneProps) {
  return <SlateDeviceShell width={width} />;
}

function ConfirmScene({ width }: ISceneProps) {
  return <SlateDeviceShell width={width} screenContent={CONFIRM_SCREEN} />;
}

export const SCENES: Record<ISlateDeviceScene, ComponentType<ISceneProps>> = {
  connecting: ConnectingScene,
  enterPin: EnterPinScene,
  enterPassphrase: EnterPassphraseScene,
  confirm: ConfirmScene,
};
