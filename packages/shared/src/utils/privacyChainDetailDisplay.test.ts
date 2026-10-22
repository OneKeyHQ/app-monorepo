import { EOnChainHistoryTransferType } from '../../types/history';

import {
  collectPrivacyChainOwnAddresses,
  getLocalWalletPoolDisplayAddress,
  getPrivacyChainDisplayPools,
  getPrivacyChainEndpointFlow,
  getPrivacyChainEntryItem,
  getPrivacyChainPublicDisplayFlow,
  getPrivacyChainShieldedEntryLabel,
  getPrivacyChainTargetItem,
  isLocalWalletDisplayedAddress,
} from './privacyChainDisplayUtils';

import type { IOnChainHistoryTxTransfer } from '../../types/history';
import type { IDecodedTxActionAssetTransfer } from '../../types/tx';

const privateAddress = `u1${'a'.repeat(90)}`;
const privateAddressPattern = '^u1[02-9ac-hj-np-z]+$';
const publicAddressPattern = '^t[13]';
const pools = [
  { id: 0, kind: 'public' as const, label: 'Transparent' },
  { id: 4, kind: 'private' as const, label: 'Ironwood' },
  { id: 3, kind: 'private' as const, label: 'Orchard', receivesFunds: false },
];
const transfer = (
  from: string,
  to: string,
  overrides: Partial<IDecodedTxActionAssetTransfer> = {},
): IDecodedTxActionAssetTransfer => ({
  from,
  to,
  sends: [],
  receives: [],
  ...overrides,
});
const output = (
  address: string,
  overrides: Partial<IOnChainHistoryTxTransfer> = {},
): IOnChainHistoryTxTransfer => ({
  type: EOnChainHistoryTransferType.Shielded,
  address,
  from: '',
  to: address,
  token: '',
  key: '',
  amount: '1',
  label: '',
  isOwn: false,
  ...overrides,
});
const flow = (
  params: Partial<Parameters<typeof getPrivacyChainEndpointFlow>[0]>,
) =>
  getPrivacyChainEndpointFlow({
    pools,
    publicAddressPattern,
    privateAddressPattern,
    isSent: false,
    ...params,
  });

describe('getLocalWalletPoolDisplayAddress', () => {
  const addresses = { publicAddress: 't1own', privateAddress };
  it('returns what the token details page shows for each pool', () => {
    expect(
      getLocalWalletPoolDisplayAddress({ pool: pools[0], addresses }),
    ).toBe('t1own');
    expect(
      getLocalWalletPoolDisplayAddress({ pool: pools[1], addresses }),
    ).toBe(privateAddress);
    // A legacy pool that no longer receives shows no address.
    expect(
      getLocalWalletPoolDisplayAddress({ pool: pools[2], addresses }),
    ).toBeUndefined();
    // Not scanning: no private address is handed out.
    expect(
      getLocalWalletPoolDisplayAddress({
        pool: pools[1],
        addresses: { publicAddress: 't1own' },
      }),
    ).toBeUndefined();
  });
});

