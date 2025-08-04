/* eslint-disable react/prop-types */
import type { CSSProperties, ComponentType, ReactNode } from 'react';
import { isValidElement, useCallback, useEffect, useMemo, useRef } from 'react';

import { View } from 'react-native';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  Collection,
  List as VirtualizedList,
} from 'react-virtualized';

import { useTabsContext, useTabsScrollContext } from './context';
import { useTabNameContext } from './TabNameContext';
import { useConvertAnimatedToValue } from './useFocusedTab';

import type { ISectionListProps } from '../../layouts';
import type { FlashListProps } from '@shopify/flash-list';
import type {
  CollectionCellRendererParams,
  ListRowProps,
} from 'react-virtualized';

type IListProps<Item> = FlashListProps<Item>;

type IListData<Item> =
  | {
      type: 'header';
    }
  | {
      type: 'footer';
    }
  | {
      type: 'item';
      data: Item;
    }
  | {
      type: 'section-header';
      data: {
        section: ISectionListProps<Item>['sections'][number];
        sectionIndex: number;
      };
    }
  | {
      type: 'section-footer';
      data: {
        section: ISectionListProps<Item>['sections'][number];
        sectionIndex: number;
      };
    }
  | {
      type: 'section-item';
      data: {
        item: Item;
        itemIndex: number;
        sectionIndex: number;
      };
    };

const renderElement = (Element: ReactNode | ComponentType<any>) => {
  if (isValidElement(Element)) {
    return Element;
  }
  const Component = Element as ComponentType<any>;
  return <Component />;
};

