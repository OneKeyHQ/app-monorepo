import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { getDataWindowSnapshot } from '../drawings/dataWindow';
import { hitTestDrawings } from '../drawings/geometry';
import { isInDrawingPane } from '../drawings/model';
import { useChartDrawings } from '../drawings/useChartDrawings';

import type { ITradingViewNativeChartRuntime } from './chartRuntime';
import type { IDrawingProjection, IDrawingTool } from '../drawings/model';
import type { IDrawingRenderState } from '../drawings/useChartDrawings';
import type { ITradingViewNativeIndicatorSeries } from '../utils/chartIndicators';
import type { ITradingViewNativeChartLayout } from '../utils/chartLayout';
import type { ITradingViewNativeChartRuntimeViewport } from '../utils/chartRuntime';
import type { ITradingViewNativeSubIndicatorRenderPane } from '../utils/subIndicatorRender';
import type { SharedValue } from 'react-native-reanimated';

export type INativeDrawingProjection = {
  layout: ITradingViewNativeChartLayout | null;
  viewport: ITradingViewNativeChartRuntimeViewport;
  pointIndex: number | null;
};

type INativeDrawingState = IDrawingRenderState & {
  tool: IDrawingTool | 'cursor';
  ready: boolean;
  locked: boolean;
};

export function useNativeChartDrawings({
  enabled,
  points,
  indicatorSeries,
  subIndicatorPanes,
  storageKey,
  chartRuntime,
  decayOffset,
}: {
  enabled: boolean;
  points: IMarketTokenKLineDataPoint[];
  indicatorSeries: ITradingViewNativeIndicatorSeries[];
  subIndicatorPanes: readonly ITradingViewNativeSubIndicatorRenderPane[];
  storageKey?: string;
  chartRuntime: SharedValue<ITradingViewNativeChartRuntime>;
  decayOffset: SharedValue<number>;
}) {
  const projectionRef = useRef<IDrawingProjection | null>(null);
  const redrawRef = useRef<() => void>(() => undefined);
  const controller = useChartDrawings({
    enabled,
    projectionRef,
    redrawRef,
    storageKey,
  });
  const controllerRef = useRef(controller);
  controllerRef.current = controller;
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const projection = useSharedValue<INativeDrawingProjection | null>(null);
  const drawings = useSharedValue<INativeDrawingState>({
    drawings: [],
    selectedId: null,
    selectedIds: [],
    tool: 'cursor',
    ready: false,
    locked: false,
  });
  const pointerId = useSharedValue<number | null>(null);
  const { getRenderState, state, updateData } = controller;
  const syncDrawings = useCallback(() => {
    const model = controllerRef.current;
    drawings.value = {
      ...model.getRenderState(),
      tool: model.state.tool,
      ready: model.state.ready,
      locked: model.state.locked,
    };
  }, [drawings]);
  useLayoutEffect(() => {
    redrawRef.current = syncDrawings;
    syncDrawings();
  }, [syncDrawings, getRenderState, state.ready]);

  const handlePointer = useCallback(
    (
      type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
      x: number,
      y: number,
      id: number,
      metadata: INativeDrawingProjection,
      interval: number,
    ) => {
      if (!metadata.layout || !pointsRef.current.length) return;
      projectionRef.current = {
        layout: metadata.layout,
        viewport: metadata.viewport,
        points: pointsRef.current,
        interval,
      };
      const event = {
        type,
        x,
        y,
        pointerId: id,
        button: 0,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        touch: true,
      };
      const model = controllerRef.current;
      if (type === 'pointerdown') model.onPointerDown(event);
      else if (type === 'pointermove') model.onPointerMove(event);
      else model.onPointerUp(event);
    },
    [],
  );
  const cancel = useCallback(() => controllerRef.current.cancel(), []);
  const gesture = useMemo(
    () =>
      Gesture.Manual()
        .enabled(enabled)
        .onTouchesDown((event, manager) => {
          'worklet';
          if (event.numberOfTouches > 1) {
            if (pointerId.value !== null) scheduleOnRN(cancel);
            pointerId.value = null;
            manager.fail();
            return;
          }
          const point = event.changedTouches[0];
          const metadata = projection.value;
          const model = drawings.value;
          const runtime = chartRuntime.value;
          if (
            !point ||
            !model.ready ||
            !metadata?.layout ||
            !runtime.points.length
          ) {
            manager.fail();
            return;
          }
          const drawingProjection = {
            layout: metadata.layout,
            viewport: metadata.viewport,
            points: runtime.points,
            interval: runtime.candleIntervalSeconds,
          };
          if (!isInDrawingPane(point, drawingProjection)) {
            manager.fail();
            return;
          }
          const hit =
            model.tool === 'cursor'
              ? hitTestDrawings(
                  model.drawings,
                  point,
                  drawingProjection,
                  model.selectedId,
                  18,
                )
              : null;
          if (
            model.tool === 'cursor' &&
            (!hit || model.locked || hit.drawing.locked)
          ) {
            scheduleOnRN(
              handlePointer,
              'pointerdown',
              point.x,
              point.y,
              point.id,
              metadata,
              runtime.candleIntervalSeconds,
            );
            manager.fail();
            return;
          }
          cancelAnimation(decayOffset);
          pointerId.value = point.id;
          manager.activate();
          scheduleOnRN(
            handlePointer,
            'pointerdown',
            point.x,
            point.y,
            point.id,
            metadata,
            runtime.candleIntervalSeconds,
          );
        })
        .onTouchesMove((event) => {
          'worklet';
          const point = event.changedTouches.find(
            (touch) => touch.id === pointerId.value,
          );
          const metadata = projection.value;
          if (point && metadata)
            scheduleOnRN(
              handlePointer,
              'pointermove',
              point.x,
              point.y,
              point.id,
              metadata,
              chartRuntime.value.candleIntervalSeconds,
            );
        })
        .onTouchesUp((event, manager) => {
          'worklet';
          const point = event.changedTouches.find(
            (touch) => touch.id === pointerId.value,
          );
          const metadata = projection.value;
          if (point && metadata)
            scheduleOnRN(
              handlePointer,
              'pointerup',
              point.x,
              point.y,
              point.id,
              metadata,
              chartRuntime.value.candleIntervalSeconds,
            );
          pointerId.value = null;
          manager.end();
        })
        .onFinalize((_event, success) => {
          'worklet';
          if (!success && pointerId.value !== null) scheduleOnRN(cancel);
          pointerId.value = null;
        }),
    [
      cancel,
      chartRuntime,
      decayOffset,
      drawings,
      enabled,
      handlePointer,
      pointerId,
      projection,
    ],
  );

  const dataIndex = useRef<number | null>(null);
  const dataInputs = useRef({ points, indicatorSeries, subIndicatorPanes });
  dataInputs.current = { points, indicatorSeries, subIndicatorPanes };
  const updateDataIndex = useCallback(
    (pointIndex: number | null) => {
      if (!enabled) return;
      dataIndex.current = pointIndex;
      updateData(getDataWindowSnapshot({ ...dataInputs.current, pointIndex }));
    },
    [enabled, updateData],
  );
  useAnimatedReaction(
    () => projection.value?.pointIndex ?? null,
    (next, previous) => {
      'worklet';
      if (next !== previous) scheduleOnRN(updateDataIndex, next);
    },
    [updateDataIndex],
  );
  useEffect(() => {
    updateDataIndex(dataIndex.current);
  }, [points, indicatorSeries, subIndicatorPanes, updateDataIndex]);
  return { controller, drawings, projection, gesture };
}
