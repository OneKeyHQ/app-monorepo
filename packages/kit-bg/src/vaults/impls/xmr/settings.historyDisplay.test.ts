import {
  getPrivacyChainPublicDisplayFlow,
  getPrivacyChainWalletRecipientAddresses,
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

it('keeps a locally recorded outgoing recipient separate from receive-side ownership', () => {
  const privateAddressPattern = settings.localWallet?.privateAddressPattern;
  expect(
    getPrivacyChainWalletRecipientAddresses({
      privateAddressPattern,
      transfer: transfer(sender, recipient),
      isSent: true,
    }),
  ).toEqual([recipient]);
  expect(
    getPrivacyChainWalletRecipientAddresses({
      privateAddressPattern,
      transfer: transfer('Private', recipient),
      isSent: false,
    }),
  ).toEqual([]);
});
