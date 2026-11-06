import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import {
  WALLET_ACTIVITY_HINT_WINDOW_MS,
  WALLET_ACTIVITY_SEEN_SCOPE_LIMIT,
  getWalletActivityHintAmount,
  getWalletActivityTxTime,
  initWalletActivityHintTransition,
  selectWalletActivityHint,
  settleWalletActivityHintTransition,
  updateWalletActivityHintTransition,
  updateWalletActivitySeenMap,
} from './walletActivityHintUtils';

import type { IWalletActivityHint } from './walletActivityHintUtils';

const NOW = 1_800_000_000_000;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function tx({
  id,
  status = EDecodedTxStatus.Confirmed,
  agoMs,
  displayStatus,
}: {
  id: string;
  status?: EDecodedTxStatus;
  agoMs: number;
  displayStatus?: EDecodedTxStatus;
}): IAccountHistoryTx {
  return {
    id,
    displayStatus,
    decodedTx: {
      txid: id,
      status,
      createdAt: NOW - agoMs,
      updatedAt: NOW - agoMs,
    },
  } as unknown as IAccountHistoryTx;
}

describe('selectWalletActivityHint', () => {
  it('shows nothing without activity', () => {
    expect(
      selectWalletActivityHint({ txs: [], seenAt: undefined, now: NOW }),
    ).toBeUndefined();
  });

  it('leads with pending activity, even when it is older or seen', () => {
    const result = selectWalletActivityHint({
      txs: [
        tx({ id: 'received', agoMs: 5 * MINUTE }),
        tx({
          id: 'sending',
          status: EDecodedTxStatus.Pending,
          agoMs: 2 * HOUR,
        }),
      ],
      seenAt: NOW - MINUTE,
      now: NOW,
    });
    expect(result?.lead.id).toBe('sending');
    expect(result?.status).toBe('pending');
  });

  it('leads with the newest pending send when several are open', () => {
    const result = selectWalletActivityHint({
      txs: [
        tx({ id: 'p2', status: EDecodedTxStatus.Pending, agoMs: 3 * MINUTE }),
        tx({ id: 'swap', agoMs: 12 * MINUTE }),
        tx({ id: 'p1', status: EDecodedTxStatus.Pending, agoMs: MINUTE }),
      ],
      seenAt: undefined,
      now: NOW,
    });
    expect(result?.lead.id).toBe('p1');
  });

  it('shows the newest unseen activity of the last day', () => {
    const result = selectWalletActivityHint({
      txs: [
        tx({ id: 'older', agoMs: 3 * HOUR }),
        tx({ id: 'newest', agoMs: 12 * MINUTE }),
      ],
      seenAt: undefined,
      now: NOW,
    });
    expect(result?.lead.id).toBe('newest');
    expect(result?.status).toBe('done');
  });

  it('drops activity once it has been seen', () => {
    const txs = [
      tx({ id: 'before', agoMs: 2 * HOUR }),
      tx({ id: 'after', agoMs: 10 * MINUTE }),
    ];
    const result = selectWalletActivityHint({
      txs,
      seenAt: NOW - HOUR,
      now: NOW,
    });
    expect(result?.lead.id).toBe('after');
    expect(
      selectWalletActivityHint({ txs, seenAt: NOW, now: NOW }),
    ).toBeUndefined();
  });

  it('drops completed activity older than a day', () => {
    expect(
      selectWalletActivityHint({
        txs: [
          tx({ id: 'old', agoMs: WALLET_ACTIVITY_HINT_WINDOW_MS + MINUTE }),
        ],
        seenAt: undefined,
        now: NOW,
      }),
    ).toBeUndefined();
  });

  it('reports failed and dropped sends as failed', () => {
    expect(
      selectWalletActivityHint({
        txs: [tx({ id: 'f', status: EDecodedTxStatus.Failed, agoMs: MINUTE })],
        seenAt: undefined,
        now: NOW,
      })?.status,
    ).toBe('failed');
    expect(
      selectWalletActivityHint({
        txs: [tx({ id: 'd', status: EDecodedTxStatus.Dropped, agoMs: MINUTE })],
        seenAt: undefined,
        now: NOW,
      })?.status,
    ).toBe('failed');
  });

  it('follows the display status the History row shows', () => {
    const result = selectWalletActivityHint({
      txs: [
        tx({
          id: 'private',
          status: EDecodedTxStatus.Confirmed,
          displayStatus: EDecodedTxStatus.Pending,
          agoMs: MINUTE,
        }),
      ],
      seenAt: NOW,
      now: NOW,
    });
    expect(result?.status).toBe('pending');
  });

  it('never surfaces removed rows', () => {
    expect(
      selectWalletActivityHint({
        txs: [tx({ id: 'r', status: EDecodedTxStatus.Removed, agoMs: MINUTE })],
        seenAt: undefined,
        now: NOW,
      }),
    ).toBeUndefined();
  });
});

describe('getWalletActivityTxTime', () => {
  it('reads seconds as milliseconds', () => {
    const seconds = Math.floor(NOW / 1000);
    expect(
      getWalletActivityTxTime({
        decodedTx: { createdAt: seconds },
      } as unknown as IAccountHistoryTx),
    ).toBe(seconds * 1000);
  });
});

