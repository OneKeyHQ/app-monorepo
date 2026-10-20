import {
  getPrivacyChainEndpointFlow,
  getPrivacyChainPublicDisplayFlow,
} from '@onekeyhq/shared/src/utils/privacyChainDisplayUtils';
import type { IDecodedTxActionAssetTransfer } from '@onekeyhq/shared/types/tx';

import settings from './settings';

const sender = `4${'A'.repeat(94)}`;
const recipient = `8${'B'.repeat(94)}`;
const transfer = (from: string, to: string): IDecodedTxActionAssetTransfer => ({
  from,
  to,
  sends: [],
  receives: [],
});

it.each([
  transfer(sender, recipient),
  transfer('Private', recipient),
  transfer('Private', 'Private'),
])(
  'never classifies Monero wallet endpoints as public history addresses',
  (tx) => {
    expect(
      getPrivacyChainPublicDisplayFlow({
        publicAddressPattern: settings.localWallet?.publicAddressPattern,
        transfer: tx,
      }),
    ).toEqual({ from: [], to: [] });
    expect(settings.isUtxo).toBe(false);
  },
);

it('shows our side as this account and a recorded recipient exactly', () => {
  const localWallet = settings.localWallet;
  const flow = (tx: IDecodedTxActionAssetTransfer, isSent: boolean) =>
    getPrivacyChainEndpointFlow({
      pools: localWallet?.pools,
      publicAddressPattern: localWallet?.publicAddressPattern,
      privateAddressPattern: localWallet?.privateAddressPattern,
      transfer: tx,
      isSent,
    });
  // As built by buildXmrLocalHistoryTx: our side names no address.
  expect(
    flow(
      {
        ...transfer('', recipient),
        shieldedFrom: { poolId: 1, isOwn: true },
      },
      true,
    ),
  ).toEqual({
    from: [{ kind: 'own', poolId: 1, isSpend: true }],
    to: [{ kind: 'address', address: recipient }],
  });
  expect(
    flow(
      {
        ...transfer('', ''),
        shieldedFrom: { poolId: 1 },
        shieldedTo: { poolId: 1, isOwn: true },
      },
      false,
    ),
  ).toEqual({
    from: [{ kind: 'pool', poolId: 1 }],
    to: [{ kind: 'own', poolId: 1, isSpend: false }],
  });
});