describe('getPrivacyChainEndpointFlow', () => {
  it('shows this account as its own side and a hidden sender by pool', () => {
    expect(
      flow({
        transfer: transfer('', '', {
          shieldedFrom: { poolId: 4 },
          shieldedTo: { poolId: 4, isOwn: true },
        }),
        outputTransfers: [
          output(`u1${'d'.repeat(90)}`, { poolId: 4, isOwn: true }),
        ],
      }),
    ).toEqual({
      from: [{ kind: 'pool', poolId: 4 }],
      // The row knows no receiving address; the note names the one it reached.
      to: [
        { kind: 'own', poolId: 4, isSpend: false },
        { kind: 'own', poolId: 4, address: `u1${'d'.repeat(90)}` },
      ],
    });
  });

  it('shows the recorded recipient of our send exactly, not its pool', () => {
    expect(
      flow({
        isSent: true,
        transfer: transfer('', privateAddress, {
          shieldedFrom: { poolId: 4, isOwn: true },
        }),
        inputTransfers: [output('', { poolId: 4, isOwn: true })],
        outputTransfers: [
          output(privateAddress, { poolId: 4 }),
          output('', { poolId: 4, isOwn: true, isChange: true }),
        ],
      }),
    ).toEqual({
      from: [{ kind: 'own', poolId: 4, isSpend: true }],
      to: [{ kind: 'address', address: privateAddress }],
    });
  });

  it('falls back to the pool name when a recipient is unknown', () => {
    expect(
      flow({
        isSent: true,
        transfer: transfer('', '', {
          shieldedFrom: { poolId: 4, isOwn: true },
          shieldedTo: {},
        }),
        outputTransfers: [output('', { poolId: 4 })],
      }).to,
    ).toEqual([{ kind: 'pool', poolId: 4 }]);
  });

  it('leaves public addresses to the public flow', () => {
    expect(
      flow({
        isSent: true,
        transfer: transfer('t1own', 't1other', {
          shieldedTo: undefined,
        }),
      }),
    ).toEqual({ from: [], to: [] });
  });

  it('treats an unmarked private address as a counterparty only on a send', () => {
    expect(flow({ transfer: transfer('', privateAddress) }).to).toEqual([]);
    expect(
      flow({ isSent: true, transfer: transfer('', privateAddress) }).to,
    ).toEqual([{ kind: 'address', address: privateAddress }]);
  });
});

describe('getPrivacyChainTargetItem', () => {
  const target = (
    params: Partial<Parameters<typeof getPrivacyChainTargetItem>[0]>,
  ) =>
    getPrivacyChainTargetItem({
      pools,
      publicAddressPattern,
      privateAddressPattern,
      side: 'to',
      ...params,
    });
  it('names the counterparty a list row shows', () => {
    expect(target({ address: 't1other' })).toEqual({
      kind: 'address',
      address: 't1other',
    });
    expect(target({ address: privateAddress })).toEqual({
      kind: 'address',
      address: privateAddress,
    });
    expect(target({ address: '', shielded: { poolId: 4 } })).toEqual({
      kind: 'pool',
      poolId: 4,
    });
    expect(
      target({ address: '', shielded: { poolId: 4, isOwn: true } }),
    ).toEqual({ kind: 'own', poolId: 4, isSpend: false });
    expect(
      target({
        address: '',
        shielded: { poolId: 4, isOwn: true },
        side: 'from',
      }),
    ).toEqual({ kind: 'own', poolId: 4, isSpend: true });
    // The row's own transparent address is checked like any own address.
    expect(
      target({ address: 't1own', ownAddresses: new Set(['t1own']) }),
    ).toEqual({ kind: 'own', poolId: 0, address: 't1own' });
    expect(target({ address: 'Shielded' })).toEqual({ kind: 'pool' });
    expect(target({ address: '' })).toBeUndefined();
  });
});

describe('getPrivacyChainEntryItem', () => {
  const entry = (
    params: Partial<Parameters<typeof getPrivacyChainEntryItem>[0]>,
  ) =>
    getPrivacyChainEntryItem({
      pools,
      entry: {},
      isInput: false,
      ...params,
    });
  it('keeps the address an own output names so it can be checked', () => {
    expect(
      entry({ entry: { isOwn: true, address: privateAddress, poolId: 4 } }),
    ).toEqual({ kind: 'own', poolId: 4, address: privateAddress });
    expect(entry({ entry: { isOwn: true, address: '', poolId: 4 } })).toEqual({
      kind: 'own',
      poolId: 4,
    });
    expect(entry({ entry: { isOwn: true, poolId: 4 }, isInput: true })).toEqual(
      { kind: 'own', poolId: 4, isSpend: true },
    );
  });
  it('shows others by exact address or pool', () => {
    expect(
      entry({ entry: { isOwn: false, address: privateAddress, poolId: 4 } }),
    ).toEqual({ kind: 'address', address: privateAddress });
    expect(
      entry({
        entry: { isOwn: false, address: 'Shielded', label: 'Shielded' },
      }),
    ).toEqual({ kind: 'pool' });
  });
  it('treats an address the data says is ours as ours', () => {
    expect(
      entry({
        entry: { isOwn: false, address: privateAddress, poolId: 4 },
        ownAddresses: new Set([privateAddress]),
      }),
    ).toEqual({ kind: 'own', poolId: 4, address: privateAddress });
  });
});

