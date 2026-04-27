import { useEffect, useState } from 'react';

import { MotiView } from 'moti';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { YStack, useMedia, useTheme, useThemeName } from '@onekeyhq/components';

import { getAtmosphereToken } from './heroAtmosphereTokens';

const PEAK_ALPHA_LIGHT = 0.3;
const PEAK_ALPHA_DARK = 0.2;
// Match HERO_CHAR_ANIMATION_MS in GetStarted.tsx so the glow fade aligns with
// the hero word's character entry/exit animation.
const FADE_DURATION_MS = 550;
const BREATHE_DURATION_MS = 8000;
const BREATHE_OPACITY_LOW = 0.85;
const BREATHE_OPACITY_HIGH = 1;

// Gradient extent depends on viewport aspect ratio. Narrow/tall (mobile)
// already extends visibly with a small gradient because rx/ry % map to a
// taller container. Wide/short (desktop) needs a larger gradient or it
// becomes a small spot at the top.
const GRADIENT_NARROW = { rx: '80%', ry: '120%' };
const GRADIENT_WIDE = { rx: '100%', ry: '200%' };

function RadialGlow({
  index,
  isCurrent,
  peakAlpha,
  rx,
  ry,
}: {
  index: number;
  isCurrent: boolean;
  peakAlpha: number;
  rx: string;
  ry: string;
}) {
  const theme = useTheme();
  const token = getAtmosphereToken(index);
  const color = theme[token as keyof typeof theme]?.val ?? '#000000';
  const gradientId = `hero-atmosphere-${index}-${isCurrent ? 'cur' : 'prev'}`;

  return (
    <MotiView
      from={{ opacity: isCurrent ? 0 : 1 }}
      animate={{ opacity: isCurrent ? 1 : 0 }}
      transition={
        {
          type: 'timing',
          duration: FADE_DURATION_MS,
        } as any
      }
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient
            id={gradientId}
            cx="50%"
            cy="0%"
            rx={rx}
            ry={ry}
            fx="50%"
            fy="0%"
          >
            <Stop offset="0%" stopColor={color} stopOpacity={peakAlpha} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </MotiView>
  );
}

export function HeroAtmosphere({ wordIndex }: { wordIndex: number }) {
  const themeName = useThemeName();
  const { gtMd } = useMedia();
  const peakAlpha = themeName === 'dark' ? PEAK_ALPHA_DARK : PEAK_ALPHA_LIGHT;
  const { rx, ry } = gtMd ? GRADIENT_WIDE : GRADIENT_NARROW;

  const [currentIndex, setCurrentIndex] = useState(wordIndex);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);

  useEffect(() => {
    if (wordIndex === currentIndex) {
      return;
    }
    setPreviousIndex(currentIndex);
    setCurrentIndex(wordIndex);
    const timer = setTimeout(() => {
      setPreviousIndex(null);
    }, FADE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [wordIndex, currentIndex]);

  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
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
        {previousIndex !== null ? (
          <RadialGlow
            key={`prev-${previousIndex}`}
            index={previousIndex}
            isCurrent={false}
            peakAlpha={peakAlpha}
            rx={rx}
            ry={ry}
          />
        ) : null}
        <RadialGlow
          key={`curr-${currentIndex}`}
          index={currentIndex}
          isCurrent
          peakAlpha={peakAlpha}
          rx={rx}
          ry={ry}
        />
      </MotiView>
    </YStack>
  );
}
