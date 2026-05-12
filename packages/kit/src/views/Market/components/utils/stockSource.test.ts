import { isOndoStockSource } from './stockSource';

describe('isOndoStockSource', () => {
  it.each(['coingecko', 'Coingecko', ' ondo ', 'ONDO'])(
    'treats %s as Ondo source',
    (source) => {
      expect(isOndoStockSource(source)).toBe(true);
    },
  );

  it.each(['xstock', 'xstocks', '', '  ', undefined, null])(
    'does not treat %s as Ondo source',
    (source) => {
      expect(isOndoStockSource(source)).toBe(false);
    },
  );
});
