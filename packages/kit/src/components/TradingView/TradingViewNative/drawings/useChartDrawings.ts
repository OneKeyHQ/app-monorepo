import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { RefObject } from 'react';

import {
  readChartLocalStorage,
  writeChartLocalStorage,
} from '../chartLocalStorage';

import { hitTestDrawings } from './geometry';
import {
  DEFAULT_DRAWING_STYLE,
  DRAWING_TOOLS,
  MAX_DRAWINGS,
  MAX_DRAWING_POINTS,
  changeDrawingHistory,
  constrainDrawingPoint,
  drawingPointToScreen,
  isFreehandTool,
  isInDrawingPane,
  moveDrawing,
  parseDrawings,
  screenToDrawingPoint,
} from './model';

import type { IDataWindowSnapshot } from './dataWindow';
import type {
  IDrawing,
  IDrawingHistory,
  IDrawingPoint,
  IDrawingProjection,
  IDrawingStyle,
  IDrawingTool,
  IScreenPoint,
} from './model';

export type IDrawingPointerEvent = IScreenPoint & {
  type: string;
  touch?: boolean;
  pointerId: number;
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  focus?: () => void;
  capture?: () => void;
  release?: () => void;
  setCursor?: (cursor: string) => void;
  preventDefault?: () => void;
};
export type IDrawingKeyboardEvent = {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  isComposing: boolean;
  preventDefault?: () => void;
  stopPropagation?: () => void;
};
export type IDrawingRenderState = {
  drawings: IDrawing[];
  selectedId: string | null;
  selectedIds: readonly string[];
};

let nextDrawingId = 0;

type IDrawingDraft = { drawing: IDrawing; anchors: IDrawingPoint[] };
type IDrawingDrag = {
  pointerId: number;
  start: IScreenPoint;
  current: IScreenPoint;
  original: IDrawing | null;
  handle: number | null;
  projection: IDrawingProjection;
  clone?: boolean;
  companions?: IDrawing[];
};

