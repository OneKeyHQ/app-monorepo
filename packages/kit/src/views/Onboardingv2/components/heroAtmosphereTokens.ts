// Maps HeroRotatingWord index to a tamagui color scale token name.
// Index order matches HERO_ACTIONS in GetStarted.tsx:
//   0: trading, 1: earning, 2: swapping, 3: buying.
export const HERO_ATMOSPHERE_TOKEN_BY_INDEX: Record<number, string> = {
  0: 'blue9',
  1: 'amber9',
  2: 'purple9',
  3: 'brand9',
};

const FALLBACK_TOKEN = 'brand9';

export function getAtmosphereToken(index: number): string {
  return HERO_ATMOSPHERE_TOKEN_BY_INDEX[index] ?? FALLBACK_TOKEN;
}
