import type { ReactNode } from 'react';

import { Stack, Table, YStack } from '@onekeyhq/components';
import type {
  IStackProps,
  ITableColumn,
  ITableProps,
} from '@onekeyhq/components';

import {
  MARKET_DESKTOP_CONTENT_FRAME_PROPS,
  MARKET_DESKTOP_HEADER_INSET,
  MARKET_DESKTOP_NO_TOOLBAR_TABLE_INSET,
  MARKET_DESKTOP_TOOLBAR_BAND_STYLE,
  MARKET_DESKTOP_TOOLBAR_INSET,
  MARKET_LIST_HEADER_ROW_HEIGHT,
} from '../../marketDesktopLayoutConstants';

export function MarketDesktopToolbarBand({
  children,
  px = MARKET_DESKTOP_TOOLBAR_INSET,
}: {
  children: ReactNode;
  px?: IStackProps['px'];
}) {
  return (
    <Stack {...MARKET_DESKTOP_TOOLBAR_BAND_STYLE} px={px}>
      {children}
    </Stack>
  );
}

/**
 * The sticky region every desktop Market list page portals above its rows: the
 * toolbar band, then the column header. Both insets come from the design —
 * the toolbar sits 20px into the content band and the table 12px — so routing
 * every page through here is what keeps the tabs from disagreeing.
 */
export function MarketDesktopStickyHeader<T>({
  toolbar,
  columns,
  onHeaderRow,
  rowProps,
  centered = true,
  scrollLeft = 0,
}: {
  toolbar?: ReactNode;
  columns: ITableColumn<T>[];
  onHeaderRow?: ITableProps<T>['onHeaderRow'];
  rowProps?: ITableProps<T>['rowProps'];
  /** Full-bleed surfaces (banner detail) opt out of the centred content band. */
  centered?: boolean;
  /**
   * How far the rows this header labels have scrolled sideways. The header is
   * portalled out of that scroller, so a page whose rows can scroll has to
   * hand the offset back or the columns drift apart.
   */
  scrollLeft?: number;
}) {
  // The band keeps its 8px lead over the header on both frames.
  const headerInset = centered ? MARKET_DESKTOP_HEADER_INSET : '$4';
  const toolbarInset = centered ? MARKET_DESKTOP_TOOLBAR_INSET : '$6';
  return (
    <YStack
      // Must resolve to the same frame as the rows this header labels,
      // otherwise the column titles drift once the header sticks.
      {...(centered
        ? MARKET_DESKTOP_CONTENT_FRAME_PROPS
        : { width: '100%' as const })}
      bg="$bgApp"
    >
      {toolbar ? (
        <MarketDesktopToolbarBand px={toolbarInset}>
          {toolbar}
        </MarketDesktopToolbarBand>
      ) : (
        <Stack height={MARKET_DESKTOP_NO_TOOLBAR_TABLE_INSET} />
      )}
      <Stack px={headerInset} overflow="hidden">
        <Stack x={-scrollLeft}>
          <Table.HeaderRow
            columns={columns}
            onHeaderRow={onHeaderRow}
            rowProps={rowProps}
            headerRowProps={{ height: MARKET_LIST_HEADER_ROW_HEIGHT }}
          />
        </Stack>
      </Stack>
    </YStack>
  );
}
