import { MotiView } from 'moti';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { YStack, useTheme, useThemeName } from '@onekeyhq/components';

const PEAK_ALPHA_LIGHT = 0.3;
const PEAK_ALPHA_DARK = 0.2;
const BREATHE_DURATION_MS = 8000;
const BREATHE_OPACITY_LOW = 0.85;
const BREATHE_OPACITY_HIGH = 1;

// Vertical-only extension past the rotating word's bounding box. Horizontal
// extension is avoided so the halo doesn't bleed into the prefix/suffix
// text on either side.
const HALO_VERTICAL_EXTENSION = 24;

// `wordIndex` is accepted for forward compat (e.g., a per-word pulse) but
// currently unused — the halo color stays fixed across words. Keeping the
// prop preserves the integration point.
export function HeroAtmosphere(_props: { wordIndex?: number }) {
  const theme = useTheme();
  const themeName = useThemeName();
  const peakAlpha = themeName === 'dark' ? PEAK_ALPHA_DARK : PEAK_ALPHA_LIGHT;
  const color = theme.brand9?.val ?? '#32B826';
  const gradientId = 'hero-halo';

  return (
    <YStack
      position="absolute"
      top={-HALO_VERTICAL_EXTENSION}
      left={0}
      right={0}
      bottom={-HALO_VERTICAL_EXTENSION}
      pointerEvents="none"
    >
      <MotiView
        from={{ opacity: BREATHE_OPACITY_HIGH }}
        animate={{ opacity: BREATHE_OPACITY_LOW }}
        transition={
          {
            type: 'timing',
            duration: BREATHE_DURATION_MS,
            loop: true,
            repeatReverse: true,
          } as any
        }
        style={{ flex: 1 }}
      >
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <RadialGradient
              id={gradientId}
              cx="50%"
              cy="50%"
              rx="50%"
              ry="50%"
              fx="50%"
              fy="50%"
            >
              <Stop offset="0%" stopColor={color} stopOpacity={peakAlpha} />
              <Stop offset="100%" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
      </MotiView>
    </YStack>
  );
}
