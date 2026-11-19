import {
  getPrivacyChainMainPools,
  getPrivacyChainPublicDisplayFlow,
} from './privacyChainDisplayUtils';

import type { IDecodedTxTransferInfo } from '../../types/tx';

it('follows the current default private pool while preserving stable public and history pool IDs', () => {
  const publicPool = { id: 0, kind: 'public' as const, label: 'Transparent' };
  const oldPool = {
    id: 1,
    kind: 'private' as const,
    label: 'Orchard',
    receivesFunds: false,
  };
  const currentPool = {
    id: 4,
    kind: 'private' as const,
    label: 'Ironwood',
    isDefaultPrivate: true,
  };
  const pools = [oldPool, currentPool, publicPool];
  expect(getPrivacyChainMainPools(pools)).toEqual([publicPool, currentPool]);
  expect(pools).toEqual([oldPool, currentPool, publicPool]);
  const nextPool = { ...currentPool, id: 5, label: 'Next' };
  expect(
    getPrivacyChainMainPools([
      publicPool,
      oldPool,
      { ...currentPool, isDefaultPrivate: false },
      nextPool,
    ]),
  ).toEqual([publicPool, nextPool]);
});

it('does not create a public tab for a private-only chain or expose a retired private pool', () => {
  const privatePool = { id: 0, kind: 'private' as const, label: 'Monero' };
  expect(getPrivacyChainMainPools([privatePool])).toEqual([privatePool]);
  expect(
    getPrivacyChainMainPools([{ ...privatePool, receivesFunds: false }]),
  ).toEqual([]);
});

it.each([
  ['t1recipient', false],
  ['t1change', false],
  ['t1change', true],
] as const)(
  'excludes explicit change while preserving payments to the same address (summary=%s, self=%s)',
  (to, selfPayment) => {
    const output = (
      address: string,
      isChange: boolean,
    ): IDecodedTxTransferInfo => ({
      from: 't1sender',
      to: address,
      isChange,
      isOwn: address === 't1change',
      amount: '1',
      icon: '',
      name: 'Zcash',
      symbol: 'ZEC',
      tokenIdOnNetwork: '',
    });
    const flow = getPrivacyChainPublicDisplayFlow({
      publicAddressPattern: '^t1',
      transfer: {
        from: 't1sender',
        to,
        sends: [],
        receives: [
          output('t1recipient', false),
          output('t1change', true),
          ...(selfPayment ? [output('t1change', false)] : []),
        ],
      },
    });
    expect(flow.from).toEqual(['t1sender']);
    expect(new Set(flow.to)).toEqual(
      new Set(selfPayment ? ['t1recipient', 't1change'] : ['t1recipient']),
    );
    expect(flow.to).toHaveLength(selfPayment ? 2 : 1);
  },
);
