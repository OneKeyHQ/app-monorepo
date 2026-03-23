import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  CSSProperties,
  ForwardedRef,
  PropsWithChildren,
  ReactElement,
  RefObject,
} from 'react';

import { FlashList } from '@shopify/flash-list';
import { noop } from 'lodash';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import {
  OpacityDecorator,
  ScaleDecorator,
  ShadowDecorator,
} from 'react-native-draggable-flatlist';
import Animated from 'react-native-reanimated';

import {
  useStyle,
  withStaticProperties,
} from '@onekeyhq/components/src/shared/tamagui';
import { DRAG_CLONE_Z_INDEX } from '@onekeyhq/shared/src/consts/zIndexConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { ListView } from '../ListView';

import sortableListViewUtils from './sortableListViewUtils';

import type {
  IDragEndParams,
  ISortableListViewProps,
  ISortableListViewRef,
} from './types';
import type {
  DragStart,
  DraggableProvided,
  DropResult,
} from 'react-beautiful-dnd';
import type {
  CellRendererProps,
  ListRenderItem,
  ListRenderItemInfo,
} from 'react-native';

// eslint-disable-next-line unicorn/prefer-global-this
if (typeof window !== 'undefined') {
  Object.defineProperty(
    // eslint-disable-next-line unicorn/prefer-global-this
    window,
    '__react-beautiful-dnd-disable-dev-warnings',
    {
      value: true,
    },
  );
}

function FragmentComponent({
  key,
  children,
}: PropsWithChildren & { key?: React.Key }) {
  return <div key={key}>{children}</div>;
}

let lastIndexHeight: undefined | number;

const getBody = () => {
  return document.body;
};

function Item<T>({
  item,
  renderItem,
  provided,
  getIndex,
  isDragging,
  drag,
  dragProps,
  style,
}: {
  item: T;
  renderItem: ISortableListViewProps<T>['renderItem'];
  provided: DraggableProvided;
  getIndex: () => number;
  isDragging: boolean;
  dragProps: Record<string, any>;
  drag: () => void;
  style?: CSSProperties;
}) {
  const dragHandleProps = (provided.dragHandleProps ?? {}) as Record<
    string,
    any
  >;
  const draggableProps = {
    ...provided.draggableProps,
    ...dragHandleProps,
  };
  return (
    <div
      ref={provided.innerRef}
      {...draggableProps}
      style={{
        ...draggableProps.style,
        ...style,
      }}
    >
      {renderItem({
        item,
        drag,
        dragProps,
        getIndex,
        isActive: isDragging,
        index: getIndex(),
      })}
    </div>
  );
}

function CellContainer<T>({
  children,
  ...props
}: Omit<CellRendererProps<T>, 'ref'> & {
  ref: RefObject<HTMLDivElement>;
}) {
  const { ref, index } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    if (containerRef.current) {
      const clientHeight = containerRef.current?.clientHeight;
      if (clientHeight) {
        setHeight(clientHeight);
      }
      const resizeObserver = new ResizeObserver(() => {
        if (containerRef.current) {
          const changedHeight = containerRef.current.clientHeight;
          if (changedHeight !== height) {
            setHeight(changedHeight);
          }
        }
      });
      resizeObserver.observe(containerRef.current);
      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [height, index, ref]);

  return (
    <Animated.View
      {...(props as Record<string, any>)}
      style={
        height
          ? { ...(props as Record<string, any>).style, height }
          : props.style
      }
    >
      <div ref={containerRef as any}>{children}</div>
    </Animated.View>
  );
}

// Auto-scroll edge zone size (px) and max speed (px per frame)
const AUTOSCROLL_EDGE_PX = 80;
const AUTOSCROLL_MAX_SPEED_PX = 15;