export function List<Item>({
  renderItem,
  data,
  sections,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  renderSectionHeader,
  renderSectionFooter,
  ListHeaderComponentStyle,
  ListFooterComponentStyle,
  numColumns = 1,
  extraData,
  keyExtractor,
  contentContainerStyle,
  horizontalPadding = 0,
}: Omit<IListProps<Item>, 'ListEmptyComponent'> &
  Omit<ISectionListProps<Item>, 'ListEmptyComponent'> & {
    ListEmptyComponent?: ReactNode | ComponentType<any>;
    contentContainerStyle?: CSSProperties;
    horizontalPadding?: number;
  }) {
  const {
    registerChild,
    height,
    width: tabWidth,
    isScrolling,
    onChildScroll,
    scrollTop,
  } = useTabsScrollContext();

  const width = useMemo(() => {
    return tabWidth - horizontalPadding;
  }, [tabWidth, horizontalPadding]);
  const currentTabName = useTabNameContext();
  const { focusedTab } = useTabsContext();

  const focusedTabValue = useConvertAnimatedToValue(focusedTab, '');

  const ref = useRef<Element>(null);

  const scrollTabElementsRef = useTabsContext().scrollTabElementsRef;

  const listData: IListData<Item>[] = useMemo(() => {
    if (!data?.length && !sections?.length) {
      return [];
    }
    const list: IListData<Item>[] = [];
    if (ListHeaderComponent) {
      list.push({ type: 'header' });
    }

    if (sections?.length) {
      sections.forEach((section, sectionIndex) => {
        if (renderSectionHeader) {
          list.push({
            data: {
              section,
              sectionIndex,
            },
            type: 'section-header',
          });
        }
        if (section.data?.length) {
          section.data.forEach((item, itemIndex) => {
            list.push({
              type: 'section-item',
              data: {
                item,
                itemIndex,
                sectionIndex,
              },
            });
          });
        }
        if (renderSectionFooter) {
          list.push({
            data: {
              section,
              sectionIndex,
            },
            type: 'section-footer',
          });
        }
      });
    } else if (data?.length) {
      data.forEach((item) => {
        list.push({
          data: item,
          type: 'item' as const,
        });
      });
    }
    if (ListFooterComponent) {
      list.push({ type: 'footer' });
    }
    return list;
  }, [
    ListFooterComponent,
    ListHeaderComponent,
    data,
    renderSectionFooter,
    renderSectionHeader,
    sections,
  ]);

  // Cell measurement cache for react-virtualized list optimization
  // Can be optimized with keyExtractor for better height caching performance
  const cache = useMemo(
    () =>
      new CellMeasurerCache({
        fixedWidth: true,
        defaultHeight: 60,
        keyMapper: (rowIndex, columnIndex) => {
          if (keyExtractor) {
            const item = listData[rowIndex];
            if (
              item.type === 'header' ||
              item.type === 'footer' ||
              item.type === 'section-header' ||
              item.type === 'section-footer'
            ) {
              return `${rowIndex}-${columnIndex}-${item.type}`;
            }
            return item
              ? keyExtractor(item.data as any, rowIndex)
              : `${rowIndex}-${columnIndex}`;
          }
          return `${rowIndex}-${columnIndex}`;
        },
      }),
    [keyExtractor, listData],
  );

  const isVisible = useMemo(() => {
    return focusedTabValue === currentTabName;
  }, [focusedTabValue, currentTabName]);

  useEffect(() => {
    if (focusedTabValue === currentTabName) {
      if (
        scrollTabElementsRef?.current &&
        !scrollTabElementsRef?.current[currentTabName]
      ) {
        scrollTabElementsRef.current[currentTabName] = {} as any;
      }
      scrollTabElementsRef.current[currentTabName].element =
        ref.current as HTMLElement;
      registerChild(ref.current);
    }
  }, [focusedTabValue, currentTabName, registerChild, scrollTabElementsRef]);

  const listRef = useRef<typeof VirtualizedList>(null);

  const HeaderElement = useMemo(() => {
    if (ListHeaderComponent) {
      return (
        <View style={ListHeaderComponentStyle as any}>
          {renderElement(ListHeaderComponent)}
        </View>
      );
    }
    return null;
  }, [ListHeaderComponent, ListHeaderComponentStyle]);

  const FooterElement = useMemo(() => {
    if (ListFooterComponent) {
      return (
        <View style={ListFooterComponentStyle as any}>
          {renderElement(ListFooterComponent)}
        </View>
      );
    }
    return null;
  }, [ListFooterComponent, ListFooterComponentStyle]);

  const rowRenderer = useCallback(
    ({
      rowIndex,
      key,
      parent,
      style,
      columnIndex = 0,
      index,
    }: ListRowProps & {
      rowIndex?: number;
    }) => {
      const item = listData[index];
      let element = null;
      if (item.type === 'header') {
        element = HeaderElement;
      } else if (item.type === 'footer') {
        element = FooterElement;
      } else if (item.type === 'section-header') {
        element = renderSectionHeader?.({
          section: item.data.section,
          index: item.data.sectionIndex,
        });
      } else if (item.type === 'section-footer') {
        element = renderSectionFooter?.({
          section: item.data.section,
          index: item.data.sectionIndex,
        });
      } else if (item.type === 'section-item') {
        element = renderItem?.({
          item: item.data.item,
          index: item.data.itemIndex,
          target: 'Cell',
        });
      } else if (item.type === 'item') {
        element =
          renderItem && data
            ? renderItem({ item: item.data, index, target: 'Cell' })
            : null;
      }

      if (parent) {
        return (
          <CellMeasurer
            cache={cache}
            columnIndex={columnIndex}
            rowIndex={rowIndex || index}
            key={key || index}
            parent={parent}
          >
            <div style={style} key={key || index}>
              {element as React.ReactNode}
            </div>
          </CellMeasurer>
        );
      }

      return (
        <div key={key || index} style={style}>
          {element as React.ReactNode}
        </div>
      );
    },
    [
      listData,
      HeaderElement,
      FooterElement,
      renderSectionHeader,
      renderSectionFooter,
      renderItem,
      data,
      cache,
    ],
  );

  const cellSizeAndPositionGetter = useCallback(
    ({ index }: { index: number }) => {
      const clientWidth = width / numColumns || 0;
      const clientHeight = clientWidth + 60;
      const row = Math.floor(index / numColumns);
      const col = index % numColumns;
      const x = col * clientWidth;
      const y = row * clientHeight;

      return {
        height: clientHeight,
        width: clientWidth,
        x,
        y,
      };
    },
    [numColumns, width],
  );

  const recompute = useCallback(
    ({
      numColumns: _numColumns,
      width: _width,
    }: {
      numColumns: number;
      width: number;
    }) => {
      cache.clearAll();
      if (_numColumns > 1 && _width) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (listRef.current as any)?.recomputeCellSizesAndPositions();
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (listRef.current as any)?.recomputeRowHeights();
      }
    },
    [cache],
  );

  useEffect(() => {
    if (keyExtractor) {
      return;
    }
    if (data?.length || sections?.length || numColumns || width || extraData) {
      recompute({ numColumns, width });
    }
  }, [
    data?.length,
    sections?.length,
    numColumns,
    width,
    extraData,
    recompute,
    keyExtractor,
  ]);

  const cellRenderer = useCallback(
    (params: CollectionCellRendererParams) => {
      const { index, key, style, isScrolling: isScrollingParam } = params;
      return rowRenderer({
        index,
        key: String(key),
        rowIndex: index,
        style,
        isScrolling: isScrollingParam,
        columnIndex: 0,
        isVisible: true,
        parent: listRef.current as any,
      });
    },
    [rowRenderer],
  );

  const noContentRenderer = useCallback(() => {
    return (
      <>
        {HeaderElement}
        {renderElement(ListEmptyComponent)}
        {FooterElement}
      </>
    );
  }, [HeaderElement, ListEmptyComponent, FooterElement]);

  const listProps = useMemo(() => {
    return {
      ref: listRef as any,
      autoHeight: true,
      height,
      data: listData,
      rowCount: listData.length,
      isScrolling: isVisible ? isScrolling : false,
      onScroll: isVisible ? onChildScroll : undefined,
      scrollTop: isVisible && listData.length > 0 ? scrollTop : 0,
      overscanRowCount: 10,
      deferredMeasurementCache: cache,
    };
  }, [
    height,
    listData,
    isVisible,
    isScrolling,
    onChildScroll,
    scrollTop,
    cache,
  ]);

  if (numColumns > 1) {
    return (
      <AutoSizer disableHeight>
        {({ width: autoSizerWidth }) => {
          return (
            <div
              ref={ref as React.RefObject<HTMLDivElement>}
              style={contentContainerStyle as any}
            >
              <Collection
                {...listProps}
                width={width}
                cellCount={listData.length}
                cellSizeAndPositionGetter={cellSizeAndPositionGetter}
                cellRenderer={cellRenderer}
                rowCount={Math.ceil(listData.length / numColumns)}
                noContentRenderer={noContentRenderer}
              />
            </div>
          );
        }}
      </AutoSizer>
    );
  }

  return (
    <AutoSizer disableHeight>
      {({ width: autoSizerWidth, height: autoSizerHeight }) => {
        return (
          <div
            ref={ref as React.RefObject<HTMLDivElement>}
            style={contentContainerStyle as any}
          >
            <VirtualizedList
              {...listProps}
              width={autoSizerWidth}
              height={autoSizerHeight || height || 400}
              rowHeight={cache.rowHeight}
              rowRenderer={rowRenderer}
              noRowsRenderer={noContentRenderer}
            />
          </div>
        );
      }}
    </AutoSizer>
  );
}