describe('getWalletActivityHintAmount', () => {
  const received = {
    key: 'primary',
    text: '+150 USDC',
    tone: 'positive' as const,
  };

  it('keeps the signed amount of a send or receive', () => {
    expect(
      getWalletActivityHintAmount({ direction: 'receive', primary: received }),
    ).toBe(received);
  });

  it('keeps only what arrived for a two-sided action', () => {
    const arrived = {
      key: 'primary',
      text: '+0.0006663 ETH',
      tone: 'positive' as const,
    };
    expect(
      getWalletActivityHintAmount({ direction: 'both', primary: arrived }),
    ).toBe(arrived);
  });

  it('drops placeholders and non-transfers', () => {
    expect(
      getWalletActivityHintAmount({
        direction: 'send',
        primary: { key: 'primary', text: '-', tone: 'primary' },
      }),
    ).toBeUndefined();
    expect(
      getWalletActivityHintAmount({ direction: undefined, primary: received }),
    ).toBeUndefined();
  });
});

describe('updateWalletActivitySeenMap', () => {
  it('keeps only the most recently seen scopes', () => {
    const seenMap = Object.fromEntries(
      Array.from({ length: WALLET_ACTIVITY_SEEN_SCOPE_LIMIT }, (_, i) => [
        `scope-${i}`,
        i,
      ]),
    );
    const next = updateWalletActivitySeenMap({
      seenMap,
      scopeKey: 'new',
      seenAt: NOW,
    });
    expect(Object.keys(next)).toHaveLength(WALLET_ACTIVITY_SEEN_SCOPE_LIMIT);
    expect(next.new).toBe(NOW);
    expect(next['scope-0']).toBeUndefined();
  });
});

describe('wallet activity line transition', () => {
  const hint = (key: string, when = '1 minute ago'): IWalletActivityHint => ({
    key,
    status: 'done',
    amount: { key: 'primary', text: '+150 USDC', tone: 'positive' },
    when,
  });
  const shown = (key: string) =>
    initWalletActivityHintTransition({ hint: hint(key), instantKey: 'k' });

  it('starts at rest, without motion', () => {
    expect(shown('a').phase).toBe('shown');
    expect(
      initWalletActivityHintTransition({ hint: undefined, instantKey: 'k' })
        .phase,
    ).toBe('hidden');
  });

  it('keeps the same state when nothing on the line changed', () => {
    const state = shown('a');
    expect(
      updateWalletActivityHintTransition(state, {
        hint: hint('a'),
        instantKey: 'k',
      }),
    ).toBe(state);
  });

  it('folds a new line open, then rests', () => {
    const hidden = initWalletActivityHintTransition({
      hint: undefined,
      instantKey: 'k',
    });
    const entering = updateWalletActivityHintTransition(hidden, {
      hint: hint('a'),
      instantKey: 'k',
    });
    expect(entering.phase).toBe('entering');
    expect(entering.drawn?.key).toBe('a');
    expect(settleWalletActivityHintTransition(entering).phase).toBe('shown');
  });

  it('folds away still drawing the last words, then is gone', () => {
    const exiting = updateWalletActivityHintTransition(shown('a'), {
      hint: undefined,
      instantKey: 'k',
    });
    expect(exiting.phase).toBe('exiting');
    expect(exiting.drawn?.key).toBe('a');
    const gone = settleWalletActivityHintTransition(exiting);
    expect(gone.phase).toBe('hidden');
    expect(gone.drawn).toBeUndefined();
  });

  it('reopens a line that was folding away', () => {
    const exiting = updateWalletActivityHintTransition(shown('a'), {
      hint: undefined,
      instantKey: 'k',
    });
    expect(
      updateWalletActivityHintTransition(exiting, {
        hint: hint('b'),
        instantKey: 'k',
      }),
    ).toMatchObject({ phase: 'entering', drawn: { key: 'b' } });
  });

  it('cross-fades a new event and updates the same event in place', () => {
    const swapped = updateWalletActivityHintTransition(shown('a'), {
      hint: hint('b'),
      instantKey: 'k',
    });
    expect(swapped.leaving?.key).toBe('a');
    expect(swapped.drawn?.key).toBe('b');
    const ticked = updateWalletActivityHintTransition(shown('a'), {
      hint: hint('a', '2 minutes ago'),
      instantKey: 'k',
    });
    expect(ticked.leaving).toBeUndefined();
    expect(ticked.drawn?.when).toBe('2 minutes ago');
  });

  it('lands without motion when the instant key changes', () => {
    expect(
      updateWalletActivityHintTransition(shown('a'), {
        hint: undefined,
        instantKey: 'seen',
      }).phase,
    ).toBe('hidden');
    expect(
      updateWalletActivityHintTransition(shown('a'), {
        hint: hint('b'),
        instantKey: 'other account',
      }),
    ).toMatchObject({
      phase: 'shown',
      leaving: undefined,
      drawn: { key: 'b' },
    });
  });
});
