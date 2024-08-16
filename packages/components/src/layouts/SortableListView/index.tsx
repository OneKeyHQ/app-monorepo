import { forwardRef, useCallback } from 'react';
import type { ForwardedRef } from 'react';

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
import type {
  CellRendererProps,
  ListRenderItem,
  ListRenderItemInfo,
} from 'react-native';

function DragCellRendererComponent<T>({
  item,
  index,
  renderItem,
  enabled,
  keyExtractor,
  getItemLayout,
  contentContainerStyle,
  data,
}: {
  item: T;
  index: number;
  renderItem: ISortableListViewProps<T>['renderItem'];
  enabled: boolean;
  keyExtractor: ISortableListViewProps<T>['keyExtractor'];
  getItemLayout: ISortableListViewProps<T>['getItemLayout'];
  contentContainerStyle: Record<string, unknown>;
  data: T[];
}) {
  const id = keyExtractor?.(item, index);
  return (
    <Draggable draggableId={`${id}`} index={index} isDragDisabled={!enabled}>
      {(provided) => {
        const layout = getItemLayout?.(data, index);
        const paddingTop =
          contentContainerStyle?.paddingTop ??
          contentContainerStyle?.paddingVertical;
        const dragHandleProps = (provided.dragHandleProps ?? {}) as Record<
          string,
          any
        >;
        return (
          <>
            <div
              ref={provided.innerRef}
              {...provided.draggableProps}
              style={{
                ...provided.draggableProps.style,
                ...(item.type !== 'sectionHeader'
                  ? {
                      position: 'absolute',
                      top:
                        (layout?.offset ?? 0) +
                        (paddingTop ? parseInt(paddingTop as string, 10) : 0),
                      height: layout?.length,
                      width: '100%',
                    }
                  : {}),
              }}
            >
              {renderItem({
                item,
                drag: () => {},
                dragProps: Object.keys(dragHandleProps).reduce((acc, key) => {
                  const reloadKey = key.replace(/^data-/, '');
                  acc[reloadKey] = dragHandleProps[key];
                  return acc;
                }, {} as Record<string, any>),
                getIndex: () => 0,
                isActive: false,
              })}
            </div>
            {item.type === 'sectionFooter' ? (
              <div
                style={{
                  height:
                    layout.offset -
                    getItemLayout(
                      data,
                      data
                        .slice(0, index)
                        .findLastIndex(
                          (_item) => _item.type === 'sectionHeader',
                        ),
                    ).offset,
                }}
              />
            ) : null}
          </>
        );
      }}
    </Draggable>
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
    getItemLayout,
    contentContainerStyle = {},
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

  const reloadCellRendererComponent = useCallback(
    (props: CellRendererProps<T>) => (
      <DragCellRendererComponent
        {...props}
        enabled={enabled}
        getItemLayout={getItemLayout}
        contentContainerStyle={rawContentContainerStyle}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        data={data}
      />
    ),
    [
      enabled,
      getItemLayout,
      keyExtractor,
      data,
      renderItem,
      rawContentContainerStyle,
    ],
  );

  const reloadRenderItem = useCallback(
    (props: ListRenderItemInfo<T>) =>
      renderItem({
        ...props,
        getIndex: () => props.index,
        drag: () => {},
        dragProps: {},
        isActive: false,
      }),
    [renderItem],
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
        {(provided) => (
          <ListView
            ref={(_ref) => {
              if (ref) {
                ref.current = _ref;
              }
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              provided.innerRef(_ref?._listRef?._scrollRef);
            }}
            data={data}
            contentContainerStyle={rawContentContainerStyle}
            renderItem={reloadRenderItem as ListRenderItem<T>}
            CellRendererComponent={reloadCellRendererComponent}
            getItemLayout={getItemLayout}
            keyExtractor={keyExtractor}
            {...restProps}
          />
        )}
      </Droppable>
    </DragDropContext>
  );
}

export const SortableListView = withStaticProperties(
  forwardRef(BaseSortableListView) as typeof BaseSortableListView,
  {
    OpacityDecorator,
    ScaleDecorator,
    ShadowDecorator,
  },
);
