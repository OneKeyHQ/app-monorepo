/**
 * Palette used by DeFiPortfolioDonut + DeFiPortfolioLegend.
 *
 * Rank 0..4 map to five visually distinct non-semantic hues. Tokens audited
 * against `packages/components/tamagui.config.ts` on 2026-04-23.
 *
 * How the tokens are registered:
 *   tamagui.config.ts lines 250-268 spread raw scale objects
 *   (e.g. `...blue`, `...purple`, `...orange`, `...teal`, `...cyan`) into
 *   `lightColors`, and lines 361-378 spread their dark counterparts into
 *   `darkColors`. Both objects are registered as top-level Tamagui theme
 *   tokens via `createTamagui({ themes: { light: {...lightColors}, dark:
 *   {...darkColors} } })` (lines 628-661), so `$blue9`, `$purple9`,
 *   `$orange9`, `$teal9`, and `$cyan9` are valid Tamagui `$`-prefixed tokens
 *   in both light and dark themes.
 *
 * Why NOT semantic tokens for rank slots:
 *   `$bgInfoStrong`    = info.info9   (blueA alpha scale) — semantic "info"
 *   `$bgSuccessStrong` = success.success9 (greenA alpha scale) — semantic "success"
 *   `$bgCautionStrong` = caution.caution9 (yellowA alpha scale) — semantic "warning"
 *   `$bgCriticalStrong`= critical.critical9 (redA alpha scale) — semantic "error/danger"
 *   Using those as chart ranks would create semantic collisions (e.g. a DeFi
 *   position colored red looks like an error). The non-semantic raw scales
 *   below do not carry any product meaning in this codebase.
 *
 * Neutral / empty tokens:
 *   `$neutral6` = neutral.neutral6 (light: #d9d9d9) / neutralDark.neutral6 (dark)
 *     — tamagui.config.ts line 306: `border: neutral.neutral6`; muted gray in
 *     both themes. Used for the "Others" slice so it reads as a remainder, not
 *     a ranked position.
 *   `$neutral5` = neutral.neutral5 (light: #e0e0e0) / neutralDark.neutral5 (dark)
 *     — tamagui.config.ts line 320: `borderSubdued: neutral.neutral5`; slightly
 *     lighter gray for the empty-ring state.
 */

/**
 * Rank 0..4 → five distinct hues, in order of visual prominence.
 *
 *   [0] $blue9   light: #0090ff  (tamagui.config.ts line 261: `...blue`)
 *   [1] $purple9 light: #8e4ec6  (tamagui.config.ts line 258: `...purple`)
 *   [2] $teal9   light: #12a594  (tamagui.config.ts line 263: `...teal`)
 *   [3] $orange9 light: #f76b15  (tamagui.config.ts line 262: `...orange`)
 *   [4] $cyan9   light: #00a2c7  (tamagui.config.ts line 264: `...cyan`)
 */
export const PORTFOLIO_PALETTE_TOKENS: readonly string[] = [
  '$blue9', // rank 0 — blue  (non-semantic raw scale, light #0090ff)
  '$purple9', // rank 1 — purple (non-semantic raw scale, light #8e4ec6)
  '$teal9', // rank 2 — teal  (non-semantic raw scale, light #12a594)
  '$orange9', // rank 3 — orange (non-semantic raw scale, light #f76b15)
  '$cyan9', // rank 4 — cyan  (non-semantic raw scale, light #00a2c7)
];

/**
 * Token for the "Others" (aggregated remainder) slice.
 * Resolves to neutral.neutral6 in light (#d9d9d9) and neutralDark.neutral6 in
 * dark — a muted gray that visually reads as "everything else".
 * tamagui.config.ts line 306: `border: neutral.neutral6`
 */
export const PORTFOLIO_OTHERS_TOKEN = '$neutral6';

/**
 * Token for the empty-ring state (when no DeFi positions exist).
 * Resolves to neutral.neutral5 in light (#e0e0e0) and neutralDark.neutral5 in
 * dark — a slightly lighter gray than Others.
 * tamagui.config.ts line 320: `borderSubdued: neutral.neutral5`
 */
export const PORTFOLIO_EMPTY_RING_TOKEN = '$neutral5';

/**
 * Maximum number of individually-colored ranked slices before the remainder
 * is collapsed into the "Others" slice.
 */
export const PORTFOLIO_TOP_N = 5;
