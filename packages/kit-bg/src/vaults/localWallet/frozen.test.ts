import { sumLocalWalletFrozen } from './frozen';

describe('sumLocalWalletFrozen', () => {
  it('sums each reason across pools', () => {
    expect(
      sumLocalWalletFrozen([
        {
          key: 'transparent',
          hints: [],
          frozen: [{ reason: 'confirming', amountParsed: '0.1' }],
        },
        {
          key: 'ironwood',
          hints: [],
          frozen: [
            { reason: 'pendingSend', amountParsed: '0.25' },
            { reason: 'confirming', amountParsed: '0.2' },
          ],
        },
        { key: 'orchard', hints: [] },
      ]),
    ).toEqual([
      { reason: 'confirming', amountParsed: '0.3' },
      { reason: 'pendingSend', amountParsed: '0.25' },
    ]);
  });
});
