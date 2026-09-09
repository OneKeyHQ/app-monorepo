import platformEnv from '@onekeyhq/shared/src/platformEnv';

/**
 * The desktop header centers the search pill between two `flexBasis: 0`
 * spacers, so each side only ever gets `(rowWidth - pillWidth) / 2` and the
 * header actions paint over the pill once they need more than that — every
 * pixel of pill width costs two pixels of room for the actions (OK-58363).
 *
 * Two things keep `2 * rightWidth + pillWidth <= rowWidth` satisfied on narrow
 * windows, and they MUST flip at the same breakpoint: `UniversalSearchInput`
 * gives up its width floor, and `HeaderUpdateButton` drops its label for an
 * icon. Moving one without the other reopens the overlap in the gap between
 * the two thresholds, silently and only at certain window widths.
 *
 * Electron is the only platform that renders the update button
 * (`HeaderUpdateButton` is `platformEnv.isDesktop` gated), so it is also the
 * only one that has to give up the floor a breakpoint earlier; web and
 * extension keep the wider pill from `$gtLg` up.
 */
export const HEADER_WIDE_MEDIA_KEY = platformEnv.isDesktop ? 'gtXl' : 'gtLg';

export const HEADER_SEARCH_MIN_WIDTH = 320;
