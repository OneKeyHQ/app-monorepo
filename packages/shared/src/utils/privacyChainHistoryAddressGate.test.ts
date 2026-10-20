import { EOnChainHistoryTransferType } from '../../types/history';
import { EDecodedTxActionType } from '../../types/tx';

import {
  buildLocalWalletHistoryAddressGate,
  gateLocalWalletHistoryDetail,
  gateLocalWalletHistoryTx,
} from './privacyChainHistoryAddressGate';

import type {
  IAccountHistoryTx,
  IOnChainHistoryTx,
  IOnChainHistoryTxTransfer,
} from '../../types/history';
import type { IDecodedTxTransferInfo } from '../../types/tx';

const T1 = `t1${'A'.repeat(33)}`;
const LEGACY_CHANGE = `t1${'H'.repeat(33)}`;
const EXTERNAL = `t1${'E'.repeat(33)}`;
const UA = `u1${'q'.repeat(90)}`;
const DIVERSIFIED = `u1${'d'.repeat(90)}`;
const XMR_PRIMARY = `4${'A'.repeat(94)}`;

const zcash = {
  pools: [
    { id: 0, kind: 'public' as const },
    { id: 4, kind: 'private' as const },
  ],
  publicAddressPattern: '^t[13][1-9A-HJ-NP-Za-km-z]{33}$',
  addressForms: { publicLabel: 'transparent' },
};
const zcashGate = (privateAddress?: string) =>
  buildLocalWalletHistoryAddressGate({
    localWallet: zcash,
    addresses: { publicAddress: T1, privateAddress },
    ownerAddress: T1,
  });

const info = (
  overrides: Partial<IDecodedTxTransferInfo>,
): IDecodedTxTransferInfo => ({
  from: '',
  to: '',
  amount: '1',
  icon: '',
  name: '',
  symbol: 'ZEC',
  tokenIdOnNetwork: '',
  ...overrides,
});

function row({
  owner = T1,
  from = T1,
  to = EXTERNAL,
  sends = [info({ from: T1, to: EXTERNAL, isOwn: true })],
  receives = [] as IDecodedTxTransferInfo[],
}: {
  owner?: string;
  from?: string;
  to?: string;
  sends?: IDecodedTxTransferInfo[];
  receives?: IDecodedTxTransferInfo[];
} = {}): IAccountHistoryTx {
  return {
    id: 'row',
    decodedTx: {
      txid: 'tx',
      owner,
      signer: owner,
      nonce: 0,
      networkId: 'zec--0',
      accountId: 'account',
      extraInfo: null,
      status: 'confirmed',
      actions: [
        {
          type: EDecodedTxActionType.ASSET_TRANSFER,
          assetTransfer: { from, to, sends, receives },
        },
      ],
    },
  } as unknown as IAccountHistoryTx;
}

const io = (
  overrides: Partial<IOnChainHistoryTxTransfer>,
): IOnChainHistoryTxTransfer => ({
  type: EOnChainHistoryTransferType.Transfer,
  from: '',
  to: '',
  address: '',
  token: '',
  key: '',
  amount: '1',
  label: '',
  ...overrides,
});

