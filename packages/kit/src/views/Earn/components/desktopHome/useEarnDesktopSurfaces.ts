import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';

export type IEarnDesktopSurface = '$bgSubdued' | '$gray3' | '$gray4' | '$gray5';

export type IEarnDesktopSurfaces = Record<
  'rest' | 'hover' | 'press',
  IEarnDesktopSurface
>;

// Tiles that stand on the page by themselves, the holdings rows: a step further
// from the dark page than the cards, so they read as raised without an outline
// (#0f0f0f to #222222). On a white page the cards' steps already show
export const EARN_DESKTOP_TILE_SURFACES: IEarnDesktopSurfaces = {
  rest: '$gray3',
  hover: '$gray4',
  press: '$gray5',
};

// Card colors for the home's tiles, market cards and the open table row. On a
// white page bgSubdued (#f9f9f9) barely shows, so light mode starts one gray
// step darker. Hover and press go one and two steps further; the steps are
// opaque, so rings drawn in the card's color around stacked icons stay hidden
export function useEarnDesktopSurfaces(): IEarnDesktopSurfaces {
  const isLight = useThemeVariant() === 'light';
  return isLight
    ? { rest: '$gray3', hover: '$gray4', press: '$gray5' }
    : { rest: '$bgSubdued', hover: '$gray3', press: '$gray4' };
}
