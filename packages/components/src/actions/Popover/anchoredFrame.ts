import type { IPopoverProps } from './type';

const ANCHORED_VIEWPORT_PADDING = 8;
const ANCHORED_DEFAULT_OFFSET = 8;
// Below this much room the panel opens on the other side of the trigger.
const ANCHORED_MIN_HEIGHT = 240;
// The same for side placements of content-sized panels.
const ANCHORED_MIN_SIDE_WIDTH = 200;

export interface IAnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Mirrors floating-ui's `offset`: mainAxis is the gap from the trigger,
// crossAxis shifts along the trigger's edge (horizontally for top/bottom,
// vertically for left/right), and alignmentAxis replaces crossAxis for
// start/end alignments.
export function resolveAnchoredOffset(
  offset: IPopoverProps['offset'],
  placement: IPopoverProps['placement'],
): { mainAxis: number; crossAxis: number } {
  if (typeof offset === 'number') return { mainAxis: offset, crossAxis: 0 };
  if (!offset || typeof offset === 'function') {
    return { mainAxis: ANCHORED_DEFAULT_OFFSET, crossAxis: 0 };
  }
  const align = (placement ?? 'bottom-end').split('-')[1];
  const { mainAxis = 0, crossAxis = 0, alignmentAxis } = offset;
  if (align && typeof alignmentAxis === 'number') {
    return {
      mainAxis,
      crossAxis: align === 'end' ? -alignmentAxis : alignmentAxis,
    };
  }
  return { mainAxis, crossAxis };
}

type IAnchoredAlign = 'flex-start' | 'center' | 'flex-end';

// The region the panel may occupy, with the panel aligned inside it; a
// content-sized panel then needs no measuring to sit against its trigger.
export interface IAnchoredFrame {
  left: number;
  top: number;
  width: number;
  height: number;
  alignItems: IAnchoredAlign;
  justifyContent: IAnchoredAlign;
  // `undefined` sizes the panel to its content.
  panelWidth: number | undefined;
  panelMaxHeight: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// The cross-axis span for an alignment: `start` grows from the anchor's start
// edge, `end` towards its end edge, `center` symmetrically around its middle.
function getAnchoredCrossSpan({
  align,
  start,
  length,
  min,
  max,
}: {
  align: string | undefined;
  start: number;
  length: number;
  min: number;
  max: number;
}): { offset: number; size: number; align: IAnchoredAlign } {
  if (align === 'start') {
    const offset = clamp(start, min, max);
    return { offset, size: max - offset, align: 'flex-start' };
  }
  if (align === 'end') {
    const end = clamp(start + length, min, max);
    return { offset: min, size: end - min, align: 'flex-end' };
  }
  const middle = clamp(start + length / 2, min, max);
  const half = Math.min(middle - min, max - middle);
  return { offset: middle - half, size: half * 2, align: 'center' };
}

export function getAnchoredFrame({
  anchor,
  placement,
  offset,
  crossOffset,
  width: preferredWidth,
  maxHeight: preferredMaxHeight,
  window,
  insets,
}: {
  anchor: IAnchorRect;
  placement: IPopoverProps['placement'];
  offset: number;
  crossOffset: number;
  width: number | undefined;
  maxHeight?: number;
  window: { width: number; height: number };
  insets: { top: number; left: number; bottom: number; right: number };
}): IAnchoredFrame {
  const minX = insets.left + ANCHORED_VIEWPORT_PADDING;
  const maxX = window.width - insets.right - ANCHORED_VIEWPORT_PADDING;
  const minY = insets.top + ANCHORED_VIEWPORT_PADDING;
  const maxY = window.height - insets.bottom - ANCHORED_VIEWPORT_PADDING;
  const [side, align] = (placement ?? 'bottom-end').split('-');
  const limitHeight = (available: number) =>
    preferredMaxHeight !== undefined
      ? Math.min(preferredMaxHeight, available)
      : available;

  if (side === 'left' || side === 'right') {
    const rightStart = anchor.x + anchor.width + offset;
    const leftEnd = anchor.x - offset;
    const spaceRight = Math.max(0, maxX - rightStart);
    const spaceLeft = Math.max(0, leftEnd - minX);
    const needed = preferredWidth ?? ANCHORED_MIN_SIDE_WIDTH;
    // Open on the requested side unless it is too narrow and the other side
    // has more room.
    const openLeft =
      side === 'left'
        ? !(spaceLeft < needed && spaceRight > spaceLeft)
        : spaceRight < needed && spaceLeft > spaceRight;
    const width = openLeft ? spaceLeft : spaceRight;
    const cross = getAnchoredCrossSpan({
      align,
      start: anchor.y + crossOffset,
      length: anchor.height,
      min: minY,
      max: maxY,
    });
    return {
      left: openLeft ? minX : rightStart,
      width,
      alignItems: openLeft ? 'flex-end' : 'flex-start',
      top: cross.offset,
      height: cross.size,
      justifyContent: cross.align,
      panelWidth:
        preferredWidth !== undefined
          ? Math.min(preferredWidth, width)
          : undefined,
      panelMaxHeight: limitHeight(cross.size),
    };
  }

  let horizontal: Pick<IAnchoredFrame, 'left' | 'width' | 'alignItems'>;
  let panelWidth: number | undefined;
  if (preferredWidth !== undefined) {
    const width = Math.max(0, Math.min(preferredWidth, maxX - minX));
    let left: number;
    if (align === 'start') {
      left = anchor.x;
    } else if (align === 'end') {
      left = anchor.x + anchor.width - width;
    } else {
      left = anchor.x + anchor.width / 2 - width / 2;
    }
    horizontal = {
      left: clamp(left + crossOffset, minX, maxX - width),
      width,
      alignItems: 'flex-start',
    };
    panelWidth = width;
  } else {
    const cross = getAnchoredCrossSpan({
      align,
      start: anchor.x + crossOffset,
      length: anchor.width,
      min: minX,
      max: maxX,
    });
    horizontal = {
      left: cross.offset,
      width: cross.size,
      alignItems: cross.align,
    };
  }

  const spaceBelow = maxY - (anchor.y + anchor.height + offset);
  const spaceAbove = anchor.y - offset - minY;
  const openAbove =
    side === 'top'
      ? spaceAbove >= ANCHORED_MIN_HEIGHT || spaceAbove >= spaceBelow
      : spaceBelow < ANCHORED_MIN_HEIGHT && spaceAbove > spaceBelow;
  const height = Math.max(0, openAbove ? spaceAbove : spaceBelow);
  return {
    ...horizontal,
    top: openAbove ? minY : anchor.y + anchor.height + offset,
    height,
    justifyContent: openAbove ? 'flex-end' : 'flex-start',
    panelWidth,
    panelMaxHeight: limitHeight(height),
  };
}
