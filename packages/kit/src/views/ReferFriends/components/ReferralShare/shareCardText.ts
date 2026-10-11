// Text layout for the canvas share card: greedy wrapping over colored runs
// and single-line truncation, measured with the canvas's current font.

// CJK and full-width characters wrap one at a time; other text wraps by word.
const SEGMENT_PATTERN = /\s+|[⺀-鿿가-힯぀-ヿ＀-￯]|[^\s⺀-鿿가-힯぀-ヿ＀-￯]+/g;

export type ITextRun = { text: string; color: string };

// Only the measuring part of a canvas context is needed.
type ITextMeasurer = Pick<CanvasRenderingContext2D, 'measureText'>;

// A segment wider than the line (a script without spaces such as Thai, or a
// long compound word) breaks between characters instead of overflowing.
function splitOversized(ctx: ITextMeasurer, segment: string, maxWidth: number) {
  return segment.trim() && ctx.measureText(segment).width > maxWidth
    ? Array.from(segment)
    : [segment];
}

// Greedy wrap over colored runs; whitespace never starts a line.
export function wrapRuns(
  ctx: ITextMeasurer,
  runs: ITextRun[],
  maxWidth: number,
): ITextRun[][] {
  const lines: ITextRun[][] = [];
  let line: ITextRun[] = [];
  let lineWidth = 0;
  runs.forEach((run) => {
    (run.text.match(SEGMENT_PATTERN) ?? [])
      .flatMap((segment) => splitOversized(ctx, segment, maxWidth))
      .forEach((segment) => {
        const isSpace = !segment.trim();
        if (isSpace && line.length === 0) {
          return;
        }
        const width = ctx.measureText(segment).width;
        if (line.length > 0 && !isSpace && lineWidth + width > maxWidth) {
          lines.push(line);
          line = [];
          lineWidth = 0;
        }
        line.push({ text: segment, color: run.color });
        lineWidth += width;
      });
  });
  if (line.length > 0) {
    lines.push(line);
  }
  return lines;
}

export function truncateToWidth(
  ctx: ITextMeasurer,
  text: string,
  maxWidth: number,
) {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let result = text;
  while (result.length > 0 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}
