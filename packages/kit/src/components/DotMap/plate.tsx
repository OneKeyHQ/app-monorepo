import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { Image as RNImage, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import {
  LinearGradient,
  SizableText,
  Stack,
  XStack,
  useMedia,
  useTheme,
  useThemeName,
} from '@onekeyhq/components';

import type { LayoutChangeEvent } from 'react-native';

// Shared visual language for the physical OneKey KeyTag plate, reused by both
// the read-only DotMap (index.tsx) and the interactive KeyTagInput. A framed
// grid with a dot in every cell, the 2^n weight scale on top, row numbers on
// the left, and the "1/0" brand mark in the corner. The row-label column width
// equals the header row height so the 12x12 grid + gutters reads as a square.
export const KEYTAG_CELL_BORDER = 1;
// Row-label column width == header row height keeps the 12x12 grid + gutters
// square. Sized to fit the largest 2^n label ("2048") at HeadingXS, rotated.
export const KEYTAG_ROW_LABEL_W = 36;
export const KEYTAG_HEADER_H = 36;
// Breathing room between the row-label / 2^n gutters and the grid itself.
export const KEYTAG_GRID_GAP = 8;

// Visual hierarchy: the grid is where the user interacts, so its lines sit
// brightest; the frame, the brand mark and the guide dots of empty cells
// recede behind it. Row/scale numbers default to the theme "$textDisabled"
// token and the punched dot to "$brand10" (both applied at the call sites),
// so only the non-token tones live here.
export const KEYTAG_LINE = {
  light: {
    frame: 'rgba(0,0,0,0.08)',
    grid: 'rgba(0,0,0,0.24)',
    guide: 'rgba(0,0,0,0.18)',
    mark: 'rgba(0,0,0,0.30)',
  },
  dark: {
    frame: 'rgba(255,255,255,0.08)',
    grid: 'rgba(255,255,255,0.22)',
    guide: 'rgba(255,255,255,0.2)',
    mark: 'rgba(255,255,255,0.3)',
  },
};

export type IKeyTagLine = (typeof KEYTAG_LINE)['light'];

// Resolve against the ambient Tamagui theme, not the global settings variant:
// the Onboarding V2 navigator pins its subtree to dark (<Theme name="dark">,
// routes/Modal/Navigator.tsx), so a settings-level hook would paint the light
// palette (near-black lines) onto the forced-dark pages.
export function useKeyTagLine(): IKeyTagLine {
  const themeName = useThemeName();
  return KEYTAG_LINE[themeName === 'dark' ? 'dark' : 'light'];
}

// Horizontal chrome around the 12 grid columns: both sides of the frame
// (1px border + $1.5 padding + 1px border + $3 padding, see KeyTagPlateFrame)
// plus the row-label column and its gutter.
export const KEYTAG_PLATE_CHROME_W =
  2 * (1 + 6 + 1 + 12) + KEYTAG_ROW_LABEL_W + KEYTAG_GRID_GAP;

// The plate never grows past this, however wide the host is.
export const KEYTAG_PLATE_MAX_W = 400;

// The plate is elastic: cells are squares sized from whatever width the host
// gives it (capped at KEYTAG_PLATE_MAX_W). Attach `onLayout` to a stretched
// wrapper around the plate; the row labels and the 2^n scale track the
// returned cellSize, so alignment holds at any size. `measured` gates the
// first paint (fallback size) so the plate doesn't visibly jump once the
// real width lands.
export function useKeyTagCellSize(fallback: number) {
  const [measuredCell, setMeasuredCell] = useState<number | null>(null);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0) {
      const usable = Math.min(width, KEYTAG_PLATE_MAX_W);
      setMeasuredCell(
        Math.max(12, Math.floor((usable - KEYTAG_PLATE_CHROME_W) / 12)),
      );
    }
  }, []);
  return {
    cellSize: measuredCell ?? fallback,
    measured: measuredCell !== null,
    onLayout,
  };
}

// The plate arrives aligned with the rest of the page, holds there long enough
// to be read as the starting state, then grows — slowly, anchored at its top
// edge — breaking out of the content gutters onto cells big enough to hit with
// a thumb. Growing out of the container is the whole effect, so the resting
// state must stay inside it. Small screens only: on gtMd the plate is capped at
// 400 and sits beside the sidebar, so there is nowhere to grow into.
const PLATE_FADE_MS = 240;
const PLATE_ZOOM_DELAY_MS = 700;
const PLATE_ZOOM_MS = 900;
const PLATE_ZOOM_TO = 1.27;
// The plate is not visually centred on its own grid: the row-number column and
// its gutter sit only on the left, and the numbers are right-aligned inside it,
// so the left edge carries far more dead space than the right. Drifting left
// while it grows spends that dead space instead of the right margin, which is
// the side where a real cell would be the first thing to fall off screen.
const PLATE_ZOOM_SHIFT_X = -12;

