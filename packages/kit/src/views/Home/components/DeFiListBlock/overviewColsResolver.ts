export type IOverviewCols = 4 | 5 | 6;

export type IOverviewMediaFlags = {
  gtXl?: boolean;
  gtLg?: boolean;
  // The home's trade column sits beside the content.
  docked?: boolean;
};

/**
 * Map Tamagui media flags to the tile-grid column count.
 *
 *   gtXl (>=1280), docked  -> 4
 *   gtXl (>=1280)          -> 6
 *   gtLg (>=1024)          -> 5
 *   otherwise              -> 4
 *
 * Beside the docked trade column (from 1280 on the web) the home content
 * keeps to 800 inside: narrower than it gets just below 1280. Four tiles
 * there leave a protocol's name about 118px; six left it 50. A home without
 * the column keeps its 1140 width, which fits six.
 *
 * The DeFi tableLayout branch already gates everything behind gtMd
 * upstream, so the resolver doesn't need a gtMd input.
 */
export function resolveOverviewCols(media: IOverviewMediaFlags): IOverviewCols {
  if (media.gtXl) return media.docked ? 4 : 6;
  if (media.gtLg) return 5;
  return 4;
}
