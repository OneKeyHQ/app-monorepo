import { Fragment, forwardRef, useCallback, useMemo } from 'react';
import type { ForwardedRef, PropsWithChildren } from 'react';

import { useStyle } from '@tamagui/core';
// eslint-disable-next-line spellcheck/spell-checker
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import {
  OpacityDecorator,
  ScaleDecorator,
  ShadowDecorator,
} from 'react-native-draggable-flatlist';
import { withStaticProperties } from 'tamagui';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { ListView } from '../ListView';

import type { ISortableListViewProps, ISortableListViewRef } from './types';
import type { DragStart, DropResult } from 'react-beautiful-dnd';
import type { ListRenderItem, ListRenderItemInfo } from 'react-native';

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
  return <Fragment key={key}>{children}</Fragment>;
}

let lastIndexHeight: undefined | number;

function BaseSortableListView<T>(
  {
    data,
    renderItem,
    enabled = true,
    onDragBegin,
    onDragEnd,
    keyExtractor,
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
      const sourceItem = reloadData[params.source.index];
      reloadData.splice(params.source.index, 1);
      reloadData.splice(params.destination.index, 0, sourceItem);
      onDragEnd?.({
        data: reloadData,
        from: params.source.index,
        to: params.destination.index,
      });
    },
    [onDragEnd, data],
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
      const layout = getItemLayout?.(data, index);
      const isSticky =
        reallyStickyHeaderIndices.findIndex((x) => x === index) !== -1;
      const insertHeight = lastIndexHeight ?? 0;
      lastIndexHeight = layout?.length;
      return (
        <Draggable
          draggableId={`${id}`}
          index={index}
          isDragDisabled={!enabled}
        >
          {(provided) => {
            const dragHandleProps = (provided.dragHandleProps ?? {}) as Record<
              string,
              any
            >;
            lastIndexHeight = undefined;

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
                <div
                  ref={provided.innerRef}
                  {...provided.draggableProps}
                  style={{
                    ...provided.draggableProps.style,
                    ...(!isSticky
                      ? {
                          position: 'absolute',
                          top: (layout?.offset ?? 0) + contentPaddingTop,
                          height: layout?.length,
                          width: '100%',
                        }
                      : {}),
                  }}
                >
                  {renderItem({
                    item,
                    drag: () => {},
                    dragProps: Object.keys(dragHandleProps).reduce(
                      (acc, key) => {
                        const reloadKey = key.replace(/^data-/, '');
                        acc[reloadKey] = dragHandleProps[key];
                        return acc;
                      },
                      {} as Record<string, any>,
                    ),
                    getIndex: () => index,
                    isActive: false,
                  })}
                </div>
              </>
            );
          }}
        </Draggable>
      );
    },
    [
      renderItem,
      data,
      enabled,
      getItemLayout,
      keyExtractor,
      reallyStickyHeaderIndices,
      contentPaddingTop,
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
        renderClone={(provided, snapshot, rubric) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
          >
            {renderItem({
              item: data[rubric.source.index],
              drag: () => {},
              dragProps: {},
              getIndex: () => rubric.source.index,
              isActive: true,
            })}
          </div>
        )}
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
            overridePaddingBottom += getItemLayout(data, index).length;
          }
          return (
            <ListView
              // @ts-ignore
              ref={(_ref) => {
                if (typeof ref === 'function') {
                  ref(_ref);
                } else if (ref && 'current' in ref) {
                  ref.current = _ref;
                }
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                provided.innerRef(_ref?._listRef?._scrollRef);
              }}
              data={data}
              contentContainerStyle={{
                ...rawContentContainerStyle,
                paddingBottom: overridePaddingBottom,
              }}
              renderItem={reloadRenderItem as ListRenderItem<T>}
              CellRendererComponent={FragmentComponent}
              getItemLayout={getItemLayout}
              keyExtractor={keyExtractor}
              stickyHeaderIndices={stickyHeaderIndices}
              ListHeaderComponent={ListHeaderComponent}
              {...restProps}
            />
          );
        }}
      </Droppable>
    </DragDropContext>
  );
}

export { ISortableListViewProps, ISortableListViewRef };

export const SortableListView = withStaticProperties(
  forwardRef(BaseSortableListView) as typeof BaseSortableListView,
  {
    OpacityDecorator,
    ScaleDecorator,
    ShadowDecorator,
  },
);
