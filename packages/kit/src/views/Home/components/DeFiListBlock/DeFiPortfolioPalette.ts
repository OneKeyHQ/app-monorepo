/**
 * Palette for DeFiPortfolioStackedBar + DeFiPortfolioInlineLegend.
 *
 * Why raw scales (`$blue9`, `$purple9`, ...) over semantic tokens
 * (`$bgInfoStrong`, `$bgSuccessStrong`, `$bgCautionStrong`,
 * `$bgCriticalStrong`): semantic tokens carry product meaning
 * (info / success / warning / error) and would cause collisions — a
 * DeFi position tinted red would read as an error. The raw scales are
 * meaning-free in this codebase.
 *
 * Why `$pink9` at rank 4 over `$cyan9`: cyan sits in the blue/cyan hue
 * family too close to `$blue9` at rank 0; pink (≈ magenta) is
 * perceptually distant from every other rank (blue, violet, teal,
 * orange).
 */
export const PORTFOLIO_PALETTE_TOKENS = [
  '$blue9',
  '$purple9',
  '$teal9',
  '$orange9',
  '$pink9',
] as const;

/** Token for the "Others" (aggregated remainder) slice. */
export const PORTFOLIO_OTHERS_TOKEN = '$neutral6';

/** Token for the empty-ring state (when no DeFi positions exist). */
export const PORTFOLIO_EMPTY_RING_TOKEN = '$neutral5';
