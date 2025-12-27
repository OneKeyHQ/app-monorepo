import { useEffect, useRef, useState } from 'react';

import { createPortal } from 'react-dom';

import { Icon } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { PerformanceMonitor as RNPerformanceMonitor } from './Monitor';

// Key for storing position in localStorage
const STORAGE_KEY = 'performance_monitor_position';

type IPosition = { x: number; y: number };

// Helper to load position from localStorage
function loadPosition(): IPosition {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as IPosition;
      if (
        typeof parsed === 'object' &&
        typeof parsed.x === 'number' &&
        typeof parsed.y === 'number'
      ) {
        // Ensure position is within window bounds
        const maxX = window.innerWidth - 100; // Reserve space for the monitor width
        const maxY = window.innerHeight - 100; // Reserve space for the monitor height
        if (
          parsed.x > maxX ||
          parsed.y > maxY ||
          parsed.x < 0 ||
          parsed.y < 0
        ) {
          return { x: Math.max(0, maxX), y: 40 };
        }
        return { x: parsed.x, y: parsed.y };
      }
    }
  } catch {
    // Ignore errors and fallback to default
  }
  return { x: 40, y: 40 };
}

// Helper to save position to localStorage
function savePosition(pos: IPosition) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // Ignore errors
  }
}

export const MonitorContainer = () => {
  // Initialize position from localStorage
  const [position, setPosition] = useState<IPosition>(() => loadPosition());
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(true);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  // Save position to localStorage whenever it changes
  useEffect(() => {
    savePosition(position);
  }, [position]);

  // Mouse event handlers for drag
  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging.current) return;
    const newPos = {
      x: e.clientX - offset.current.x,
      y: e.clientY - offset.current.y,
    };
    setPosition(newPos);
  };

  const handleMouseUp = () => {
    dragging.current = false;
    globalThis.removeEventListener('mousemove', handleMouseMove);
    globalThis.removeEventListener('mouseup', handleMouseUp);
  };

  const handleMouseDown = (
    e: React.MouseEvent<HTMLDivElement | HTMLButtonElement>,
  ) => {
    dragging.current = true;
    offset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    globalThis.addEventListener('mousemove', handleMouseMove);
    globalThis.addEventListener('mouseup', handleMouseUp);
  };

  const handleClose = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setVisible(false);
    void backgroundApiProxy.serviceDevSetting.updateDevSetting(
      'showPerformanceMonitor',
      false,
    );
  };

  const handleCloseKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      handleClose(e);
    }
  };

  if (!visible) return null;

  // Render the monitor in a draggable container using portal
  return createPortal(
    <button
      type="button"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 9999,
        cursor: 'grab', // Use grab to indicate draggable on hover
        background: '#f5f5f5', // Light gray background
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        userSelect: 'none',
        border: 'none',
        padding: 12,
        transition: 'box-shadow 0.2s, cursor 0.2s',
        outline: 'none',
      }}
      onMouseDown={handleMouseDown as any}
      aria-label="Performance Monitor"
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <RNPerformanceMonitor />
      {hovered ? (
        <button
          type="button"
          style={{
            position: 'absolute',
            top: -10,
            right: -10,
            background: 'rgba(255,255,255,0.8)',
            borderRadius: '50%',
            padding: 2,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            outline: 'none',
          }}
          onClick={handleClose}
          onKeyDown={handleCloseKeyDown}
          tabIndex={0}
          aria-label="Close Performance Monitor"
        >
          <Icon name="CrossedSmallOutline" size={24} />
        </button>
      ) : null}
    </button>,
    globalThis.document.body,
  );
};