export function useChartDrawings({
  projectionRef,
  redrawRef,
  storageKey,
  enabled,
}: {
  projectionRef: RefObject<IDrawingProjection | null>;
  redrawRef: RefObject<() => void>;
  storageKey?: string;
  enabled: boolean;
}) {
  const [, refresh] = useReducer((version: number) => version + 1, 0);
  const state = useRef({
    history: { past: [], present: [], future: [] } as IDrawingHistory,
    tool: 'cursor' as IDrawingTool | 'cursor',
    selectedId: null as string | null,
    selectedIds: [] as string[],
    style: { ...DEFAULT_DRAWING_STYLE },
    draft: null as IDrawingDraft | null,
    drag: null as IDrawingDrag | null,
    preview: null as IDrawing | null,
    companionPreviews: [] as IDrawing[],
    measurement: null as IDrawing | null,
    measuring: false,
    magnet: false,
    hidden: false,
    locked: false,
    stayInDrawingMode: false,
    ready: false,
    saveFailed: false,
    lastPointer: null as IScreenPoint | null,
    clipboard: [] as IDrawing[],
    editingCoordinates: false,
    panel: null as 'objects' | 'data' | null,
    data: null as IDataWindowSnapshot | null,
  });
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const update = useCallback(() => {
    refresh();
    redrawRef.current();
  }, [redrawRef]);
  const redraw = useCallback(() => redrawRef.current(), [redrawRef]);
  const key = storageKey
    ? `trading-view-web-drawings:v1:${storageKey}`
    : undefined;

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    state.current.ready = false;
    const load = async () => {
      let drawings: IDrawing[] = [];
      try {
        if (key) {
          drawings = parseDrawings(await readChartLocalStorage(key));
        }
      } catch {
        // Drawing remains available when preference storage cannot be read.
      }
      if (!active) return;
      state.current.history = { past: [], present: drawings, future: [] };
      state.current.ready = true;
      state.current.draft = null;
      state.current.drag = null;
      state.current.preview = null;
      state.current.selectedId = null;
      state.current.selectedIds = [];
      update();
    };
    void load();
    return () => {
      active = false;
    };
  }, [enabled, key, update]);

  const commit = useCallback(
    (change: IDrawing[] | 'undo' | 'redo') => {
      const model = state.current;
      if (
        Array.isArray(change) &&
        change.length === model.history.present.length &&
        change.every(
          (drawing, index) => drawing === model.history.present[index],
        )
      )
        return;
      const next = changeDrawingHistory(model.history, change);
      if (next === model.history) return;
      model.history = next;
      model.selectedIds = model.selectedIds.filter((id) =>
        next.present.some((drawing) => drawing.id === id),
      );
      if (!next.present.some((drawing) => drawing.id === model.selectedId))
        model.selectedId = model.selectedIds.at(-1) ?? null;
      if (key) {
        const serialized = JSON.stringify(next.present);
        void writeChartLocalStorage(key, serialized).then(
          () => {
            if (model.saveFailed) {
              model.saveFailed = false;
              if (mounted.current) refresh();
            }
          },
          () => {
            if (!model.saveFailed) {
              model.saveFailed = true;
              if (mounted.current) refresh();
            }
          },
        );
      }
      update();
    },
    [key, update],
  );

  const cancel = useCallback(() => {
    state.current.draft = null;
    state.current.drag = null;
    state.current.preview = null;
    state.current.companionPreviews = [];
    state.current.measurement = null;
    state.current.measuring = false;
    update();
  }, [update]);

  const selectTool = useCallback(
    (tool: IDrawingTool | 'cursor') => {
      cancel();
      const model = state.current;
      model.tool = tool;
      model.selectedId = null;
      model.selectedIds = [];
      if (tool !== 'cursor') model.hidden = false;
      update();
    },
    [cancel, update],
  );

  const completeDraft = useCallback(
    (drawing: IDrawing) => {
      const model = state.current;
      model.draft = null;
      model.drag = null;
      model.preview = null;
      model.editingCoordinates = false;
      model.selectedId = drawing.id;
      model.selectedIds = [drawing.id];
      if (!model.stayInDrawingMode) model.tool = 'cursor';
      commit([...model.history.present, drawing]);
    },
    [commit],
  );

  const screenPoint = (event: IDrawingPointerEvent): IScreenPoint => ({
    x: event.x,
    y: event.y,
  });

  const onPointerDown = useCallback(
    (event: IDrawingPointerEvent) => {
      const model = state.current;
      const projection = projectionRef.current;
      if (
        !enabled ||
        !model.ready ||
        !projection ||
        event.button !== 0 ||
        model.drag
      )
        return false;
      const point = screenPoint(event);
      model.lastPointer = point;
      if (!isInDrawingPane(point, projection)) return false;
      event.focus?.();
      model.measurement = null;
      if (model.tool === 'cursor') {
        const hit = model.hidden
          ? null
          : hitTestDrawings(
              model.history.present,
              point,
              projection,
              model.selectedId,
              event.touch ? 18 : 8,
            );
        const previousSelection = model.selectedIds;
        if (hit && (event.ctrlKey || event.metaKey)) {
          model.selectedIds = previousSelection.includes(hit.drawing.id)
            ? previousSelection.filter((id) => id !== hit.drawing.id)
            : [...previousSelection, hit.drawing.id];
        } else if (!hit || !previousSelection.includes(hit.drawing.id))
          model.selectedIds = hit ? [hit.drawing.id] : [];
        model.selectedId = model.selectedIds.at(-1) ?? null;
        update();
        if (!hit && event.shiftKey) {
          const anchor = screenToDrawingPoint(point, projection);
          model.measuring = true;
          model.draft = {
            anchors: [anchor],
            drawing: {
              ...model.style,
              id: 'measurement',
              tool: 'datePriceRange',
              locked: false,
              points: [anchor],
            },
          };
          model.drag = {
            pointerId: event.pointerId,
            start: point,
            current: point,
            original: null,
            handle: null,
            projection,
          };
          event.capture?.();
          event.preventDefault?.();
          return true;
        }
        if (!hit || model.locked || hit.drawing.locked) return false;
        model.drag = {
          pointerId: event.pointerId,
          start: point,
          current: point,
          original: hit.drawing,
          handle: hit.handle,
          projection,
          companions:
            hit.handle === null
              ? model.history.present.filter(
                  (drawing) =>
                    drawing.id !== hit.drawing.id &&
                    previousSelection.includes(drawing.id) &&
                    !drawing.locked,
                )
              : [],
          clone:
            (event.ctrlKey || event.metaKey) &&
            hit.handle === null &&
            model.history.present.length < MAX_DRAWINGS,
        };
      } else {
        if (model.history.present.length >= MAX_DRAWINGS) return true;
        const lastAnchor = model.draft?.anchors.at(-1);
        const constrained =
          event.shiftKey && lastAnchor
            ? constrainDrawingPoint(
                drawingPointToScreen(lastAnchor, projection),
                point,
                model.tool,
              )
            : point;
        const anchor = screenToDrawingPoint(
          constrained,
          projection,
          model.magnet !== (event.ctrlKey || event.metaKey),
        );
        if (model.draft) {
          const anchors = [...model.draft.anchors, anchor];
          const drawing = { ...model.draft.drawing, points: anchors };
          if (anchors.length >= DRAWING_TOOLS[model.tool].points) {
            completeDraft(drawing);
            return true;
          }
          model.draft = { drawing, anchors };
        } else {
          nextDrawingId += 1;
          const drawing: IDrawing = {
            ...model.style,
            id: `${Date.now()}-${nextDrawingId}`,
            tool: model.tool,
            locked: false,
            points: [anchor],
          };
          if (DRAWING_TOOLS[model.tool].points === 1) {
            completeDraft(drawing);
            return true;
          }
          model.draft = { drawing, anchors: [anchor] };
        }
        model.drag = {
          pointerId: event.pointerId,
          start: point,
          current: point,
          original: null,
          handle: null,
          projection,
        };
      }
      event.preventDefault?.();
      event.capture?.();
      update();
      return true;
    },
    [completeDraft, enabled, projectionRef, update],
  );

  const onPointerMove = useCallback(
    (event: IDrawingPointerEvent) => {
      const model = state.current;
      const projection = projectionRef.current;
      if (!enabled || !model.ready || !projection) return false;
      const point = screenPoint(event);
      model.lastPointer = point;
      const drag = model.drag;
      if (drag && drag.pointerId !== event.pointerId) return true;
      if (drag) drag.current = point;
      if (drag?.original) {
        const delta = { x: point.x - drag.start.x, y: point.y - drag.start.y };
        if (event.shiftKey && drag.handle === null) {
          if (Math.abs(delta.x) > Math.abs(delta.y)) delta.y = 0;
          else delta.x = 0;
        } else if (
          event.shiftKey &&
          drag.handle !== null &&
          drag.handle < 2 &&
          drag.original.points.length === 2
        ) {
          const fixed = drawingPointToScreen(
            drag.original.points[1 - drag.handle],
            drag.projection,
          );
          const original = drawingPointToScreen(
            drag.original.points[drag.handle],
            drag.projection,
          );
          const end = constrainDrawingPoint(
            fixed,
            { x: original.x + delta.x, y: original.y + delta.y },
            drag.original.tool,
          );
          delta.x = end.x - original.x;
          delta.y = end.y - original.y;
        }
        model.preview = moveDrawing(
          drag.original,
          delta,
          drag.projection,
          drag.handle,
          model.magnet !== (event.ctrlKey || event.metaKey),
        );
        model.companionPreviews = (drag.companions ?? []).map((drawing) =>
          moveDrawing(drawing, delta, drag.projection, null, false),
        );
        event.preventDefault?.();
        redraw();
        return true;
      }
      if (model.draft) {
        const lastAnchor = model.draft.anchors.at(-1);
        const constrained =
          event.shiftKey && lastAnchor
            ? constrainDrawingPoint(
                drawingPointToScreen(lastAnchor, projection),
                point,
                model.draft.drawing.tool,
              )
            : point;
        const anchor = screenToDrawingPoint(
          constrained,
          projection,
          model.magnet !== (event.ctrlKey || event.metaKey),
        );
        if (isFreehandTool(model.draft.drawing.tool)) {
          if (!drag || model.draft.anchors.length >= MAX_DRAWING_POINTS)
            return true;
          const last = lastAnchor
            ? drawingPointToScreen(lastAnchor, projection)
            : point;
          if (Math.hypot(last.x - point.x, last.y - point.y) < 2) return true;
          model.draft.anchors.push(anchor);
        }
        model.draft.drawing = {
          ...model.draft.drawing,
          points: isFreehandTool(model.draft.drawing.tool)
            ? [...model.draft.anchors]
            : [...model.draft.anchors, anchor],
        };
        redraw();
        return true;
      }
      if (model.tool !== 'cursor') {
        event.setCursor?.('crosshair');
        return true;
      }
      const hit =
        model.hidden || model.locked || !isInDrawingPane(point, projection)
          ? null
          : hitTestDrawings(
              model.history.present,
              point,
              projection,
              model.selectedId,
              event.touch ? 18 : 8,
            );
      if (hit && !hit.drawing.locked) {
        event.setCursor?.(hit.handle === null ? 'move' : 'crosshair');
        return true;
      }
      return false;
    },
    [enabled, projectionRef, redraw],
  );

  const onPointerUp = useCallback(
    (event: IDrawingPointerEvent) => {
      const model = state.current;
      const drag = model.drag;
      if (!drag || event.pointerId !== drag.pointerId) return false;
      const moved =
        Math.hypot(
          drag.current.x - drag.start.x,
          drag.current.y - drag.start.y,
        ) > 3;
      model.drag = null;
      if (event.type !== 'pointerup') {
        cancel();
        return true;
      }
      if (model.measuring) {
        model.measurement = model.draft?.drawing ?? null;
        model.draft = null;
        model.measuring = false;
        update();
        return true;
      }
      if (drag.original && model.preview) {
        const preview = model.preview;
        model.preview = null;
        if (moved && drag.clone) {
          nextDrawingId += 1;
          const copies = [preview, ...model.companionPreviews]
            .slice(0, MAX_DRAWINGS - model.history.present.length)
            .map((drawing) => {
              nextDrawingId += 1;
              return { ...drawing, id: `${Date.now()}-${nextDrawingId}` };
            });
          model.selectedIds = copies.map((drawing) => drawing.id);
          model.selectedId = copies[0]?.id ?? null;
          commit([...model.history.present, ...copies]);
        } else if (moved) {
          const updated = new Map(
            [preview, ...model.companionPreviews].map((drawing) => [
              drawing.id,
              drawing,
            ]),
          );
          commit(
            model.history.present.map(
              (drawing) => updated.get(drawing.id) ?? drawing,
            ),
          );
        }
        model.companionPreviews = [];
      } else if (
        model.draft &&
        (isFreehandTool(model.draft.drawing.tool)
          ? model.draft.anchors.length > 1
          : moved) &&
        DRAWING_TOOLS[model.draft.drawing.tool].points === 2
      ) {
        completeDraft(model.draft.drawing);
      } else if (model.draft && isFreehandTool(model.draft.drawing.tool)) {
        cancel();
      }
      event.release?.();
      update();
      return true;
    },
    [cancel, commit, completeDraft, update],
  );

  const removeSelected = useCallback(() => {
    const model = state.current;
    if (model.locked) return;
    const selected = model.history.present.find(
      (drawing) => drawing.id === model.selectedId,
    );
    if (!selected) return;
    commit(
      model.history.present.filter(
        (drawing) => !model.selectedIds.includes(drawing.id) || drawing.locked,
      ),
    );
  }, [commit]);

  const onDoubleClick = useCallback(
    (event: IDrawingPointerEvent) => {
      const projection = projectionRef.current;
      const model = state.current;
      if (!projection || model.hidden || model.tool !== 'cursor') return;
      const hit = hitTestDrawings(
        model.history.present,
        { x: event.x, y: event.y },
        projection,
        model.selectedId,
      );
      if (hit) {
        model.selectedId = hit.drawing.id;
        model.selectedIds = [hit.drawing.id];
        model.editingCoordinates = true;
        update();
      }
    },
    [projectionRef, update],
  );

  const editPoint = useCallback(
    (index: number, changes: Partial<IDrawingPoint>) => {
      const model = state.current;
      if (model.locked) return;
      const selected = model.history.present.find(
        (drawing) => drawing.id === model.selectedId,
      );
      if (!selected || selected.locked || !selected.points[index]) return;
      const point = { ...selected.points[index], ...changes };
      if (
        !Number.isFinite(point.time) ||
        Math.abs(point.time) >= 8_640_000_000_000 ||
        !Number.isFinite(point.price)
      )
        return;
      if (
        point.time === selected.points[index].time &&
        point.price === selected.points[index].price
      )
        return;
      commit(
        model.history.present.map((drawing) =>
          drawing.id === selected.id
            ? {
                ...drawing,
                points: drawing.points.map((anchor, anchorIndex) =>
                  anchorIndex === index ? point : anchor,
                ),
              }
            : drawing,
        ),
      );
    },
    [commit],
  );

  const toggleCoordinates = useCallback(() => {
    state.current.editingCoordinates = !state.current.editingCoordinates;
    update();
  }, [update]);

  const historyAction = useCallback(
    (action: 'undo' | 'redo') => {
      cancel();
      commit(action);
    },
    [cancel, commit],
  );
  const onKeyDown = useCallback(
    (event: IDrawingKeyboardEvent) => {
      const model = state.current;
      const projection = projectionRef.current;
      if (!enabled || !model.ready || event.isComposing) return;
      const modifier = event.metaKey || event.ctrlKey;
      const code = event.code;
      if (event.altKey && modifier && code === 'KeyH') {
        cancel();
        model.hidden = !model.hidden;
        model.tool = 'cursor';
        update();
      } else if (event.altKey && !modifier) {
        const shortcuts: Partial<Record<string, IDrawingTool>> = {
          KeyT: 'trend',
          KeyH: 'horizontal',
          KeyV: 'vertical',
          KeyC: 'cross',
          KeyF: 'fib',
        };
        const tool =
          event.shiftKey && code === 'KeyR' ? 'rectangle' : shortcuts[code];
        if (!tool) return;
        selectTool(tool);
        if (
          DRAWING_TOOLS[tool].points === 1 &&
          projection &&
          model.lastPointer &&
          isInDrawingPane(model.lastPointer, projection) &&
          model.history.present.length < MAX_DRAWINGS
        ) {
          nextDrawingId += 1;
          completeDraft({
            ...model.style,
            id: `${Date.now()}-${nextDrawingId}`,
            tool,
            locked: false,
            points: [
              screenToDrawingPoint(model.lastPointer, projection, model.magnet),
            ],
          });
        }
      } else if (modifier && code === 'KeyC') {
        model.clipboard = model.history.present.filter((drawing) =>
          model.selectedIds.includes(drawing.id),
        );
        if (!model.clipboard.length) return;
      } else if (modifier && code === 'KeyV') {
        if (
          !model.clipboard.length ||
          !projection ||
          model.history.present.length >= MAX_DRAWINGS
        )
          return;
        nextDrawingId += 1;
        const pasted = model.clipboard
          .slice(0, MAX_DRAWINGS - model.history.present.length)
          .map((drawing) => {
            nextDrawingId += 1;
            return {
              ...moveDrawing(
                drawing,
                { x: 20, y: 20 },
                projection,
                null,
                false,
              ),
              id: `${Date.now()}-${nextDrawingId}`,
              locked: false,
            };
          });
        model.selectedIds = pasted.map((drawing) => drawing.id);
        model.selectedId = pasted[0]?.id ?? null;
        commit([...model.history.present, ...pasted]);
      } else if (code.startsWith('Arrow') && !modifier && !event.altKey) {
        const selected = model.history.present.find(
          (drawing) => drawing.id === model.selectedId,
        );
        if (!projection || !selected || selected.locked || model.locked) return;
        const delta = { x: 0, y: 0 };
        if (code === 'ArrowLeft') delta.x = -1;
        else if (code === 'ArrowRight') delta.x = 1;
        else if (code === 'ArrowUp') delta.y = -1;
        else delta.y = 1;
        commit(
          model.history.present.map((drawing) =>
            model.selectedIds.includes(drawing.id) && !drawing.locked
              ? moveDrawing(drawing, delta, projection, null, false)
              : drawing,
          ),
        );
      } else if (event.key === 'Escape') {
        selectTool('cursor');
        event.preventDefault?.();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        removeSelected();
        event.preventDefault?.();
      } else if ((event.metaKey || event.ctrlKey) && code === 'KeyZ') {
        historyAction(event.shiftKey ? 'redo' : 'undo');
        event.preventDefault?.();
      } else if ((event.metaKey || event.ctrlKey) && code === 'KeyY') {
        historyAction('redo');
        event.preventDefault?.();
      } else return;
      event.preventDefault?.();
      event.stopPropagation?.();
    },
    [
      cancel,
      commit,
      completeDraft,
      enabled,
      historyAction,
      projectionRef,
      removeSelected,
      selectTool,
      update,
    ],
  );
  const changeStyle = useCallback(
    (style: Partial<IDrawingStyle> & { text?: string }) => {
      const model = state.current;
      model.style = { ...model.style, ...style };
      const selected = model.history.present.find(
        (drawing) => drawing.id === model.selectedId,
      );
      if (selected && !model.locked && !selected.locked)
        commit(
          model.history.present.map((drawing) =>
            model.selectedIds.includes(drawing.id) && !drawing.locked
              ? { ...drawing, ...style }
              : drawing,
          ),
        );
      else update();
    },
    [commit, update],
  );

  const toggle = useCallback(
    (option: 'magnet' | 'hidden' | 'locked' | 'stayInDrawingMode') => {
      cancel();
      state.current[option] = !state.current[option];
      if (option === 'hidden' || option === 'locked')
        state.current.tool = 'cursor';
      update();
    },
    [cancel, update],
  );

  const toggleSelectedLock = useCallback(() => {
    const model = state.current;
    const selected = model.history.present.find(
      (drawing) => drawing.id === model.selectedId,
    );
    if (!selected || model.locked) return;
    commit(
      model.history.present.map((drawing) =>
        model.selectedIds.includes(drawing.id)
          ? { ...drawing, locked: !selected.locked }
          : drawing,
      ),
    );
  }, [commit]);

  const clear = useCallback(() => {
    cancel();
    const model = state.current;
    if (!model.locked)
      commit(model.history.present.filter((drawing) => drawing.locked));
  }, [cancel, commit]);

  const selectDrawing = useCallback(
    (id: string, additive = false) => {
      cancel();
      const model = state.current;
      model.tool = 'cursor';
      model.editingCoordinates = false;
      if (additive)
        model.selectedIds = model.selectedIds.includes(id)
          ? model.selectedIds.filter((selected) => selected !== id)
          : [...model.selectedIds, id];
      else model.selectedIds = [id];
      model.selectedId = model.selectedIds.at(-1) ?? null;
      update();
    },
    [cancel, update],
  );

  const updateDrawing = useCallback(
    (
      id: string,
      change: { name?: string; hidden?: boolean; locked?: boolean },
    ) => {
      const model = state.current;
      if (!model.ready) return;
      commit(
        model.history.present.map((drawing) =>
          drawing.id === id ? { ...drawing, ...change } : drawing,
        ),
      );
    },
    [commit],
  );

  const removeDrawing = useCallback(
    (id: string) => {
      const model = state.current;
      if (!model.locked)
        commit(
          model.history.present.filter(
            (drawing) => drawing.id !== id || drawing.locked,
          ),
        );
    },
    [commit],
  );

  const reorderDrawing = useCallback(
    (id: string, direction: 1 | -1) => {
      const model = state.current;
      const index = model.history.present.findIndex(
        (drawing) => drawing.id === id,
      );
      const next = index + direction;
      if (
        model.locked ||
        index < 0 ||
        model.history.present[index].locked ||
        next < 0 ||
        next >= model.history.present.length
      )
        return;
      const drawings = [...model.history.present];
      [drawings[index], drawings[next]] = [drawings[next], drawings[index]];
      commit(drawings);
    },
    [commit],
  );

  const togglePanel = useCallback(
    (panel: 'objects' | 'data') => {
      state.current.panel = state.current.panel === panel ? null : panel;
      update();
    },
    [update],
  );

  const updateData = useCallback((data: IDataWindowSnapshot | null) => {
    const model = state.current;
    if (JSON.stringify(model.data) === JSON.stringify(data)) return;
    model.data = data;
    if (model.panel === 'data') refresh();
  }, []);

  const getRenderState = useCallback((): IDrawingRenderState => {
    const model = state.current;

    const drawings = model.history.present.map((drawing) =>
      drawing.id === model.preview?.id && !model.drag?.clone
        ? model.preview
        : ((!model.drag?.clone
            ? model.companionPreviews.find(
                (preview) => preview.id === drawing.id,
              )
            : undefined) ?? drawing),
    );
    if (model.drag?.clone && model.preview)
      drawings.push(model.preview, ...model.companionPreviews);
    if (model.draft) drawings.push(model.draft.drawing);
    if (model.measurement) drawings.push(model.measurement);
    let selectedId = model.draft?.drawing.id ?? model.selectedId;
    if (
      model.locked ||
      (model.draft && isFreehandTool(model.draft.drawing.tool))
    )
      selectedId = null;
    return {
      drawings: enabled && !model.hidden ? drawings : [],
      selectedId,
      selectedIds: model.locked ? [] : model.selectedIds,
    };
  }, [enabled]);

  return {
    state: state.current,
    selectDrawing,
    updateDrawing,
    removeDrawing,
    reorderDrawing,
    togglePanel,
    updateData,
    getRenderState,
    cancel,
    selectTool,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeyDown,
    onDoubleClick,
    editPoint,
    toggleCoordinates,
    removeSelected,
    changeStyle,
    historyAction,
    toggle,
    toggleSelectedLock,
    clear,
  };
}

export type IChartDrawingsController = ReturnType<typeof useChartDrawings>;
