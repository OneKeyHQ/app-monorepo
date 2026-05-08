export type IOverviewCols = 4 | 5 | 6;

export type IOverviewMediaFlags = {
  gtXl?: boolean;
  gtLg?: boolean;
};

/**
 * Map Tamagui media flags to the tile-grid column count.
 *
 *   gtXl (>=1280)  -> 6
 *   gtLg (>=1024)  -> 5
 *   otherwise      -> 4
 *
 * The DeFi tableLayout branch already gates everything behind gtMd
 * upstream, so the resolver doesn't need a gtMd input.
 */
export function resolveOverviewCols(media: IOverviewMediaFlags): IOverviewCols {
  if (media.gtXl) return 6;
  if (media.gtLg) return 5;
  return 4;
}
