import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';

export type IEarnDesktopSurface = '$bgSubdued' | '$gray3' | '$gray4' | '$gray5';

// Card colors for the home's tiles, market cards and the open table row. On a
// white page bgSubdued (#f9f9f9) barely shows, so light mode starts one gray
// step darker. Hover and press go one and two steps further; the steps are
// opaque, so rings drawn in the card's color around stacked icons stay hidden
export function useEarnDesktopSurfaces(): Record<
  'rest' | 'hover' | 'press',
  IEarnDesktopSurface
> {
  const isLight = useThemeVariant() === 'light';
  return isLight
    ? { rest: '$gray3', hover: '$gray4', press: '$gray5' }
    : { rest: '$bgSubdued', hover: '$gray3', press: '$gray4' };
}
