import { LinearGradient } from '@onekeyhq/components/src/content/LinearGradient';
import { useThemeName } from '@onekeyhq/components/src/hooks/useStyle';

export function VerticalDivider() {
  const themeName = useThemeName();
  const isDark = themeName === 'dark';

  return (
    <LinearGradient
      width={1}
      height="100%"
      colors={[
        'rgba(0, 0, 0, 0)',
        'rgba(0, 0, 0, 0)',
        isDark ? 'rgba(220, 220, 220, 0.12)' : 'rgba(0, 0, 0, 0.1)',
        'rgba(0, 0, 0, 0)',
        'rgba(0, 0, 0, 0)',
      ]}
      locations={[0, 0.04, 0.5, 0.8, 1]}
      start={[0, 0]}
      end={[0, 1]}
    />
  );
}
