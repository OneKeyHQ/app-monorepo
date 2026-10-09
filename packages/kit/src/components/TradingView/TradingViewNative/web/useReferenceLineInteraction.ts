import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { PointerEvent, RefObject } from 'react';

import { TRADING_VIEW_NATIVE_CHART_TOP_PADDING } from '../chartConstants';
import {
  getTradingViewNativePriceAtY,
  getTradingViewNativePriceY,
} from '../utils/chartLayout';

import type { IDrawingProjection } from '../drawings/model';
import type {
  ITradingViewNativeChartLeafComponent,
  ITradingViewNativeReferenceLineAction,
} from '../types';
import type { ITradingViewNativeReferenceLineHitRegion } from '../utils/chartComponentScene';

type ILinePointer = {
  target: HTMLCanvasElement;
  pointerId: number;
  hit: ITradingViewNativeReferenceLineHitRegion;
  projection: IDrawingProjection;
  startClientY: number;
  startClientX: number;
  price: number;
  moved: boolean;
};

function containsPoint(
  rect: ITradingViewNativeReferenceLineHitRegion['rect'],
  x: number,
  y: number,
) {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

export function useReferenceLineInteraction({
  components,
  enabled,
  hitRegionsRef,
  projectionRef,
  redrawRef,
  onAction,
}: {
  components: readonly ITradingViewNativeChartLeafComponent[];
  enabled: boolean;
  hitRegionsRef: RefObject<ITradingViewNativeReferenceLineHitRegion[]>;
  projectionRef: RefObject<IDrawingProjection | null>;
  redrawRef: RefObject<() => void>;
  onAction?: (action: ITradingViewNativeReferenceLineAction) => Promise<void>;
}) {
  const pointerRef = useRef<ILinePointer | null>(null);
  const cancel = useCallback(() => {
    const pointer = pointerRef.current;
    if (!pointer) return;
    pointerRef.current = null;
    if (pointer.target.hasPointerCapture(pointer.pointerId)) {
      pointer.target.releasePointerCapture(pointer.pointerId);
    }
    redrawRef.current();
  }, [redrawRef]);
  useLayoutEffect(() => {
    const pointer = pointerRef.current;
    if (
      pointer &&
      (!enabled ||
        !components.some(
          (component) =>
            component.id === pointer.hit.id &&
            component.type === 'referenceLine' &&
            component.props.interactive &&
            !component.props.pending &&
            (pointer.hit.action === 'drag'
              ? component.props.draggable
              : component.props.cancelable) &&
            component.props.anchor.price === pointer.hit.price,
        ))
    )
      cancel();
  }, [components, enabled, cancel]);
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && pointerRef.current) {
        event.preventDefault();
        cancel();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      cancel();
    };
  }, [enabled, cancel]);

  const getComponents = useCallback(() => {
    const pointer = pointerRef.current;
    if (!pointer?.moved || pointer.hit.action !== 'drag') return components;
    return components.map((component) =>
      component.id === pointer.hit.id && component.type === 'referenceLine'
        ? {
            ...component,
            props: {
              ...component.props,
              anchor: { ...component.props.anchor, price: pointer.price },
            },
          }
        : component,
    );
  }, [components]);

  const hitTest = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (!enabled || !onAction) return undefined;
      const rect = event.currentTarget.getBoundingClientRect();
      return hitRegionsRef.current.findLast((hit) =>
        containsPoint(
          hit.rect,
          event.clientX - rect.left,
          event.clientY - rect.top,
        ),
      );
    },
    [enabled, onAction, hitRegionsRef],
  );
  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (pointerRef.current) return true;
      const hit = hitTest(event);
      const projection = projectionRef.current;
      const component = components.find((item) => item.id === hit?.id);
      if (
        event.button !== 0 ||
        !event.isPrimary ||
        !hit ||
        !projection ||
        component?.type !== 'referenceLine' ||
        component.props.pending ||
        !component.props.interactive ||
        component.props.anchor.price !== hit.price ||
        (hit.action === 'drag'
          ? !component.props.draggable
          : !component.props.cancelable)
      )
        return false;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
      pointerRef.current = {
        target: event.currentTarget,
        pointerId: event.pointerId,
        hit,
        projection,
        startClientY: event.clientY,
        startClientX: event.clientX,
        price: hit.price,
        moved: false,
      };
      return true;
    },
    [components, hitTest, projectionRef],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const pointer = pointerRef.current;
      if (!pointer) {
        const hit = hitTest(event);
        if (!hit) return false;
        event.currentTarget.style.cursor =
          hit.action === 'cancel' ? 'pointer' : 'ns-resize';
        return true;
      }
      if (pointer.pointerId !== event.pointerId) return true;
      event.preventDefault();
      if (
        Math.hypot(
          event.clientX - pointer.startClientX,
          event.clientY - pointer.startClientY,
        ) >= 3
      )
        pointer.moved = true;
      if (pointer.hit.action === 'drag' && pointer.moved) {
        const layout = pointer.projection.layout;
        const startY = getTradingViewNativePriceY(pointer.hit.price, layout);
        const y = Math.min(
          TRADING_VIEW_NATIVE_CHART_TOP_PADDING + layout.priceChartHeight,
          Math.max(
            TRADING_VIEW_NATIVE_CHART_TOP_PADDING,
            startY + event.clientY - pointer.startClientY,
          ),
        );
        const price = getTradingViewNativePriceAtY({ ...layout, y });
        if (price !== null && Number.isFinite(price) && price > 0)
          pointer.price = price;
        event.currentTarget.style.cursor = 'ns-resize';
        redrawRef.current();
      }
      return true;
    },
    [hitTest, redrawRef],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const pointer = pointerRef.current;
      if (!pointer || pointer.pointerId !== event.pointerId) return false;
      const component = components.find((item) => item.id === pointer.hit.id);
      const canSubmit =
        enabled &&
        event.type === 'pointerup' &&
        component?.type === 'referenceLine' &&
        component.props.interactive &&
        !component.props.pending &&
        (pointer.hit.action === 'drag'
          ? component.props.draggable
          : component.props.cancelable) &&
        component.props.anchor.price === pointer.hit.price;
      cancel();
      if (!canSubmit || !onAction) return true;
      let action: ITradingViewNativeReferenceLineAction | undefined;
      if (
        pointer.hit.action === 'drag' &&
        pointer.moved &&
        pointer.price !== pointer.hit.price
      ) {
        action = {
          type: 'priceChange',
          id: pointer.hit.id,
          originalPrice: pointer.hit.price,
          price: pointer.price,
        };
      } else if (pointer.hit.action === 'cancel' && !pointer.moved) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          containsPoint(
            pointer.hit.rect,
            event.clientX - rect.left,
            event.clientY - rect.top,
          )
        )
          action = {
            type: 'cancel',
            id: pointer.hit.id,
            originalPrice: pointer.hit.price,
          };
      }
      if (action) {
        // The owner handles trading errors and restores the authoritative line list.
        void onAction(action).catch(() => undefined);
      }
      return true;
    },
    [cancel, components, enabled, onAction],
  );

  const isInteracting = useCallback(() => pointerRef.current !== null, []);
  const getPriceRange = useCallback(() => {
    const pointer = pointerRef.current;
    return pointer?.hit.action === 'drag' ? pointer.projection.layout : null;
  }, []);

  return {
    getComponents,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    isInteracting,
    getPriceRange,
  };
}
