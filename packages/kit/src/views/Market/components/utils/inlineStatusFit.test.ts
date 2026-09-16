import { shouldShowOptionalSegment } from './inlineStatusFit';

describe('shouldShowOptionalSegment', () => {
  it('keeps the segment while the row still fits', () => {
    expect(
      shouldShowOptionalSegment({ availableWidth: 420, contentWidth: 380 }),
    ).toBe(true);
  });

  it('keeps the segment when the row fills its space exactly', () => {
    expect(
      shouldShowOptionalSegment({ availableWidth: 380, contentWidth: 380 }),
    ).toBe(true);
  });

  it('drops the segment once a translation outgrows the row', () => {
    expect(
      shouldShowOptionalSegment({ availableWidth: 380, contentWidth: 520 }),
    ).toBe(false);
  });

  it.each([
    ['the row', { availableWidth: 0, contentWidth: 520 }],
    ['the content', { availableWidth: 380, contentWidth: 0 }],
  ])('renders the segment before %s is measured', (_label, sizes) => {
    expect(shouldShowOptionalSegment(sizes)).toBe(true);
  });
});
