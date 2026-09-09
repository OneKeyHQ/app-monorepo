import { formatBboModeLabel } from './bboDisplay';

describe('formatBboModeLabel', () => {
  it.each([
    ['Counterparty 1', 0, 'Counterparty 1'],
    ['Counterparty 1', 5, 'Counterparty 5'],
    ['Queue 1', 5, 'Queue 5'],
    ['对手价 1', 5, '对手价 5'],
    ['同向价 1', 5, '同向价 5'],
  ] as const)('formats %s at offset %i as %s', (label, offset, expected) => {
    expect(formatBboModeLabel(label, offset)).toBe(expected);
  });
});
