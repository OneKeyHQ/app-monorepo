import {
  Fragment,
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
import { useStyle } from '@tamagui/core';
import { noop } from 'lodash';
// eslint-disable-next-line spellcheck/spell-checker
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import {
  OpacityDecorator,
  ScaleDecorator,
  ShadowDecorator,
} from 'react-native-draggable-flatlist';
import Animated from 'react-native-reanimated';
import { withStaticProperties } from 'tamagui';

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
    ...restProps
  }: ISortableListViewProps<T>,
  ref: ForwardedRef<ISortableListViewRef<T>> | undefined,
) {
  const reloadOnDragStart = useCallback(
    (params: DragStart) => {
      appEventBus.emit(EAppEventBusNames.onDragBeginInListView, undefined);
      onDragBegin?.(params.source.index);
    },
    [onDragBegin],
  );
  const reloadOnDragEnd = useCallback(
    (params: DropResult) => {
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
    [onDragEnd, data],
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
          isDragDisabled={!enabled}
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
                  dragProps={Object.keys(dragHandleProps).reduce((acc, key) => {
                    const reloadKey = key.replace(/^data-/, '');
                    acc[reloadKey] = dragHandleProps[key];
                    return acc;
                  }, {} as Record<string, any>)}
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
    ],
  );

  return (
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
        ignoreContainerClipping={false}
        renderClone={(provided, snapshot, rubric) => {
          return (
            <Item
              isDragging
              dragProps={{}}
              drag={noop}
              item={data[rubric.source.index]}
              renderItem={renderItem}
              provided={provided}
              getIndex={() => rubric.source.index}
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
              : getItemLayout?.(data, index)?.length ?? 0;
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
              {...(restProps as any)}
            />
          );
        }}
      </Droppable>
    </DragDropContext>
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
