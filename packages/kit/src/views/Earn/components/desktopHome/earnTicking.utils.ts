import BigNumber from 'bignumber.js';

const CENT_PLACES = 2;
// Past the cents, a total shows at most this many places in all
const MAX_PLACES = 8;
// The last place shown changes at least this often, in a second
const MIN_CHANGES_PER_SECOND = 0.5;

/**
 * How many places a total growing by `perSecond` shows so its last digit is
 * seen to move: the cents alone when they change often enough themselves, or
 * when even the last place allowed would stand still
 */
export function getTickingPlaces(perSecond: number) {
  if (!(perSecond > 0)) {
    return CENT_PLACES;
  }
  for (let places = CENT_PLACES; places <= MAX_PLACES; places += 1) {
    if (perSecond * 10 ** places >= MIN_CHANGES_PER_SECOND) {
      return places;
    }
  }
  return CENT_PLACES;
}

/** How long the last of `places` takes to change, in seconds */
export function getTickingStepSeconds(perSecond: number, places: number) {
  return 1 / (perSecond * 10 ** places);
}

/**
 * A total cut at the cents, and the digits after them down to `places`. Cut,
 * not rounded: the digits continue the cents shown before them
 */
export function splitTickingValue(value: number, places: number) {
  if (places <= CENT_PLACES || !(value >= 0.01)) {
    return { cents: String(value), digits: '' };
  }
  const fixed = new BigNumber(value).toFixed(places, BigNumber.ROUND_DOWN);
  const cut = fixed.length - (places - CENT_PLACES);
  return { cents: fixed.slice(0, cut), digits: fixed.slice(cut) };
}