function findScrollableAncestor(el: HTMLElement | null): HTMLElement | null {
  let current = el?.parentElement ?? null;
  while (current) {
    const { overflowY } = getComputedStyle(current);
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      current.scrollHeight > current.clientHeight
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function BaseSortableListView<T>(
  {
    data,
    renderItem,
    enabled = true,
    onDragBegin,
    onDragEnd,
    keyExtractor,
    useFlashList,
    getItemLayout,
    contentContainerStyle = {},
    stickyHeaderIndices = [],
    ListHeaderComponent,
    getItemDragDisabled,
    scrollEnabled = true,
    ...restProps
  }: ISortableListViewProps<T>,
  ref: ForwardedRef<ISortableListViewRef<T>> | undefined,
) {
  // Custom auto-scroll for when the list's own scroll is disabled
  // (e.g. inside Tabs.Container on web where outer container scrolls)
  const autoScrollRef = useRef<{
    rafId: number;
    mouseY: number;
    scrollContainer: HTMLElement | null;
    cleanup?: () => void;
  }>({ rafId: 0, mouseY: -1, scrollContainer: null });
  const listContainerRef = useRef<HTMLDivElement>(null);

  const stopAutoScroll = useCallback(() => {
    autoScrollRef.current.cleanup?.();
    autoScrollRef.current.cleanup = undefined;
  }, []);

  const startAutoScroll = useCallback(() => {
    stopAutoScroll(); // Clean up any previous session defensively
    if (scrollEnabled) return; // built-in auto-scroll works when scroll is enabled

    // Only auto-scroll if a real scrollable ancestor exists (e.g. Tabs.Container).
    // Do NOT fall back to document.documentElement — that would scroll the entire
    // page for lists that are simply non-scrollable (e.g. overflow:hidden pinned tabs).
    const container = findScrollableAncestor(listContainerRef.current);
    if (!container) return;
    autoScrollRef.current.mouseY = -1; // Reset stale position from previous session
    autoScrollRef.current.scrollContainer = container;

    const onMouseMove = (e: MouseEvent) => {
      autoScrollRef.current.mouseY = e.clientY;
    };
    // eslint-disable-next-line unicorn/prefer-global-this
    window.addEventListener('mousemove', onMouseMove);

    const tick = () => {
      const { mouseY, scrollContainer } = autoScrollRef.current;
      // Skip until we have a real mouse position from the mousemove listener
      if (!scrollContainer || mouseY < 0) {
        autoScrollRef.current.rafId = requestAnimationFrame(tick);
        return;
      }

      const rect = scrollContainer.getBoundingClientRect();
      const distToTop = mouseY - rect.top;
      const distToBottom = rect.bottom - mouseY;

      if (distToTop < AUTOSCROLL_EDGE_PX && distToTop >= 0) {
        const ratio = 1 - distToTop / AUTOSCROLL_EDGE_PX;
        scrollContainer.scrollTop -= Math.ceil(ratio * AUTOSCROLL_MAX_SPEED_PX);
      } else if (distToBottom < AUTOSCROLL_EDGE_PX && distToBottom >= 0) {
        const ratio = 1 - distToBottom / AUTOSCROLL_EDGE_PX;
        scrollContainer.scrollTop += Math.ceil(ratio * AUTOSCROLL_MAX_SPEED_PX);
      }

      autoScrollRef.current.rafId = requestAnimationFrame(tick);
    };
    autoScrollRef.current.rafId = requestAnimationFrame(tick);

    autoScrollRef.current.cleanup = () => {
      // eslint-disable-next-line unicorn/prefer-global-this
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(autoScrollRef.current.rafId);
      autoScrollRef.current.scrollContainer = null;
    };
  }, [scrollEnabled, stopAutoScroll]);

  const reloadOnDragStart = useCallback(
    (params: DragStart) => {
      appEventBus.emit(EAppEventBusNames.onDragBeginInListView, undefined);
      onDragBegin?.(params.source.index);
      startAutoScroll();
    },
    [onDragBegin, startAutoScroll],
  );
  const reloadOnDragEnd = useCallback(
    (params: DropResult) => {
      stopAutoScroll();
      appEventBus.emit(EAppEventBusNames.onDragEndInListView, undefined);
      if (!params.destination) {
        return;
      }
      const reloadData = [...data];
      const dragItem: T = reloadData[params.source.index];
      reloadData.splice(params.source.index, 1);
      reloadData.splice(params.destination.index, 0, dragItem);
      const from = params.source.index;
      const to = params.destination.index;

      const nativeDragParams: IDragEndParams<T> = {
        data: reloadData,
        from,
        to,
      };

      const p =
        sortableListViewUtils.convertToDragEndParamsWithItem(nativeDragParams);

      onDragEnd?.(p);
    },
    [onDragEnd, data, stopAutoScroll],
  );

  useEffect(
    () => () => {
      lastIndexHeight = undefined;
    },
    [],
  );

  const rawContentContainerStyle = useStyle(
    contentContainerStyle as Record<string, unknown>,
    {
      resolveValues: 'value',
    },
  );

  const reallyStickyHeaderIndices = useMemo(
    () =>
      (stickyHeaderIndices ?? []).map((index) =>
        ListHeaderComponent ? index - 1 : index,
      ),
    [stickyHeaderIndices, ListHeaderComponent],
  );

  const contentPaddingTop = useMemo(() => {
    const paddingTop =
      rawContentContainerStyle?.paddingTop ??
      rawContentContainerStyle?.paddingVertical;
    return paddingTop ? parseInt(paddingTop as string, 10) : 0;
  }, [
    rawContentContainerStyle?.paddingTop,
    rawContentContainerStyle?.paddingVertical,
  ]);

  const reloadRenderItem = useCallback(
    (props: ListRenderItemInfo<T>) => {
      const { item, index } = props;
      const id = keyExtractor?.(item, index);
      const draggableId = id ? String(id) : String(index);
      const layout = useFlashList ? undefined : getItemLayout?.(data, index);
      const isSticky =
        reallyStickyHeaderIndices.findIndex((x) => x === index) !== -1;
      const insertHeight = lastIndexHeight ?? 0;
      lastIndexHeight = layout?.length;
      return (
        <Draggable
          // Setting key is crucial for react-beautiful-dnd to properly track and refresh
          // the number of items in the list when the data changes
          key={draggableId}
          draggableId={draggableId}
          index={index}
          isDragDisabled={
            !enabled || (getItemDragDisabled?.(item, index) ?? false)
          }
        >
          {(provided) => {
            lastIndexHeight = undefined;
            const dragHandleProps = (provided.dragHandleProps ?? {}) as Record<
              string,
              any
            >;
            return (
              <>
                {!isSticky ? (
                  <div
                    style={
                      layout
                        ? {
                            height: layout.length + insertHeight,
                          }
                        : {}
                    }
                  />
                ) : null}
                <Item
                  style={
                    !isSticky
                      ? {
                          position: useFlashList ? undefined : 'absolute',
                          top: (layout?.offset ?? 0) + (contentPaddingTop ?? 0),
                          height: useFlashList ? undefined : layout?.length,
                          width: '100%',
                        }
                      : {}
                  }
                  drag={noop}
                  dragProps={Object.keys(dragHandleProps).reduce(
                    (acc, key) => {
                      const reloadKey = key.replace(/^data-/, '');
                      acc[reloadKey] = dragHandleProps[key];
                      return acc;
                    },
                    {} as Record<string, any>,
                  )}
                  isDragging={false}
                  item={item}
                  getIndex={() => index}
                  renderItem={renderItem as any}
                  provided={provided}
                />
              </>
            );
          }}
        </Draggable>
      );
    },
    [
      keyExtractor,
      useFlashList,
      getItemLayout,
      data,
      reallyStickyHeaderIndices,
      enabled,
      contentPaddingTop,
      renderItem,
      getItemDragDisabled,
    ],
  );

  // Cleanup auto-scroll on unmount
  useEffect(() => () => stopAutoScroll(), [stopAutoScroll]);

  return (
    <div
      ref={listContainerRef}
      style={{
        display: 'flex',
        flex: 1,
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <DragDropContext
        onDragStart={reloadOnDragStart}
        onDragEnd={reloadOnDragEnd}
      >
        <Droppable
          droppableId="droppable"
          mode="virtual"
          type="DEFAULT"
          direction="vertical"
          isDropDisabled={false}
          isCombineEnabled={false}
          ignoreContainerClipping={!scrollEnabled}
          renderClone={(provided, snapshot, rubric) => {
            const isDropping = snapshot.isDropAnimating;
            return (
              <Item
                isDragging={!isDropping}
                dragProps={{}}
                drag={noop}
                item={data[rubric.source.index]}
                renderItem={renderItem}
                provided={provided}
                getIndex={() => rubric.source.index}
                style={{
                  boxShadow: isDropping
                    ? 'none'
                    : '0 4px 24px rgba(0, 0, 0, 0.12)',
                  borderRadius: 12,
                  // Ensure clone renders above Dialog/Sheet overlays
                  zIndex: DRAG_CLONE_Z_INDEX,
                  // Speed up drop animation
                  ...(isDropping
                    ? {
                        transition:
                          'transform 0.08s ease, box-shadow 0.08s ease',
                      }
                    : {}),
                }}
              />
            );
          }}
          getContainerForClone={getBody}
        >
          {(provided, snapshot) => {
            const paddingBottom = (rawContentContainerStyle?.paddingBottom ??
              rawContentContainerStyle?.paddingVertical) as string;
            let overridePaddingBottom = parseInt(paddingBottom ?? '0', 10);
            if (snapshot?.draggingFromThisWith) {
              const index = data.findIndex(
                (item, _index) =>
                  keyExtractor(item, _index) === snapshot.draggingFromThisWith,
              );
              overridePaddingBottom += useFlashList
                ? 0
                : (getItemLayout?.(data, index)?.length ?? 0);
            }
            const ListViewComponent = useFlashList ? FlashList : ListView;
            return (
              <ListViewComponent
                ref={(_ref: any) => {
                  if (_ref) {
                    if (typeof ref === 'function') {
                      ref(_ref);
                    } else if (ref && 'current' in ref) {
                      ref.current = _ref;
                    }

                    // When scroll is disabled (e.g. inside Tabs.Container),
                    // point react-beautiful-dnd to the actual scrolling ancestor
                    // so it correctly calculates drop positions during drag.
                    if (!scrollEnabled && listContainerRef.current) {
                      const scrollAncestor = findScrollableAncestor(
                        listContainerRef.current,
                      );
                      if (scrollAncestor) {
                        provided.innerRef(scrollAncestor);
                        return;
                      }
                    }

                    // FlashList
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    if (_ref?.getNativeScrollRef) {
                      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                      const scrollRef = _ref?.getNativeScrollRef();
                      if (scrollRef) {
                        provided.innerRef(scrollRef);
                      }
                    }

                    // FlatList
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    if (_ref?._listRef?._scrollRef) {
                      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                      provided.innerRef(_ref?._listRef?._scrollRef);
                    }
                  }
                }}
                data={data}
                contentContainerStyle={{
                  ...rawContentContainerStyle,
                  paddingBottom: overridePaddingBottom,
                }}
                renderItem={reloadRenderItem as ListRenderItem<T>}
                CellRendererComponent={
                  useFlashList ? CellContainer : FragmentComponent
                }
                getItemLayout={useFlashList ? undefined : getItemLayout}
                keyExtractor={keyExtractor}
                stickyHeaderIndices={stickyHeaderIndices}
                ListHeaderComponent={ListHeaderComponent}
                scrollEnabled={scrollEnabled}
                {...(restProps as any)}
              />
            );
          }}
        </Droppable>
      </DragDropContext>
    </div>
  );
}

export const SortableListView = withStaticProperties(
  forwardRef(BaseSortableListView) as <T>(
    props: ISortableListViewProps<T> & {
      ref?: ForwardedRef<ISortableListViewRef<T>>;
    },
  ) => ReactElement | null,
  {
    OpacityDecorator,
    ScaleDecorator,
    ShadowDecorator,
  },
);

export * from './types';
