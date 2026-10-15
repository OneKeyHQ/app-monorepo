import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import {
  XMR_UNKNOWN_COUNTERPARTY,
  buildXmrLocalHistoryTx,
} from './localHistory';

import type { IXmrHistoryItem } from './types';

const OWN =
  '468bCTr2Sa9AR2hJ4aBuQu4JkQtLWx6qe6NZWxW7wkcCVG7rLxNagUPdcsB4DJZi3t5TY8grqUfmaW38vHxQimo9SV2g7TZ';
const PAID =
  '4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skxNgYeYTRj5UzqtReoS44qo9mtmXCqY45DJ852K5Jv2684Rge';

const nativeToken = {
  address: '',
  logoURI: '',
  name: 'Monero',
  symbol: 'XMR',
};

function build(item: Partial<IXmrHistoryItem>, recipient?: string) {
  return buildXmrLocalHistoryTx({
    item: {
      txid: 'aa',
      height: 100,
      direction: 'in',
      receivedAtomic: '0',
      spentAtomic: '0',
      timestamp: 1_700_000_000,
      ...item,
    },
    chainTip: 3_767_832,
    ownAddress: OWN,
    recipient,
    nativeToken,
    networkId: 'xmr--0',
    accountId: 'hd-1--x',
    accountAddress: OWN,
    buildTransferAction: async ({ from, to, transfers }) =>
      ({ from, to, transfers }) as never,
  });
}

describe('xmr history rows', () => {
  /**
   * An outgoing transaction's own outputs include the change coming back. The
   * amount that left is what was spent minus what returned -- reporting the
   * gross spend would show a send of the whole input, which for a wallet with
   * one large output reads as "I just sent my entire balance".
   */
  it('nets the change out of an outgoing amount', async () => {
    const row = await build({
      direction: 'out',
      spentAtomic: '5000000000000',
      receivedAtomic: '4000000000000',
    });
    expect(row.decodedTx.nativeAmount).toBe('1');
    expect(row.decodedTx.nativeAmountIsUnknown).toBe(true);
  });

  // Before the change is scanned, spent minus received is the whole input set.
  it('shows a pending send at the amount recorded when it was broadcast', async () => {
    const row = await build({
      direction: 'out',
      height: null,
      spentAtomic: '5000000000000',
      receivedAtomic: '0',
      outgoingAtomic: '1000000000000',
    });
    expect(row.decodedTx.nativeAmount).toBe('1');
    expect(row.decodedTx.nativeAmountIsUnknown).toBe(true);
    expect(row.decodedTx.status).toBe(EDecodedTxStatus.Pending);
  });

  it('shows a send the node never took as failed', async () => {
    const row = await build({ direction: 'out', height: null, failed: true });
    expect(row.decodedTx.status).toBe(EDecodedTxStatus.Failed);
  });

  it('reports an incoming amount as received', async () => {
    const row = await build({
      direction: 'in',
      receivedAtomic: '250000000000',
    });
    expect(row.decodedTx.nativeAmount).toBe('0.25');
  });

  /**
   * Monero's whole design is that the payer is not derivable from the chain.
   * An empty address renders as a missing value the user might read as a bug,
   * or worse as their own address.
   */
  it('labels the unknowable sender instead of leaving it blank', async () => {
    const row = await build({ direction: 'in', receivedAtomic: '1' });
    const action = row.decodedTx.actions[0] as unknown as { from: string };
    expect(action.from).toBe(XMR_UNKNOWN_COUNTERPARTY);
    expect(XMR_UNKNOWN_COUNTERPARTY).toBe('Private');
  });

  it('shows the recipient we recorded at broadcast', async () => {
    const row = await build({ direction: 'out', spentAtomic: '1' }, PAID);
    const action = row.decodedTx.actions[0] as unknown as { to: string };
    expect(action.to).toBe(PAID);
  });

  /**
   * After a rescan the recording is gone -- nothing on chain carries it. The
   * row must still render rather than showing an empty destination.
   */
  it('falls back to the label when the recipient was never recorded', async () => {
    const row = await build({ direction: 'out', spentAtomic: '1' });
    const action = row.decodedTx.actions[0] as unknown as { to: string };
    expect(action.to).toBe(XMR_UNKNOWN_COUNTERPARTY);
  });

  /**
   * An unmined transaction has no block time. Without a stand-in it sorts to
   * the bottom of the list, because the sort key falls back to 0 -- the newest
   * transaction would appear oldest.
   */
  it('gives a pending transaction a timestamp so it sorts to the top', async () => {
    const before = Date.now();
    const row = await build({ height: null, timestamp: null });
    expect(row.decodedTx.status).toBe(EDecodedTxStatus.Pending);
    expect(row.decodedTx.createdAt).toBeGreaterThanOrEqual(before);
  });

  it('marks a mined transaction confirmed', async () => {
    const row = await build({ height: 3_767_827 });
    expect(row.decodedTx.status).toBe(EDecodedTxStatus.Confirmed);
    expect(row.decodedTx.createdAt).toBe(1_700_000_000_000);
    expect(row.decodedTx.block).toBe(3_767_827);
    expect(row.decodedTx.confirmations).toBe(6);
  });
});
