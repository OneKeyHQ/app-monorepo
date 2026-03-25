import { LinearGradient } from '@onekeyhq/components/src/content/LinearGradient';
import { useThemeName } from '@onekeyhq/components/src/hooks/useStyle';

const locations: [number, number, ...number[]] = [0, 0.04, 0.5, 0.8, 1];
const gradientStart: [number, number] = [0, 0];
const gradientEnd: [number, number] = [0, 1];

const darkColors: string[] = [
  'rgba(0, 0, 0, 0)',
  'rgba(0, 0, 0, 0)',
  'rgba(220, 220, 220, 0.12)',
  'rgba(0, 0, 0, 0)',
  'rgba(0, 0, 0, 0)',
];

const lightColors: string[] = [
  'rgba(0, 0, 0, 0)',
  'rgba(0, 0, 0, 0)',
  'rgba(0, 0, 0, 0.1)',
  'rgba(0, 0, 0, 0)',
  'rgba(0, 0, 0, 0)',
];

export function VerticalDivider() {
  const themeName = useThemeName();
  const isDark = themeName === 'dark';

  return (
    <LinearGradient
      width={1}
      height="100%"
      colors={isDark ? darkColors : lightColors}
      locations={locations}
      start={gradientStart}
      end={gradientEnd}
    />
  );
}
