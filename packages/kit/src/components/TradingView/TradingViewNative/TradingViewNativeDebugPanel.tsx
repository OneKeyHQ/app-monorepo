import type {
  PointerEvent as ReactPointerEvent,
  UIEvent as ReactUIEvent,
} from 'react';
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { createPortal } from 'react-dom';

import { DEV_OVERLAY_FLOAT_BUTTON_Z_INDEX } from '@onekeyhq/shared/src/consts/zIndexConsts';

import {
  clearTradingViewNativeDebugEvents,
  getTradingViewNativeDebugEvents,
  subscribeTradingViewNativeDebugEvents,
} from './data/tradingViewNativeDebugLogger';

import type {
  ITradingViewNativeDebugEvent,
  ITradingViewNativeDebugEventDetails,
} from './data/tradingViewNativeDebugLogger';

const PANEL_STORAGE_KEY = 'trading_view_native_debug_panel_position';
const PANEL_SIZE_STORAGE_KEY = 'trading_view_native_debug_panel_size';
const PANEL_MARGIN = 12;
const PANEL_WIDTH = 420;
const PANEL_HEIGHT = 320;
const PANEL_MIN_WIDTH = 300;
const PANEL_MIN_HEIGHT = 180;
const PANEL_COLLAPSED_HEIGHT = 42;
const COPY_STATUS_RESET_DELAY_MS = 1500;
const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 1;

interface IPanelPosition {
  x: number;
  y: number;
}

interface IPanelSize {
  height: number;
  width: number;
}

interface IDragState {
  offsetX: number;
  offsetY: number;
  pointerId: number;
}

type ICopyStatus = 'copied' | 'failed' | 'idle';

const COPY_STATUS_LABEL: Record<ICopyStatus, string> = {
  copied: 'Copied',
  failed: 'Failed',
  idle: 'Copy',
};

function getViewportSize() {
  return {
    height: globalThis.innerHeight || PANEL_HEIGHT + PANEL_MARGIN * 2,
    width: globalThis.innerWidth || PANEL_WIDTH + PANEL_MARGIN * 2,
  };
}

function getPanelSizeLimits(
  position: IPanelPosition = { x: PANEL_MARGIN, y: PANEL_MARGIN },
) {
  const viewport = getViewportSize();
  const maxHeight = Math.max(
    viewport.height - position.y - PANEL_MARGIN,
    PANEL_COLLAPSED_HEIGHT,
  );
  const maxWidth = Math.max(
    viewport.width - position.x - PANEL_MARGIN,
    PANEL_MARGIN,
  );
  return {
    maxHeight,
    maxWidth,
    minHeight: Math.min(PANEL_MIN_HEIGHT, maxHeight),
    minWidth: Math.min(PANEL_MIN_WIDTH, maxWidth),
  };
}

function clampPanelSize(
  size: IPanelSize,
  position: IPanelPosition = { x: PANEL_MARGIN, y: PANEL_MARGIN },
) {
  const limits = getPanelSizeLimits(position);
  return {
    height: Math.min(Math.max(size.height, limits.minHeight), limits.maxHeight),
    width: Math.min(Math.max(size.width, limits.minWidth), limits.maxWidth),
  };
}

function getPanelSize(size: IPanelSize, isCollapsed: boolean) {
  const clampedSize = clampPanelSize(size);
  return {
    height: isCollapsed ? PANEL_COLLAPSED_HEIGHT : clampedSize.height,
    width: clampedSize.width,
  };
}

function clampPanelPosition(
  position: IPanelPosition,
  isCollapsed: boolean,
  size: IPanelSize,
): IPanelPosition {
  const viewport = getViewportSize();
  const panel = getPanelSize(size, isCollapsed);
  return {
    x: Math.min(
      Math.max(position.x, PANEL_MARGIN),
      Math.max(viewport.width - panel.width - PANEL_MARGIN, PANEL_MARGIN),
    ),
    y: Math.min(
      Math.max(position.y, PANEL_MARGIN),
      Math.max(viewport.height - panel.height - PANEL_MARGIN, PANEL_MARGIN),
    ),
  };
}

function getDefaultPanelSize() {
  return clampPanelSize({ height: PANEL_HEIGHT, width: PANEL_WIDTH });
}

function getDefaultPanelPosition(size: IPanelSize) {
  const viewport = getViewportSize();
  const panel = getPanelSize(size, false);
  return clampPanelPosition(
    {
      x: viewport.width - panel.width - PANEL_MARGIN,
      y: 72,
    },
    false,
    size,
  );
}

