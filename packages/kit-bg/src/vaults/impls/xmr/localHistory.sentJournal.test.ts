import { SimpleDbEntityPrivacyChainXmrSent } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainXmrSent';

import { buildXmrLocalHistoryTx, toXmrSentAmount } from './localHistory';

import type { IXmrHistoryItem } from './types';
import type { IXmrSentAmount } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainXmrSent';

const ACCOUNT_ID = 'hd-1--x';
const OWN = '4-synthetic-own';

type IRecordCall = {
  txid: string;
  recipient: string;
  amountAtomic?: string;
  feeAtomic?: string;
  broadcastOutcomeUnknown?: boolean;
};

// Every recordSentRecipient call shape the broadcast path can make.
const RECORD_CALLS: IRecordCall[] = [
  { txid: 'legacy', recipient: '4-paid-legacy' },
  {
    txid: 'accepted',
    recipient: '4-paid-accepted',
    amountAtomic: '1000000000000',
    feeAtomic: '30000000',
  },
  {
    txid: 'unknown',
    recipient: '4-paid-unknown',
    amountAtomic: '2500000000000',
    feeAtomic: '40000000',
    broadcastOutcomeUnknown: true,
  },
  { txid: 'half', recipient: '4-paid-half', amountAtomic: '7' },
  // A second, recipient-only write keeps the amounts already recorded.
  {
    txid: 'rewritten',
    recipient: '4-paid-first',
    amountAtomic: '3000000000000',
    feeAtomic: '10000000',
  },
  { txid: 'rewritten', recipient: '4-paid-second' },
  { txid: 'empty-recipient', recipient: '' },
];

// What the retired `xmr.sentRecipients` / `xmr.sentAmounts` builder stored.
function recordLegacy(calls: IRecordCall[]) {
  const sentRecipients: Record<string, string> = {};
  const sentAmounts: Record<string, IXmrSentAmount> = {};
  for (const call of calls) {
    sentRecipients[call.txid] = call.recipient;
    if (call.amountAtomic !== undefined && call.feeAtomic !== undefined) {
      sentAmounts[call.txid] = {
        amountAtomic: call.amountAtomic,
        feeAtomic: call.feeAtomic,
        ...(call.broadcastOutcomeUnknown
          ? { broadcastOutcomeUnknown: true }
          : {}),
      };
    }
  }
  return { sentRecipients, sentAmounts };
}

const ITEMS: IXmrHistoryItem[] = [
  ...[
    'legacy',
    'accepted',
    'unknown',
    'half',
    'rewritten',
    'empty-recipient',
  ].map(
    (txid, index): IXmrHistoryItem => ({
      txid,
      height: index % 2 === 0 ? 3_700_000 + index : null,
      timestamp: index % 2 === 0 ? 1_700_000_000 + index : null,
      direction: 'out',
      spentAtomic: '5000000000000',
      receivedAtomic: '1000000000000',
      outgoingAtomic: index === 1 ? '1030000000000' : undefined,
    }),
  ),
  {
    txid: 'not-from-this-device',
    height: 3_700_100,
    timestamp: 1_700_000_100,
    direction: 'out',
    spentAtomic: '2000000000000',
    receivedAtomic: '0',
  },
  {
    txid: 'incoming',
    height: 3_700_200,
    timestamp: 1_700_000_200,
    direction: 'in',
    spentAtomic: '0',
    receivedAtomic: '250000000000',
  },
];

function buildRow(
  item: IXmrHistoryItem,
  recipient: string | undefined,
  sentAmount: IXmrSentAmount | undefined,
) {
  return buildXmrLocalHistoryTx({
    item,
    chainTip: 3_767_832,
    ownAddress: OWN,
    recipient,
    sentAmount,
    nativeToken: { address: '', logoURI: '', name: 'Monero', symbol: 'XMR' },
    networkId: 'xmr--0',
    accountId: ACCOUNT_ID,
    accountAddress: OWN,
    buildTransferAction: async ({ from, to, transfers }) =>
      ({ from, to, transfers }) as never,
  });
}

describe('xmr history rows from the merged sent journal', () => {
  it('match the rows built from the separate recipient and amount maps', async () => {
    jest.useFakeTimers({ now: 1_800_000_000_000 });
    try {
      const legacy = recordLegacy(RECORD_CALLS);

      let saved: unknown = null;
      const journal = new SimpleDbEntityPrivacyChainXmrSent();
      Reflect.set(journal, 'appStorage', {
        getItem: async () => saved,
        setItem: async (_key: string, value: unknown) => {
          saved = value;
        },
      });
      for (const call of RECORD_CALLS) {
        await journal.recordXmrSent({
          accountId: ACCOUNT_ID,
          txid: call.txid,
          recipient: call.recipient,
          amountAtomic: call.amountAtomic,
          feeAtomic: call.feeAtomic,
          outcomeUnknown: call.broadcastOutcomeUnknown,
        });
      }
      const records = await journal.listXmrSent({ accountId: ACCOUNT_ID });

      for (const item of ITEMS) {
        const before = await buildRow(
          item,
          legacy.sentRecipients[item.txid],
          legacy.sentAmounts[item.txid],
        );
        const after = await buildRow(
          item,
          records[item.txid]?.recipient,
          toXmrSentAmount(records[item.txid]),
        );
        expect(after).toEqual(before);
      }
    } finally {
      jest.useRealTimers();
    }
  });
});
