import { formatNextHalving } from './formatNextHalving';

describe('formatNextHalving', () => {
  it('returns ~Imminent for non-positive seconds', () => {
    expect(formatNextHalving(0)).toBe('~Imminent');
    expect(formatNextHalving(-100)).toBe('~Imminent');
  });

  it('formats < 30 days as days + hours, omitting hours when 0', () => {
    // 12 days 5 hours
    expect(formatNextHalving(12 * 86400 + 5 * 3600)).toBe('~12 days 5 hours');
    // 1 day 1 hour (singular forms)
    expect(formatNextHalving(86400 + 3600)).toBe('~1 day 1 hour');
    // exactly 1 day, hours = 0 -> omit hours
    expect(formatNextHalving(86400)).toBe('~1 day');
    // 29 days, hours = 0
    expect(formatNextHalving(29 * 86400)).toBe('~29 days');
    // exactly 1 hour
    expect(formatNextHalving(3600)).toBe('~0 days 1 hour');
  });

  it('formats 30d <= seconds < 365d as days only', () => {
    expect(formatNextHalving(30 * 86400)).toBe('~30 days');
    expect(formatNextHalving(120 * 86400)).toBe('~120 days');
    expect(formatNextHalving(364 * 86400)).toBe('~364 days');
  });

  it('formats >= 365d as years + days, omitting days when 0', () => {
    // exactly 1 year (365 days)
    expect(formatNextHalving(365 * 86400)).toBe('~1 year');
    // 1 year 1 day (singulars)
    expect(formatNextHalving(366 * 86400)).toBe('~1 year 1 day');
    // 3 years 45 days
    expect(formatNextHalving((3 * 365 + 45) * 86400)).toBe('~3 years 45 days');
    // 1100 days = 3 years 5 days
    expect(formatNextHalving(1100 * 86400)).toBe('~3 years 5 days');
    // sample value from backend (66_630_489 s)
    expect(formatNextHalving(66_630_489)).toBe('~2 years 41 days');
  });

  it('floors fractional inputs', () => {
    expect(formatNextHalving(86400 + 3599)).toBe('~1 day');
    expect(formatNextHalving(2 * 86400 + 3599)).toBe('~2 days');
  });
});
