import { formatNextHalving } from './formatNextHalving';

const fmt = {
  y: (n: number) => `${n}Y`,
  d: (n: number) => `${n}D`,
  h: (n: number) => `${n}H`,
  imminent: () => 'Imminent',
};

describe('formatNextHalving', () => {
  it('returns ~Imminent for non-positive seconds', () => {
    expect(formatNextHalving(0, fmt)).toBe('~Imminent');
    expect(formatNextHalving(-100, fmt)).toBe('~Imminent');
  });

  it('returns ~Imminent for positive sub-hour values', () => {
    expect(formatNextHalving(1, fmt)).toBe('~Imminent');
    expect(formatNextHalving(3599, fmt)).toBe('~Imminent');
  });

  it('formats < 30 days with hour-only output below 1 day', () => {
    expect(formatNextHalving(12 * 86_400 + 5 * 3600, fmt)).toBe('~12D 5H');
    expect(formatNextHalving(86_400 + 3600, fmt)).toBe('~1D 1H');
    expect(formatNextHalving(86_400, fmt)).toBe('~1D');
    expect(formatNextHalving(29 * 86_400, fmt)).toBe('~29D');
    expect(formatNextHalving(3600, fmt)).toBe('~1H');
    expect(formatNextHalving(23 * 3600, fmt)).toBe('~23H');
  });

  it('formats 30d <= seconds < 365d as days only', () => {
    expect(formatNextHalving(30 * 86_400, fmt)).toBe('~30D');
    expect(formatNextHalving(120 * 86_400, fmt)).toBe('~120D');
    expect(formatNextHalving(364 * 86_400, fmt)).toBe('~364D');
  });

  it('formats >= 365d as years + days, omitting days when 0', () => {
    expect(formatNextHalving(365 * 86_400, fmt)).toBe('~1Y');
    expect(formatNextHalving(366 * 86_400, fmt)).toBe('~1Y 1D');
    expect(formatNextHalving((3 * 365 + 45) * 86_400, fmt)).toBe('~3Y 45D');
    expect(formatNextHalving(1100 * 86_400, fmt)).toBe('~3Y 5D');
    expect(formatNextHalving(66_630_489, fmt)).toBe('~2Y 41D');
  });

  it('floors fractional inputs', () => {
    expect(formatNextHalving(86_400 + 3599, fmt)).toBe('~1D');
    expect(formatNextHalving(2 * 86_400 + 3599, fmt)).toBe('~2D');
  });
});
