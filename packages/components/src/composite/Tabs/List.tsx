/* eslint-disable react/prop-types */
import type {
  CSSProperties,
  ComponentType,
  MouseEventHandler,
  ReactNode,
} from 'react';
import {
  isValidElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

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
import { parseCssSize } from './utils';

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
  ref: parentRef,
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
  onEndReached,
  onEndReachedThreshold = 0.5,
  onMouseEnter,
  onMouseLeave,
}: Omit<IListProps<Item>, 'ListEmptyComponent'> &
  Omit<ISectionListProps<Item>, 'ListEmptyComponent'> & {
    ListEmptyComponent?: ReactNode | ComponentType<any>;
    contentContainerStyle?: CSSProperties;
    horizontalPadding?: number;
    onEndReached?: () => void;
    onEndReachedThreshold?: number;
    onMouseEnter?: MouseEventHandler<HTMLDivElement>;
    onMouseLeave?: MouseEventHandler<HTMLDivElement>;
  }) {
  const {
    registerChild,
    height,
    width: tabWidth,
    isScrolling,
    onChildScroll,
    scrollTop,
    updateListContainerHeight,
  } = useTabsScrollContext();

  const width = useMemo(() => {
    return tabWidth - horizontalPadding;
  }, [tabWidth, horizontalPadding]);
  const currentTabName = useTabNameContext();
  const { focusedTab } = useTabsContext();

  const focusedTabValue = useConvertAnimatedToValue(focusedTab, '');

  const ref = useRef<Element>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>();

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

  // Use ref to access current listData in keyMapper without recreating cache
  const listDataRef = useRef(listData);
  listDataRef.current = listData;

  // Cell measurement cache for react-virtualized list optimization
  // Uses ref for listData so the cache is NOT recreated when data changes,
  // preserving measured row heights across pagination/data updates.
  const cache = useMemo(
    () =>
      new CellMeasurerCache({
        fixedWidth: true,
        defaultHeight: 60,
        keyMapper: (rowIndex, columnIndex) => {
          if (keyExtractor) {
            const item = listDataRef.current[rowIndex];
            if (
              item?.type === 'header' ||
              item?.type === 'footer' ||
              item?.type === 'section-header' ||
              item?.type === 'section-footer'
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
    [keyExtractor],
  );

  const isVisible = useMemo(() => {
    return focusedTabValue === currentTabName;
  }, [focusedTabValue, currentTabName]);

  const prevIsVisibleRef = useRef(isVisible);

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

  const estimateContentHeight = useCallback(() => {
    if (!listData.length) {
      return 0;
    }

    if (numColumns > 1) {
      const clientWidth = width / numColumns || 0;
      const clientHeight = clientWidth + 60;
      return Math.ceil(listData.length / numColumns) * clientHeight;
    }

    return listData.reduce((total, _item, index) => {
      const rowHeight = Number(cache.rowHeight({ index }) ?? 60);
      return total + (Number.isFinite(rowHeight) ? rowHeight : 60);
    }, 0);
  }, [cache, listData, numColumns, width]);

  const updateMeasuredContentHeight = useCallback(() => {
    if (!listData.length) {
      setContentHeight(undefined);
      updateListContainerHeight?.();
      return;
    }

    const htmlElement = ref.current as HTMLElement | null;
    const style =
      htmlElement && typeof globalThis.getComputedStyle === 'function'
        ? globalThis.getComputedStyle(htmlElement)
        : undefined;
    const verticalSpacing = style
      ? parseCssSize(style.marginTop) +
        parseCssSize(style.marginBottom) +
        parseCssSize(style.paddingTop) +
        parseCssSize(style.paddingBottom)
      : 0;
    const virtualizedInnerElement = htmlElement?.querySelector(
      [
        '.ReactVirtualized__Grid__innerScrollContainer',
        '.ReactVirtualized__Collection__innerScrollContainer',
      ].join(','),
    ) as HTMLElement | null;
    const virtualizedHeight = virtualizedInnerElement
      ? Math.max(
          virtualizedInnerElement.scrollHeight || 0,
          virtualizedInnerElement.clientHeight || 0,
          virtualizedInnerElement.getBoundingClientRect().height || 0,
        )
      : 0;
    const nextHeight =
      Math.max(virtualizedHeight, estimateContentHeight()) + verticalSpacing;

    setContentHeight((previousHeight) =>
      Math.abs((previousHeight ?? 0) - nextHeight) > 1
        ? nextHeight
        : previousHeight,
    );
    updateListContainerHeight?.();
  }, [estimateContentHeight, listData.length, updateListContainerHeight]);

  const scheduleListContainerHeightUpdate = useCallback(() => {
    let timerShort: ReturnType<typeof setTimeout> | undefined;
    let timerLong: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      updateMeasuredContentHeight();
      timerShort = setTimeout(updateMeasuredContentHeight, 100);
      timerLong = setTimeout(updateMeasuredContentHeight, 350);
    });

    return () => {
      cancelAnimationFrame(frame);
      if (timerShort) {
        clearTimeout(timerShort);
      }
      if (timerLong) {
        clearTimeout(timerLong);
      }
    };
  }, [updateMeasuredContentHeight]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    if (keyExtractor) {
      // With keyExtractor, the cache is stable (not recreated on data changes).
      // Only recompute row positions for new rows without clearing measured heights.
      if (data?.length || sections?.length) {
        if (numColumns > 1 && width) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          (listRef.current as any)?.recomputeCellSizesAndPositions();
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          (listRef.current as any)?.recomputeRowHeights();
        }
      }
      cleanup = scheduleListContainerHeightUpdate();
      return cleanup;
    }
    if (data?.length || sections?.length || numColumns || width || extraData) {
      recompute({ numColumns, width });
      cleanup = scheduleListContainerHeightUpdate();
    }
    return cleanup;
  }, [
    data?.length,
    sections?.length,
    numColumns,
    width,
    extraData,
    recompute,
    keyExtractor,
    scheduleListContainerHeightUpdate,
  ]);

  useEffect(() => {
    return scheduleListContainerHeightUpdate();
  }, [
    extraData,
    isVisible,
    listData.length,
    scheduleListContainerHeightUpdate,
  ]);

  // Recompute row heights when tab becomes visible to fix stale
  // CellMeasurer cache from contentVisibility:hidden optimization.
  // Uses double-rAF to ensure the browser has completed layout after
  // contentVisibility transitions to 'visible' before re-measuring.
  useEffect(() => {
    const wasHidden = !prevIsVisibleRef.current;
    prevIsVisibleRef.current = isVisible;
    if (isVisible && wasHidden && listData.length > 0) {
      let cancelled = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) {
            recompute({ numColumns, width });
          }
        });
      });
      return () => {
        cancelled = true;
      };
    }
  }, [isVisible, listData.length, recompute, numColumns, width]);

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

  // Imperative `recomputeLayout` runs outside React's effect lifecycle, so the
  // rAF + setTimeout chain it spawns can outlive the component. We hold the
  // latest cleanup in a ref and clear it on unmount (and before scheduling a
  // new one) to avoid `setContentHeight` firing on an unmounted instance.
  const pendingScheduleCleanupRef = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    return () => {
      pendingScheduleCleanupRef.current?.();
      pendingScheduleCleanupRef.current = undefined;
    };
  }, []);

  useImperativeHandle(
    parentRef as any,
    () => ({
      recomputeLayout: () => {
        recompute({ numColumns, width });
        pendingScheduleCleanupRef.current?.();
        pendingScheduleCleanupRef.current = scheduleListContainerHeightUpdate();
      },
    }),
    [numColumns, recompute, scheduleListContainerHeightUpdate, width],
  );

  const handleScroll = useCallback(
    (params: {
      scrollTop: number;
      scrollHeight: number;
      clientHeight: number;
      [key: string]: any;
    }) => {
      if (!isVisible) return;

      onChildScroll?.(params);

      // Check if we've reached the end for infinite scroll
      if (onEndReached && params && typeof params.scrollTop === 'number') {
        const {
          scrollTop: currentScrollTop,
          scrollHeight,
          clientHeight,
        } = params;
        const threshold = onEndReachedThreshold || 0.5;
        const scrollPosition = (currentScrollTop + clientHeight) / scrollHeight;

        if (scrollPosition >= 1 - threshold) {
          onEndReached();
        }
      }
    },
    [isVisible, onChildScroll, onEndReached, onEndReachedThreshold],
  );

  const listProps = useMemo(() => {
    return {
      ref: listRef as any,
      autoHeight: true,
      height,
      data: listData,
      rowCount: listData.length,
      isScrolling: isVisible ? isScrolling : false,
      onScroll: isVisible ? handleScroll : undefined,
      scrollTop: isVisible && listData.length > 0 ? scrollTop : 0,
      overscanRowCount: 10,
      deferredMeasurementCache: cache,
    };
  }, [
    height,
    listData,
    isVisible,
    isScrolling,
    handleScroll,
    scrollTop,
    cache,
  ]);

  const baseContentContainerStyle = contentContainerStyle as unknown as
    | CSSProperties
    | undefined;
  const resolvedContentContainerStyle = useMemo<CSSProperties | undefined>(
    () =>
      contentHeight
        ? { ...baseContentContainerStyle, minHeight: contentHeight }
        : baseContentContainerStyle,
    [baseContentContainerStyle, contentHeight],
  );

  if (numColumns > 1) {
    return (
      <AutoSizer disableHeight>
        {({ width: _autoSizerWidth }) => {
          return (
            <div
              ref={ref as React.RefObject<HTMLDivElement>}
              style={resolvedContentContainerStyle as any}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
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
            style={resolvedContentContainerStyle as any}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
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
