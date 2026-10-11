import { truncateToWidth, wrapRuns } from './shareCardText';

// One unit of width per character keeps the expected lines readable.
const ctx = { measureText: (text: string) => ({ width: text.length }) } as Pick<
  CanvasRenderingContext2D,
  'measureText'
>;

function lineTexts(lines: ReturnType<typeof wrapRuns>) {
  return lines.map((line) => line.map((run) => run.text).join(''));
}

describe('wrapRuns', () => {
  it('wraps by word and never starts a line with a space', () => {
    const lines = wrapRuns(ctx, [{ text: 'save up to 10%', color: 'a' }], 8);
    expect(lineTexts(lines)).toEqual(['save up ', 'to 10%']);
  });

  it('wraps CJK one character at a time', () => {
    const lines = wrapRuns(ctx, [{ text: '邀请好友一起赚', color: 'a' }], 3);
    expect(lineTexts(lines)).toEqual(['邀请好', '友一起', '赚']);
  });

  it('breaks a segment wider than the line instead of overflowing', () => {
    // Thai has no spaces between words, so it arrives as one long segment.
    const thai = 'รับส่วนลดค่าธรรมเนียม';
    const lines = wrapRuns(ctx, [{ text: thai, color: 'a' }], 8);
    expect(lines.length).toBeGreaterThan(1);
    expect(lineTexts(lines).every((line) => line.length <= 8)).toBe(true);
    expect(lineTexts(lines).join('')).toBe(thai);
  });

  it('keeps each run its own color across a wrap', () => {
    const lines = wrapRuns(
      ctx,
      [
        { text: 'Save ', color: 'text' },
        { text: '10%', color: 'accent' },
      ],
      4,
    );
    expect(lines.at(-1)).toEqual([{ text: '10%', color: 'accent' }]);
  });
});

describe('truncateToWidth', () => {
  it('keeps text that fits', () => {
    expect(truncateToWidth(ctx, 'HTSEO7', 6)).toBe('HTSEO7');
  });

  it('ends text that does not fit with an ellipsis', () => {
    expect(truncateToWidth(ctx, 'onekey.so/r/HTSEO7', 8)).toBe('onekey.…');
  });
});