const entranceStyles = StyleSheet.create({
  // Top-center origin keeps the heading above the plate visually still.
  origin: { transformOrigin: 'top center' },
});

export function KeyTagPlateEntrance({
  active,
  zoom: zoomEnabled = true,
  children,
}: {
  // Flips true once the host has measured the plate width.
  active: boolean;
  // The grow-out zoom only earns its keep on an interactive plate, where it
  // enlarges tap targets. A read-only plate has nothing to tap, so its host
  // opts out (zoom={false}): the plate then fades in at its resting width and
  // stays aligned with the page instead of overhanging the copy below it.
  zoom?: boolean;
  children: ReactNode;
}) {
  const { gtMd } = useMedia();
  const reducedMotion = useReducedMotion();
  const fade = useSharedValue(0);
  const zoom = useSharedValue(1);
  const shift = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      return;
    }
    const grows = zoomEnabled && !gtMd;
    const zoomTo = grows ? PLATE_ZOOM_TO : 1;
    const shiftTo = grows ? PLATE_ZOOM_SHIFT_X : 0;
    if (reducedMotion) {
      // Same end state, no motion: the zoom is a touch-target size, not decor.
      fade.value = 1;
      zoom.value = zoomTo;
      shift.value = shiftTo;
      return;
    }
    fade.value = withTiming(1, {
      duration: PLATE_FADE_MS,
      easing: Easing.out(Easing.cubic),
    });
    const grow = {
      duration: PLATE_ZOOM_MS,
      easing: Easing.inOut(Easing.cubic),
    };
    zoom.value = withDelay(PLATE_ZOOM_DELAY_MS, withTiming(zoomTo, grow));
    shift.value = withDelay(PLATE_ZOOM_DELAY_MS, withTiming(shiftTo, grow));
  }, [active, fade, gtMd, reducedMotion, shift, zoom, zoomEnabled]);

  // translateX before scale in the array == CSS `translateX() scale()`, i.e.
  // the shift is applied after scaling, so it stays a fixed pixel offset
  // instead of being multiplied by the zoom.
  const style = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateX: shift.value }, { scale: zoom.value }],
  }));

  return (
    <Animated.View style={[entranceStyles.origin, style]}>
      {children}
    </Animated.View>
  );
}

// OneKey "1/0" logo mark for the plate corner. Brand asset flattened to a
// single even-odd path (the "0" inner disc sits at nesting depth 3 = filled,
// exactly like the original separate fill-back path); clipPath and hardcoded
// fills stripped so the plate palette drives the color.
const KEYTAG_BRAND_PATH =
  'M14 0C21.732 0 28 6.26801 28 14C28 21.732 21.732 28 14 28C6.26801 28 0 ' +
  '21.732 0 14C0 6.26801 6.26801 0 14 0ZM14 13.1797C11.5469 13.1797 9.55859 ' +
  '15.169 9.55859 17.6221C9.55875 20.075 11.547 22.0634 14 22.0635C16.453 ' +
  '22.0635 18.4412 20.075 18.4414 17.6221C18.4414 15.169 16.4531 13.1797 14 ' +
  '13.1797ZM11.3701 5.93652L10.6865 8.00293H12.8506V12.3545H15.2646V5.93652H' +
  '11.3701ZM14 15.1963C15.3394 15.1963 16.4258 16.2826 16.4258 17.6221C' +
  '16.4256 18.9614 15.3393 20.0469 14 20.0469C12.6607 20.0468 11.5754 ' +
  '18.9613 11.5752 17.6221C11.5752 16.2827 12.6606 15.1963 14 15.1963Z';

export function KeyTagBrandMark({ line }: { line: IKeyTagLine }) {
  return (
    <Svg width={36} height={36} viewBox="0 0 28 28">
      <Path d={KEYTAG_BRAND_PATH} fill={line.mark} fillRule="evenodd" />
    </Svg>
  );
}