describe('gateLocalWalletHistoryTx', () => {
  it('returns the same row when every own address is displayed', () => {
    const tx = row({
      receives: [info({ from: T1, to: T1, isOwn: true })],
    });
    expect(gateLocalWalletHistoryTx(zcashGate(UA), tx)).toBe(tx);
  });

  it('names legacy change by the transparent pool and keeps the counterparty', () => {
    const tx = row({
      receives: [
        info({ from: T1, to: EXTERNAL }),
        info({ from: T1, to: LEGACY_CHANGE, isOwn: true }),
      ],
    });
    const transfer = gateLocalWalletHistoryTx(zcashGate(UA), tx).decodedTx
      .actions[0].assetTransfer;
    expect(transfer?.receives).toEqual([
      info({ from: T1, to: EXTERNAL }),
      info({
        from: T1,
        to: '',
        isOwn: true,
        shieldedTo: { poolId: 0, isOwn: true },
      }),
    ]);
    expect(transfer?.to).toBe(EXTERNAL);
    expect(JSON.stringify(transfer)).not.toContain(LEGACY_CHANGE);
  });

  it('keeps a side on our displayed address when legacy change sits beside it', () => {
    const tx = row({
      from: LEGACY_CHANGE,
      sends: [
        info({ from: LEGACY_CHANGE, to: EXTERNAL, isOwn: true }),
        info({ from: T1, to: EXTERNAL, isOwn: true }),
      ],
    });
    const transfer = gateLocalWalletHistoryTx(zcashGate(UA), tx).decodedTx
      .actions[0].assetTransfer;
    expect(transfer?.from).toBe(T1);
    expect(transfer?.shieldedFrom).toBeUndefined();
    expect(transfer?.sends[0]).toMatchObject({
      from: '',
      shieldedFrom: { poolId: 0, isOwn: true },
    });
  });

  it('names a side by pool when only legacy change is on it', () => {
    const tx = row({
      from: LEGACY_CHANGE,
      sends: [info({ from: LEGACY_CHANGE, to: EXTERNAL, isOwn: true })],
    });
    const transfer = gateLocalWalletHistoryTx(zcashGate(UA), tx).decodedTx
      .actions[0].assetTransfer;
    expect(transfer).toMatchObject({
      from: '',
      shieldedFrom: { poolId: 0, isOwn: true },
    });
  });

  it.each([
    ['scanning', XMR_PRIMARY, XMR_PRIMARY],
    ['paused', undefined, ''],
  ])(
    'shows a Monero primary address only while Receive shows it (%s)',
    (_, privateAddress, shown) => {
      const gate = buildLocalWalletHistoryAddressGate({
        localWallet: {
          pools: [{ id: 1, kind: 'private' }],
          publicAddressPattern: '^$',
          addressForms: {},
        },
        addresses: { publicAddress: XMR_PRIMARY, privateAddress },
      });
      const tx = row({
        owner: XMR_PRIMARY,
        from: '',
        to: XMR_PRIMARY,
        sends: [
          info({
            to: XMR_PRIMARY,
            shieldedFrom: { poolId: 1, isOwn: true },
          }),
        ],
      });
      const transfer = gateLocalWalletHistoryTx(gate, tx).decodedTx.actions[0]
        .assetTransfer;
      expect(transfer?.to).toBe(shown);
      expect(transfer?.sends[0].to).toBe(shown);
      if (!shown) {
        expect(transfer?.shieldedTo).toEqual({
          poolId: undefined,
          isOwn: true,
        });
      }
    },
  );

  it('never fills in an address the row does not carry', () => {
    const tx = row({
      from: '',
      sends: [info({ to: EXTERNAL, shieldedFrom: { poolId: 4, isOwn: true } })],
    });
    expect(gateLocalWalletHistoryTx(zcashGate(UA), tx)).toBe(tx);
  });
});

describe('gateLocalWalletHistoryDetail', () => {
  const shielded = (overrides: Partial<IOnChainHistoryTxTransfer>) =>
    io({ type: EOnChainHistoryTransferType.Shielded, poolId: 4, ...overrides });

  it.each([
    [UA, UA],
    [DIVERSIFIED, ''],
  ])('keeps a received note address %s only when displayed', (at, shown) => {
    const detail = {
      receives: [shielded({ isOwn: true, address: at, to: at })],
    } as IOnChainHistoryTx;
    const [entry] = gateLocalWalletHistoryDetail(
      zcashGate(UA),
      detail,
    ).receives;
    expect(entry).toMatchObject({ address: shown, to: shown, isOwn: true });
  });

  it('hides our addresses while no private address is displayed', () => {
    const detail = {
      receives: [shielded({ isOwn: true, address: UA, to: UA })],
    } as IOnChainHistoryTx;
    expect(
      gateLocalWalletHistoryDetail(zcashGate(), detail).receives[0],
    ).toMatchObject({ address: '', to: '', isOwn: true });
  });

  it('removes legacy change from transparent I/O and keeps everything else', () => {
    const detail = {
      sends: [
        io({ from: LEGACY_CHANGE, address: LEGACY_CHANGE, isOwn: true }),
        io({ from: T1, address: T1, isOwn: true }),
      ],
      receives: [
        io({ to: EXTERNAL, address: EXTERNAL }),
        io({ to: LEGACY_CHANGE, address: LEGACY_CHANGE }),
      ],
    } as IOnChainHistoryTx;
    const gated = gateLocalWalletHistoryDetail(zcashGate(UA), detail);
    expect(JSON.stringify(gated)).not.toContain(LEGACY_CHANGE);
    expect(gated.sends[1]).toBe(detail.sends[1]);
    expect(gated.receives[0]).toBe(detail.receives[0]);
    // Named as ours even where the I/O didn't flag it.
    expect(gated.receives[1]).toMatchObject({ to: '', isOwn: true });
  });

  it("marks an entry ours only by its own side's address", () => {
    const detail = {
      sends: [io({ from: LEGACY_CHANGE, address: LEGACY_CHANGE, isOwn: true })],
      receives: [io({ from: LEGACY_CHANGE, to: EXTERNAL, address: EXTERNAL })],
    } as IOnChainHistoryTx;
    const gated = gateLocalWalletHistoryDetail(zcashGate(UA), detail);
    expect(gated.receives[0]).toMatchObject({
      from: '',
      to: EXTERNAL,
      address: EXTERNAL,
    });
    expect(gated.receives[0].isOwn).toBeFalsy();
  });

  it('returns the same detail when nothing of ours is hidden', () => {
    const detail = {
      sends: [shielded({ isOwn: true })],
      receives: [shielded({ address: EXTERNAL, to: EXTERNAL })],
    } as IOnChainHistoryTx;
    expect(gateLocalWalletHistoryDetail(zcashGate(UA), detail)).toBe(detail);
  });
});
