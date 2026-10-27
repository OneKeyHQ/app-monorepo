export type IDrawingCanvasText = {
  defaultText: string;
  volume: string;
  // Indexed by absolute bar count; larger counts reuse `100 + count % 100`,
  // which keeps the integer plural form for every supported locale.
  bars: string[];
  target: string;
  stop: string;
  openPnl: string;
  closedPnl: string;
};

export const DRAWING_BARS_TEMPLATE_COUNT = 200;

export const DEFAULT_DRAWING_CANVAS_TEXT: IDrawingCanvasText = {
  defaultText: 'Text',
  volume: 'Vol {volume}',
  bars: Array.from({ length: DRAWING_BARS_TEMPLATE_COUNT }, (_, count) =>
    count === 1 ? '{count} bar, {duration}' : '{count} bars, {duration}',
  ),
  target: 'Target: {price}\n{amount} ({percent}%)',
  stop: 'Stop: {price}\n{amount} ({percent}%)',
  openPnl: 'Open P&L: {pnl}\nQty: {quantity}\nRisk/Reward Ratio: {ratio}',
  closedPnl: 'Closed P&L: {pnl}\nQty: {quantity}\nRisk/Reward Ratio: {ratio}',
};

export function getDrawingCanvasText(text: IDrawingCanvasText | undefined) {
  'worklet';
  return text ?? DEFAULT_DRAWING_CANVAS_TEXT;
}

export function formatDrawingText(
  template: string,
  values: Record<string, string>,
) {
  'worklet';
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? values[name] : match,
  );
}

export function getDrawingBarsTemplate(
  text: IDrawingCanvasText,
  count: number,
) {
  'worklet';
  const absolute = Math.abs(Math.round(count));
  return text.bars[
    absolute < text.bars.length ? absolute : 100 + (absolute % 100)
  ];
}