// The engraved 2^n weight scale (2048 … 1) rotated vertically above each grid
// column. The rotated label is centered in the header band (justifyContent
// center) so its visual height stays within HEADER_H and does not bleed into
// the first grid row. textAlign "left" anchors the glyphs to the bottom of the
// band (nearest the grid): after the -90deg rotation the text's start edge maps
// to the bottom, so short numbers sit low and long ones grow upward.
export function KeyTagScaleHeader({
  cellSize,
  highlightedCol,
}: {
  cellSize: number;
  // Column whose weight should brighten (the hover cross-hair); unset = none.
  highlightedCol?: number;
}) {
  return (
    <XStack height={KEYTAG_HEADER_H}>
      {Array.from({ length: 12 }).map((_, col) => (
        <Stack
          key={col}
          width={cellSize}
          height={KEYTAG_HEADER_H}
          alignItems="center"
          justifyContent="center"
        >
          <Stack style={{ transform: [{ rotate: '-90deg' }] }}>
            <SizableText
              size="$headingXs"
              color={col === highlightedCol ? '$text' : '$textDisabled'}
              textAlign="left"
              style={{ width: KEYTAG_HEADER_H }}
            >
              {2 ** (11 - col)}
            </SizableText>
          </Stack>
        </Stack>
      ))}
    </XStack>
  );
}

// Soft diagonal light across the plate: a highlight in the top-left corner
// fading through neutral to a shadow in the bottom-right, as if lit from the
// upper-left. Kept subtle so it reads as sheen, not a heavy metallic fill.
const KEYTAG_LIGHT_GRADIENT = [
  'rgba(255,255,255,0.12)',
  'rgba(255,255,255,0)',
  'rgba(0,0,0,0.12)',
];

// Fine sandblasted grain tiled across the plate. The tile mixes light and
// dark specks so it stays neutral on both themes; tiling (not stretching)
// keeps the speckle crisp at any plate size. RN core Image is used because
// the expo-image based wrapper has no tiling mode.
const KEYTAG_NOISE_TILE = require('@onekeyhq/kit/assets/keytag/keytag_noise.png');

const noiseStyles = StyleSheet.create({
  noise: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.14,
    pointerEvents: 'none',
  },
});

// Strap-hole cutout shape from design (30x29), fill stripped so the theme
// supplies it at render time.
const KEYTAG_HOLE_PATH =
  'M2 0C17.464 0 30 12.536 30 28C30 28.3348 29.9921 28.6681 29.9805 29H24C' +
  '10.7452 29 3.8658e-07 18.2548 0 5V0.0712891C0.660625 0.0246639 1.32751 ' +
  '0 2 0Z';

// The double-border plate frame: a $bgStrong base with the diagonal light
// overlay, shared by the interactive input plate and the read-only DotMap so
// both catch the light identically. Its borders stay fainter than the grid
// lines inside so the interactive area leads.
export function KeyTagPlateFrame({ children }: { children: ReactNode }) {
  const line = useKeyTagLine();
  // Raw color for the SVG hole fill — tokens don't resolve inside react-native-svg.
  const theme = useTheme();
  return (
    <Stack
      borderRadius={32}
      borderWidth={1}
      borderColor={line.frame}
      bg="$bgStrong"
      p="$1.5"
      overflow="hidden"
    >
      <LinearGradient
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        colors={KEYTAG_LIGHT_GRADIENT}
        locations={[0, 0.5, 1]}
        start={[0, 0]}
        end={[1, 1]}
        pointerEvents="none"
      />
      <RNImage
        source={KEYTAG_NOISE_TILE}
        resizeMode="repeat"
        style={noiseStyles.noise}
      />
      {/* inner frame: app-background border reads as a recessed groove */}
      <Stack
        borderRadius={24}
        borderWidth={1}
        borderColor="$bgApp"
        p="$3"
        gap={KEYTAG_GRID_GAP}
      >
        {children}
      </Stack>
      {/* strap-hole cutout (design asset): a crescent whose inner edge is the
          same radius-24 arc as the inner frame's corner, so the punch reads as
          biting into the bottom-left corner exactly like the physical tag.
          Anchored on the inner frame's box corner (1px border + $1.5 padding
          = 7px inset) and filled with the app background. */}
      <Stack position="absolute" left={7} bottom={7} pointerEvents="none">
        <Svg width={30} height={29} viewBox="0 0 30 29">
          <Path d={KEYTAG_HOLE_PATH} fill={theme.bgApp.val} />
        </Svg>
      </Stack>
    </Stack>
  );
}
