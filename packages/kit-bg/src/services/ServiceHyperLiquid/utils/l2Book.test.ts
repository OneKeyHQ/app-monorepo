import { buildL2BookByCoinRequest } from './l2Book';

describe('buildL2BookByCoinRequest', () => {
  it.each(['BTC', 'xyz:NVDA'])(
    'requests the raw, unaggregated book for %s',
    (coin) => {
      expect(buildL2BookByCoinRequest(coin)).toEqual({
        coin,
        nSigFigs: null,
      });
    },
  );
});