function loadPanelSize() {
  try {
    const storedSize = globalThis.localStorage?.getItem(PANEL_SIZE_STORAGE_KEY);
    if (!storedSize) {
      return getDefaultPanelSize();
    }
    const parsedSize = JSON.parse(storedSize) as Partial<IPanelSize>;
    if (
      typeof parsedSize.height === 'number' &&
      Number.isFinite(parsedSize.height) &&
      typeof parsedSize.width === 'number' &&
      Number.isFinite(parsedSize.width)
    ) {
      return clampPanelSize({
        height: parsedSize.height,
        width: parsedSize.width,
      });
    }
  } catch {
    // Ignore invalid development-only persisted state.
  }
  return getDefaultPanelSize();
}

function loadPanelPosition(size: IPanelSize) {
  try {
    const storedPosition = globalThis.localStorage?.getItem(PANEL_STORAGE_KEY);
    if (!storedPosition) {
      return getDefaultPanelPosition(size);
    }
    const parsedPosition = JSON.parse(
      storedPosition,
    ) as Partial<IPanelPosition>;
    if (
      typeof parsedPosition.x === 'number' &&
      Number.isFinite(parsedPosition.x) &&
      typeof parsedPosition.y === 'number' &&
      Number.isFinite(parsedPosition.y)
    ) {
      return clampPanelPosition(
        { x: parsedPosition.x, y: parsedPosition.y },
        false,
        size,
      );
    }
  } catch {
    // Ignore invalid development-only persisted state.
  }
  return getDefaultPanelPosition(size);
}

function savePanelPosition(position: IPanelPosition) {
  try {
    globalThis.localStorage?.setItem(
      PANEL_STORAGE_KEY,
      JSON.stringify(position),
    );
  } catch {
    // Ignore unavailable development-only storage.
  }
}

function savePanelSize(size: IPanelSize) {
  try {
    globalThis.localStorage?.setItem(
      PANEL_SIZE_STORAGE_KEY,
      JSON.stringify(size),
    );
  } catch {
    // Ignore unavailable development-only storage.
  }
}

function padTimePart(value: number, width = 2) {
  return value.toString().padStart(width, '0');
}

function formatEventTime(timestamp: number) {
  const date = new Date(timestamp);
  return `${padTimePart(date.getHours())}:${padTimePart(
    date.getMinutes(),
  )}:${padTimePart(date.getSeconds())}.${padTimePart(
    date.getMilliseconds(),
    3,
  )}`;
}

function formatDebugEventDetails(
  details?: ITradingViewNativeDebugEventDetails,
) {
  if (!details) {
    return '';
  }
  return Object.entries(details)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
}

function formatDebugEventsForClipboard(
  events: readonly ITradingViewNativeDebugEvent[],
) {
  return events
    .map((event) => {
      const details = formatDebugEventDetails(event.details);
      return `${new Date(event.timestamp).toISOString()} [${event.level.toUpperCase()}] ${event.name}${
        details ? ` ${details}` : ''
      }`;
    })
    .join('\n');
}

function getEventColor(level: ITradingViewNativeDebugEvent['level']) {
  if (level === 'error') {
    return '#ff7b72';
  }
  if (level === 'warning') {
    return '#d29922';
  }
  return '#8b949e';
}

export interface ITradingViewNativeDebugPanelProps {
  onClose: () => void;
}

