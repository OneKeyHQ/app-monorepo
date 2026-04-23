/**
 * Palette used by DeFiPortfolioDonut + DeFiPortfolioLegend.
 *
 * Rank 0..4 map to five visually distinct non-semantic hues. Tokens audited
 * against `packages/components/tamagui.config.ts` on 2026-04-23.
 *
 * How the tokens are registered:
 *   tamagui.config.ts lines 250-268 spread semantic alpha-scale objects
 *   (e.g. `...blue`, `...purple`, `...orange`, `...teal`, `...pink`) into
 *   `lightColors`, and lines 361-378 spread their dark counterparts into
 *   `darkColors`. Both objects are registered as top-level Tamagui theme
 *   tokens via `createTamagui({ themes: { light: {...lightColors}, dark:
 *   {...darkColors} } })`, so `$blue9`, `$purple9`, `$orange9`, `$teal9`,
 *   and `$pink9` are valid Tamagui `$`-prefixed tokens in both themes.
 *
 * IMPORTANT — all non-neutral tokens are alpha-scale (semi-transparent):
 *   `blue`   is generated from `blueA`   (light/dark blueA9)
 *   `purple` is generated from `purpleA` (light/dark purpleA9)
 *   `teal`   is generated from `tealA`   (light/dark tealA9)
 *   `orange` is generated from `orangeA` (light/dark orangeA9)
 *   `pink`   is generated from `pinkA`   (light/dark pinkA9)
 *   See `packages/components/colors/semantic.ts` — all exports call
 *   `generateSemanticColorsWithDefaultCount('{name}A', '{name}', 'light')`
 *   which maps `{name}A9` → `{name}9` etc. The hex values below are the raw
 *   alpha values from `packages/components/colors/primitive/light.ts` (light)
 *   and `packages/components/colors/primitive/dark.ts` (dark).
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
 *   `$neutral6` = neutral.neutral6 (light: #00000026) / neutralDark.neutral6 (dark: #ffffff2c)
 *     — tamagui.config.ts line 306: `border: neutral.neutral6`; muted gray in
 *     both themes. Used for the "Others" slice so it reads as a remainder, not
 *     a ranked position.
 *   `$neutral5` = neutral.neutral5 (light: #0000001f) / neutralDark.neutral5 (dark: #ffffff22)
 *     — tamagui.config.ts line 320: `borderSubdued: neutral.neutral5`; slightly
 *     lighter gray than Others for the empty-ring state.
 */

/**
 * Rank 0..4 → five distinct hues, in order of visual prominence.
 * All hex values are the alpha-scale primitives (semi-transparent).
 *
 *   [0] $blue9   light: #0090ff   dark: #0090ff
 *       tamagui.config.ts line 261: `...blue`   (from blueA9)
 *   [1] $purple9 light: #5c00adb1 dark: #b661ffc2
 *       tamagui.config.ts line 258: `...purple` (from purpleA9)
 *   [2] $teal9   light: #009e8ced dark: #13ffe49f
 *       tamagui.config.ts line 263: `...teal`   (from tealA9)
 *   [3] $orange9 light: #f65e00ea dark: #fe6d15f7
 *       tamagui.config.ts line 262: `...orange` (from orangeA9)
 *   [4] $pink9   light: #c8007fbf dark: #fe49bcd4
 *       tamagui.config.ts line 259: `...pink`   (from pinkA9)
 *
 * Why $pink9 at rank 4 (replacing $cyan9):
 *   $cyan9 (cyanA9) sits in the blue/cyan hue family, which is too close to
 *   $blue9 (blueA9) to satisfy the non-adjacent-hue requirement (§6.1).
 *   $pink9 (pinkA9 ≈ magenta/hot-pink) is perceptually distant from every
 *   other rank: blue (cool), violet (purple9), green-blue (teal9), warm-red
 *   (orange9). It is also exported from tamagui.config.ts and carries no
 *   semantic meaning in this codebase.
 */
export const PORTFOLIO_PALETTE_TOKENS: readonly string[] = [
  '$blue9', // rank 0 — blue       (alpha scale blueA9,   light #0090ff)
  '$purple9', // rank 1 — purple/violet (alpha scale purpleA9, light #5c00adb1)
  '$teal9', // rank 2 — teal/green  (alpha scale tealA9,   light #009e8ced)
  '$orange9', // rank 3 — orange     (alpha scale orangeA9, light #f65e00ea)
  '$pink9', // rank 4 — pink/magenta (alpha scale pinkA9,   light #c8007fbf)
];

/**
 * Token for the "Others" (aggregated remainder) slice.
 * Resolves to neutral.neutral6 (light: #00000026) and neutralDark.neutral6
 * (dark: #ffffff2c) — a muted translucent gray that visually reads as
 * "everything else".
 * tamagui.config.ts line 306: `border: neutral.neutral6`
 */
export const PORTFOLIO_OTHERS_TOKEN = '$neutral6';

/**
 * Token for the empty-ring state (when no DeFi positions exist).
 * Resolves to neutral.neutral5 (light: #0000001f) and neutralDark.neutral5
 * (dark: #ffffff22) — a slightly lighter translucent gray than Others.
 * tamagui.config.ts line 320: `borderSubdued: neutral.neutral5`
 */
export const PORTFOLIO_EMPTY_RING_TOKEN = '$neutral5';

/**
 * Maximum number of individually-colored ranked slices before the remainder
 * is collapsed into the "Others" slice.
 */
export const PORTFOLIO_TOP_N = 5;
