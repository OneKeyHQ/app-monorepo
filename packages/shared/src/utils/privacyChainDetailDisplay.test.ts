import { EOnChainHistoryTransferType } from '../../types/history';

import {
  getPrivacyChainPublicDisplayFlow,
  getPrivacyChainWalletRecipientAddresses,
} from './privacyChainDisplayUtils';

import type { IOnChainHistoryTxTransfer } from '../../types/history';
import type { IDecodedTxActionAssetTransfer } from '../../types/tx';

const privateAddress = `u1${'a'.repeat(90)}`;
const privateAddressPattern = '^u1[02-9ac-hj-np-z]+$';
const transfer = (from: string, to: string): IDecodedTxActionAssetTransfer => ({
  from,
  to,
  sends: [],
  receives: [],
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
  label: 'Ironwood pool',
  isOwn: false,
  ...overrides,
});

it('shows the locally recorded outgoing recipient before scan details arrive', () => {
  expect(
    getPrivacyChainWalletRecipientAddresses({
      privateAddressPattern,
      transfer: transfer('own-account-identifier', privateAddress),
      isSent: true,
    }),
  ).toEqual([privateAddress]);
});

it('does not turn incoming own addresses, change or unknown pool labels into counterparties', () => {
  expect(
    getPrivacyChainWalletRecipientAddresses({
      privateAddressPattern,
      transfer: transfer('Shielded', privateAddress),
      outputTransfers: [
        output(privateAddress, { isOwn: true }),
        output(privateAddress, { isChange: true }),
        output('Ironwood pool'),
        output('Shielded'),
        output('t1-public-address'),
      ],
      isSent: false,
    }),
  ).toEqual([]);
});

it('keeps an explicit self-payment recipient while excluding its change', () => {
  expect(
    getPrivacyChainWalletRecipientAddresses({
      privateAddressPattern,
      transfer: transfer('Ironwood pool', 'Ironwood pool'),
      outputTransfers: [
        output(privateAddress, { isOwn: true, isChange: false }),
        output(`u1${'c'.repeat(90)}`, { isOwn: true, isChange: true }),
      ],
      isSent: true,
    }),
  ).toEqual([privateAddress]);
});

it('deduplicates authoritative private recipients without making them public endpoints', () => {
  const payment = transfer('Ironwood pool', privateAddress);
  expect(
    getPrivacyChainWalletRecipientAddresses({
      privateAddressPattern,
      transfer: payment,
      outputTransfers: [output(privateAddress), output(privateAddress)],
      isSent: true,
    }),
  ).toEqual([privateAddress]);
  expect(
    getPrivacyChainPublicDisplayFlow({
      publicAddressPattern: '^t[13]',
      transfer: payment,
    }),
  ).toEqual({ from: [], to: [] });
});

it('shows a known XMR outgoing recipient but not a receive-side own address', () => {
  const address = `4${'A'.repeat(94)}`;
  const pattern = '^[1-9A-HJ-NP-Za-km-z]{95}([1-9A-HJ-NP-Za-km-z]{11})?$';
  expect(
    getPrivacyChainWalletRecipientAddresses({
      privateAddressPattern: pattern,
      transfer: transfer('own-account', address),
      isSent: true,
    }),
  ).toEqual([address]);
  expect(
    getPrivacyChainWalletRecipientAddresses({
      privateAddressPattern: pattern,
      transfer: transfer('Private', address),
      isSent: false,
    }),
  ).toEqual([]);
});
