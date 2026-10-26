import type { IKeyOfIcons } from '@onekeyhq/components';

import { ADDITIONAL_DRAWING_ICON_PATHS } from '../../drawings/additionalTools';

import type { IAdditionalDrawingTool } from '../../drawings/additionalTools';
import type { TRADING_VIEW_DRAWING_ICONS as ISharedDrawingIcons } from '../../drawings/icons';

type IDrawingIconDefinition = { icon: IKeyOfIcons } | { path: string };

// Match the project icons' 24 px grid, 2 px strokes and square corners.
export const TRADING_VIEW_DRAWING_ICONS = {
  ...(Object.fromEntries(
    Object.entries(ADDITIONAL_DRAWING_ICON_PATHS).map(([tool, path]) => [
      tool,
      { path },
    ]),
  ) as Record<IAdditionalDrawingTool, { path: string }>),
  measure: {
    path: 'm3 16 13-13 5 5L8 21zM13 6l2 2M10 9l3 3M7 12l2 2M4 15l3 3',
  },
  trend: { path: 'M8 16 16 8M4 16h4v4H4zM16 4h4v4h-4z' },
  ray: { path: 'M8 16 20 4M4 16h4v4H4zM14 4h6v6' },
  extended: { path: 'M3 21 21 3M3 15v6h6M15 3h6v6' },
  horizontal: { path: 'M3 12h6m6 0h6M10 10h4v4h-4z' },
  horizontalRay: { path: 'M8 12h13M16 7l5 5-5 5M4 10h4v4H4z' },
  vertical: { path: 'M12 3v6m0 6v6M10 10h4v4h-4z' },
  cross: { path: 'M12 3v6m0 6v6M3 12h6m6 0h6M10 10h4v4h-4z' },
  arrow: { icon: 'ArrowTopRightOutline' },
  info: {
    path: 'M4 16 16 4M11 4h5v5M10 13h11v8H10zM15.5 17v2M15.5 15v.1',
  },
  angle: { path: 'M20 20H4L18 6M12 20a8 8 0 0 0-2.34-5.66' },
  channel: { path: 'M3 15 15 3M9 21 21 9M6 18l3-3m3-3 3-3m3-3 1-1' },
  fib: { path: 'M4 4h16M4 9h16M4 14h16M4 20h16M6 20 18 4' },
  fibExtension: { path: 'M3 18 8 10l5 4 7-10M13 10h8M13 15h8M13 20h8' },
  fibChannel: { path: 'M3 9 17 3M3 14 21 6M3 19 21 11M9 21 21 16' },
  fibFan: { path: 'M4 20V4M4 20 10 4M4 20 20 4M4 20 20 13M4 20h16' },
  fibTime: { path: 'M4 4v16M8 4v16M13 4v16M21 4v16M4 18h17' },
  rectangle: { icon: 'BezierNodesOutline' },
  ellipse: { path: 'M3 12a9 7 0 1 0 18 0 9 7 0 1 0-18 0Z' },
  triangle: { icon: 'ArrowTriangleTopOutline' },
  brush: { icon: 'BrushOutline' },
  highlighter: { icon: 'HighlightOutline' },
  text: { icon: 'TextOutline' },
  callout: { icon: 'MessageTextOutline' },
  priceLabel: { icon: 'TagOutline' },
  priceRange: { path: 'M5 4h14M5 20h14M12 5v14M8 9l4-4 4 4M8 15l4 4 4-4' },
  dateRange: { path: 'M4 5v14M20 5v14M5 12h14M9 8l-4 4 4 4M15 8l4 4-4 4' },
  datePriceRange: {
    path: 'M4 10V4h6M14 20h6v-6M5 19 19 5M5 13v6h6M13 5h6v6',
  },
  cursor: { path: 'M12 3v7m0 4v7M3 12h7m4 0h7' },
  undo: { icon: 'UndoOutline' },
  redo: { icon: 'UndoFlipHorOutline' },
  magnet: {
    path: 'M4 4h5v8a3 3 0 0 0 6 0V4h5v8a8 8 0 0 1-16 0V4ZM4 8h5M15 8h5',
  },
  lock: { icon: 'LockOutline' },
  unlock: { icon: 'UnlockedOutline' },
  hide: { icon: 'EyeOutline' },
  show: { icon: 'EyeOffOutline' },
  delete: { icon: 'DeleteOutline' },
  stay: {
    path: 'M4 14 14 4l4 4L8 18H4v-4ZM11 7l4 4M5 21h9a6 6 0 0 0 6-6v-3M17 15l3-3 3 3',
  },
  chevron: { icon: 'ChevronRightSmallOutline' },
  objects: { icon: 'Layers3Outline' },
  data: { icon: 'TableOutline' },
} as const satisfies Record<
  keyof typeof ISharedDrawingIcons,
  IDrawingIconDefinition
>;
