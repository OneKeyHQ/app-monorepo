import {
  DRAWING_CHEVRON_PATH,
  DRAWING_ICON_PATHS,
  DRAWING_ICON_STROKE_WIDTH,
} from './iconPaths';

const toSvgXml = (path: string, viewBox: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="${DRAWING_ICON_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;

// currentColor lets native SvgXml inherit the active or idle tint.
export const TRADING_VIEW_DRAWING_ICONS = {
  ...(Object.fromEntries(
    Object.entries(DRAWING_ICON_PATHS).map(([name, path]) => [
      name,
      toSvgXml(path, '0 0 24 24'),
    ]),
  ) as Record<keyof typeof DRAWING_ICON_PATHS, string>),
  chevron: toSvgXml(DRAWING_CHEVRON_PATH, '0 0 12 16'),
};
