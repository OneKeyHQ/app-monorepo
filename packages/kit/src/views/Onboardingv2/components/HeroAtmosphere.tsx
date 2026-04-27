import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { YStack, useTheme, useThemeName } from '@onekeyhq/components';

import { getAtmosphereToken } from './heroAtmosphereTokens';

const PEAK_ALPHA_LIGHT = 0.3;
const PEAK_ALPHA_DARK = 0.2;

export function HeroAtmosphere({ wordIndex }: { wordIndex: number }) {
  const theme = useTheme();
  const themeName = useThemeName();
  const peakAlpha = themeName === 'dark' ? PEAK_ALPHA_DARK : PEAK_ALPHA_LIGHT;

  const token = getAtmosphereToken(wordIndex);
  const color = theme[token as keyof typeof theme]?.val ?? '#000000';
  const gradientId = `hero-atmosphere-${wordIndex}`;

  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      pointerEvents="none"
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient
            id={gradientId}
            cx="50%"
            cy="40%"
            rx="60%"
            ry="50%"
            fx="50%"
            fy="40%"
          >
            <Stop offset="0%" stopColor={color} stopOpacity={peakAlpha} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </YStack>
  );
}
