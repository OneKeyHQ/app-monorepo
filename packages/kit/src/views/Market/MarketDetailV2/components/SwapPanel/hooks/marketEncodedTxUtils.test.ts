import type { IEncodedTx } from '@onekeyhq/core/src/types';

import { isEncodedTxMatch } from './marketEncodedTxUtils';

describe('marketEncodedTxUtils', () => {
  it('matches encoded tx objects by value', () => {
    expect(
      isEncodedTxMatch(
        {
          data: '0xswap',
          to: '0xrouter',
        } as IEncodedTx,
        {
          data: '0xswap',
          to: '0xrouter',
        } as IEncodedTx,
      ),
    ).toBe(true);
  });

  it('matches aptos rawSignTx payloads without any casts', () => {
    expect(
      isEncodedTxMatch(
        {
          rawSignTx: '0xabc',
        } as IEncodedTx,
        {
          rawSignTx: '0xabc',
        } as IEncodedTx,
      ),
    ).toBe(true);
  });

  it('does not match different encoded tx payloads', () => {
    expect(
      isEncodedTxMatch(
        {
          data: '0xapprove',
        } as IEncodedTx,
        {
          rawSignTx: '0xabc',
        } as IEncodedTx,
      ),
    ).toBe(false);
  });
});
