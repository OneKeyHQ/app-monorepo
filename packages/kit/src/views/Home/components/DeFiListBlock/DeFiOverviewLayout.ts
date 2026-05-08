import type { IOverviewCols } from './overviewColsResolver';

/**
 * Triple-layered card shadow shared with ProtocolRow / RichBlockContent.
 * Defines the OneKey "card row" elevation language. Web-only (boxShadow);
 * native uses a hairline border for visual parity.
 */
export const OVERVIEW_TILE_SHADOW =
  '0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';

export type IOverviewGridStyle = {
  display: 'grid';
  gridTemplateColumns: string;
};

export function buildOverviewGridStyle(
  cols: IOverviewCols,
): IOverviewGridStyle {
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  } as IOverviewGridStyle;
}