function BasicTradingViewNativeDebugPanel({
  onClose,
}: ITradingViewNativeDebugPanelProps) {
  const events = useSyncExternalStore(
    subscribeTradingViewNativeDebugEvents,
    getTradingViewNativeDebugEvents,
    getTradingViewNativeDebugEvents,
  );
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [size, setSize] = useState<IPanelSize>(() => loadPanelSize());
  const [position, setPosition] = useState<IPanelPosition>(() =>
    loadPanelPosition(size),
  );
  const [copyStatus, setCopyStatus] = useState<ICopyStatus>('idle');
  const dragStateRef = useRef<IDragState | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const eventListRef = useRef<HTMLDivElement | null>(null);
  const shouldFollowLatestEventsRef = useRef(true);
  const copyStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const positionRef = useRef(position);
  const sizeRef = useRef(size);
  positionRef.current = position;
  sizeRef.current = size;

  useEffect(() => {
    const eventList = eventListRef.current;
    if (eventList && shouldFollowLatestEventsRef.current) {
      eventList.scrollTop = eventList.scrollHeight;
    }
  }, [events]);

  useEffect(() => {
    const panel = panelRef.current;
    if (isCollapsed || !panel || !globalThis.ResizeObserver) {
      return undefined;
    }
    const resizeObserver = new ResizeObserver(() => {
      const panelRect = panel.getBoundingClientRect();
      if (panelRect.width <= 0 || panelRect.height <= 0) {
        return;
      }
      const nextSize = clampPanelSize(
        { height: panelRect.height, width: panelRect.width },
        positionRef.current,
      );
      const currentSize = sizeRef.current;
      if (
        Math.abs(currentSize.height - nextSize.height) < 0.5 &&
        Math.abs(currentSize.width - nextSize.width) < 0.5
      ) {
        return;
      }
      sizeRef.current = nextSize;
      setSize(nextSize);
      savePanelSize(nextSize);
    });
    resizeObserver.observe(panel);
    return () => resizeObserver.disconnect();
  }, [isCollapsed]);

  useEffect(() => {
    const handleResize = () => {
      const nextSize = clampPanelSize(sizeRef.current);
      const nextPosition = clampPanelPosition(
        positionRef.current,
        isCollapsed,
        nextSize,
      );
      sizeRef.current = nextSize;
      positionRef.current = nextPosition;
      setSize(nextSize);
      setPosition(nextPosition);
    };
    globalThis.addEventListener('resize', handleResize);
    return () => globalThis.removeEventListener('resize', handleResize);
  }, [isCollapsed]);

  useEffect(
    () => () => {
      if (copyStatusTimeoutRef.current) {
        clearTimeout(copyStatusTimeoutRef.current);
      }
    },
    [],
  );

  const showCopyStatus = useCallback((status: ICopyStatus) => {
    if (copyStatusTimeoutRef.current) {
      clearTimeout(copyStatusTimeoutRef.current);
      copyStatusTimeoutRef.current = null;
    }
    setCopyStatus(status);
    if (status !== 'idle') {
      copyStatusTimeoutRef.current = setTimeout(() => {
        setCopyStatus('idle');
        copyStatusTimeoutRef.current = null;
      }, COPY_STATUS_RESET_DELAY_MS);
    }
  }, []);

  const handleCopy = useCallback(async () => {
    const clipboardText = formatDebugEventsForClipboard(events);
    const clipboard = globalThis.navigator?.clipboard;
    if (!clipboardText || !clipboard?.writeText) {
      showCopyStatus('failed');
      return;
    }
    try {
      await clipboard.writeText(clipboardText);
      showCopyStatus('copied');
    } catch {
      showCopyStatus('failed');
    }
  }, [events, showCopyStatus]);

  const handleClear = useCallback(() => {
    shouldFollowLatestEventsRef.current = true;
    clearTradingViewNativeDebugEvents();
    showCopyStatus('idle');
  }, [showCopyStatus]);

  const handleEventListScroll = useCallback(
    (event: ReactUIEvent<HTMLDivElement>) => {
      const eventList = event.currentTarget;
      const distanceFromBottom =
        eventList.scrollHeight - eventList.scrollTop - eventList.clientHeight;
      shouldFollowLatestEventsRef.current =
        distanceFromBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD_PX;
    },
    [],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest('button')) {
        return;
      }
      event.preventDefault();
      const currentPosition = positionRef.current;
      dragStateRef.current = {
        offsetX: event.clientX - currentPosition.x,
        offsetY: event.clientY - currentPosition.y,
        pointerId: event.pointerId,
      };
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional in older development browsers.
      }
    },
    [],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      const nextPosition = clampPanelPosition(
        {
          x: event.clientX - dragState.offsetX,
          y: event.clientY - dragState.offsetY,
        },
        isCollapsed,
        sizeRef.current,
      );
      positionRef.current = nextPosition;
      setPosition(nextPosition);
    },
    [isCollapsed],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dragStateRef.current?.pointerId !== event.pointerId) {
        return;
      }
      dragStateRef.current = null;
      savePanelPosition(positionRef.current);
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional in older development browsers.
      }
    },
    [],
  );

  const panelSize = getPanelSize(size, isCollapsed);
  const panelSizeLimits = getPanelSizeLimits(position);
  return createPortal(
    <div
      data-testid="trading-view-native-debug-panel"
      ref={panelRef}
      style={{
        background: 'rgba(13, 17, 23, 0.96)',
        border: '1px solid rgba(139, 148, 158, 0.45)',
        borderRadius: 8,
        boxSizing: 'border-box',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        color: '#c9d1d9',
        display: 'flex',
        flexDirection: 'column',
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 11,
        height: panelSize.height,
        left: position.x,
        maxHeight: panelSizeLimits.maxHeight,
        maxWidth: panelSizeLimits.maxWidth,
        minHeight: isCollapsed
          ? PANEL_COLLAPSED_HEIGHT
          : panelSizeLimits.minHeight,
        minWidth: panelSizeLimits.minWidth,
        overflow: 'hidden',
        pointerEvents: 'auto',
        position: 'fixed',
        resize: isCollapsed ? 'none' : 'both',
        top: position.y,
        width: panelSize.width,
        zIndex: DEV_OVERLAY_FLOAT_BUTTON_Z_INDEX,
      }}
    >
      <div
        data-testid="trading-view-native-debug-panel-drag-handle"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          alignItems: 'center',
          background: '#161b22',
          borderBottom: isCollapsed
            ? undefined
            : '1px solid rgba(139, 148, 158, 0.25)',
          cursor: dragStateRef.current ? 'grabbing' : 'grab',
          display: 'flex',
          flexShrink: 0,
          height: PANEL_COLLAPSED_HEIGHT,
          padding: '0 8px 0 10px',
          userSelect: 'none',
        }}
      >
        <strong
          style={{
            color: '#58a6ff',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          TradingViewNative events ({events.length})
        </strong>
        <button
          aria-label="Copy event log"
          disabled={!events.length}
          onClick={() => void handleCopy()}
          style={{
            background: 'transparent',
            border: 0,
            color: copyStatus === 'failed' ? '#ff7b72' : '#8b949e',
            cursor: events.length ? 'pointer' : 'default',
            font: 'inherit',
            opacity: events.length ? 1 : 0.45,
            padding: '5px 7px',
          }}
          type="button"
        >
          {COPY_STATUS_LABEL[copyStatus]}
        </button>
        <button
          onClick={handleClear}
          style={{
            background: 'transparent',
            border: 0,
            color: '#8b949e',
            cursor: 'pointer',
            font: 'inherit',
            padding: '5px 7px',
          }}
          type="button"
        >
          Clear
        </button>
        <button
          aria-label={isCollapsed ? 'Expand event log' : 'Collapse event log'}
          onClick={() => {
            const nextValue = !isCollapsed;
            setIsCollapsed(nextValue);
            setPosition((currentPosition) => {
              const nextPosition = clampPanelPosition(
                currentPosition,
                nextValue,
                sizeRef.current,
              );
              positionRef.current = nextPosition;
              return nextPosition;
            });
          }}
          style={{
            background: 'transparent',
            border: 0,
            color: '#c9d1d9',
            cursor: 'pointer',
            font: 'inherit',
            padding: '5px 7px',
          }}
          type="button"
        >
          {isCollapsed ? '+' : '−'}
        </button>
        <button
          aria-label="Close event log"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 0,
            color: '#8b949e',
            cursor: 'pointer',
            font: 'inherit',
            padding: '5px 7px',
          }}
          type="button"
        >
          ×
        </button>
      </div>
      {isCollapsed ? null : (
        <div
          data-testid="trading-view-native-debug-event-list"
          onScroll={handleEventListScroll}
          ref={eventListRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            padding: '6px 8px 10px',
          }}
        >
          {events.length ? (
            events.map((event) => {
              const formattedDetails = formatDebugEventDetails(event.details);
              return (
                <div
                  data-event-name={event.name}
                  key={event.id}
                  style={{
                    lineHeight: 1.45,
                    overflowWrap: 'anywhere',
                    padding: '2px 0',
                  }}
                >
                  <span style={{ color: '#6e7681' }}>
                    {formatEventTime(event.timestamp)}
                  </span>{' '}
                  <span style={{ color: getEventColor(event.level) }}>
                    {event.name}
                  </span>
                  {formattedDetails ? ` ${formattedDetails}` : ''}
                </div>
              );
            })
          ) : (
            <div style={{ color: '#6e7681', padding: '8px 2px' }}>
              Waiting for chart events…
            </div>
          )}
        </div>
      )}
    </div>,
    globalThis.document.body,
  );
}

export const TradingViewNativeDebugPanel = memo(
  BasicTradingViewNativeDebugPanel,
);

export default TradingViewNativeDebugPanel;