describe('isLocalWalletDisplayedAddress', () => {
  const addresses = { publicAddress: 't1own', privateAddress };
  it('accepts only the byte-identical displayed strings', () => {
    expect(
      isLocalWalletDisplayedAddress({ addresses, address: privateAddress }),
    ).toBe(true);
    expect(isLocalWalletDisplayedAddress({ addresses, address: 't1own' })).toBe(
      true,
    );
    expect(
      isLocalWalletDisplayedAddress({
        addresses,
        address: `u1${'d'.repeat(90)}`,
      }),
    ).toBe(false);
    expect(
      isLocalWalletDisplayedAddress({
        addresses,
        address: privateAddress.toUpperCase(),
      }),
    ).toBe(false);
    expect(
      isLocalWalletDisplayedAddress({ addresses: undefined, address: 't1own' }),
    ).toBe(false);
    expect(isLocalWalletDisplayedAddress({ addresses, address: '' })).toBe(
      false,
    );
  });
});

describe('collectPrivacyChainOwnAddresses', () => {
  it('gathers what the data marks as ours', () => {
    expect(
      collectPrivacyChainOwnAddresses({
        owner: 't1own',
        inputTransfers: [
          output('t1own', {
            type: EOnChainHistoryTransferType.Transfer,
            isOwn: true,
          }),
        ],
        outputTransfers: [
          output(`u1${'d'.repeat(90)}`, { isOwn: true }),
          output(privateAddress, { isOwn: false }),
          output('Shielded', { label: 'Shielded', isOwn: true }),
        ],
      }),
    ).toEqual(new Set(['t1own', `u1${'d'.repeat(90)}`]));
  });
});

describe('getPrivacyChainDisplayPools', () => {
  it('adds pools that history names without a tab', () => {
    expect(
      getPrivacyChainDisplayPools({
        pools: [pools[1]],
        historyOnlyPools: [{ id: 2, label: 'Sapling' }],
      }),
    ).toEqual([
      pools[1],
      { id: 2, label: 'Sapling', kind: 'private', receivesFunds: false },
    ]);
  });
});

it('hides a marked shielded endpoint from the public flow even when entries carry a public address', () => {
  const marked: IDecodedTxActionAssetTransfer = {
    from: '',
    to: 't1own',
    shieldedFrom: {},
    sends: [
      {
        from: 't1own',
        to: 't1own',
        amount: '1',
        icon: '',
        name: '',
        symbol: '',
        tokenIdOnNetwork: '',
      },
    ],
    receives: [],
  };
  expect(
    getPrivacyChainPublicDisplayFlow({
      publicAddressPattern,
      transfer: marked,
    }),
  ).toEqual({ from: [], to: ['t1own'] });
  // An unmarked private address hides the entries the same way.
  expect(
    getPrivacyChainPublicDisplayFlow({
      publicAddressPattern,
      transfer: { ...marked, from: privateAddress, shieldedFrom: undefined },
    }),
  ).toEqual({ from: [], to: ['t1own'] });
});

it('resolves a shielded entry to its declared pool or a generic label', () => {
  expect(
    getPrivacyChainShieldedEntryLabel({ pools, transfer: { poolId: 3 } }),
  ).toEqual({ poolId: 3 });
  expect(
    getPrivacyChainShieldedEntryLabel({ pools, transfer: { poolId: 2 } }),
  ).toEqual({});
  expect(getPrivacyChainShieldedEntryLabel({ pools, transfer: {} })).toEqual(
    {},
  );
});
