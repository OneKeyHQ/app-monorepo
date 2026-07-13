import { formatDisplayPairName } from './utils';

describe('formatDisplayPairName', () => {
  it('keeps pair names with three or fewer slash segments unchanged', () => {
    expect(formatDisplayPairName('Aquifer')).toBe('Aquifer');
    expect(formatDisplayPairName('A/B/C')).toBe('A/B/C');
  });

  it('keeps the first three slash segments and appends ellipsis', () => {
    expect(formatDisplayPairName('A/B/C/D')).toBe('A/B/C...');
    expect(formatDisplayPairName('A/B/C/D/E')).toBe('A/B/C...');
  });
});
