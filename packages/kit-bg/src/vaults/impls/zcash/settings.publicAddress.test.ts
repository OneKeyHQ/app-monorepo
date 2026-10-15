import {
  getPrivacyChainPublicDisplayAddress,
  getPrivacyChainPublicDisplayFlow,
} from '@onekeyhq/shared/src/utils/privacyChainDisplayUtils';
import type { IDecodedTxActionAssetTransfer } from '@onekeyhq/shared/types/tx';

import settings from './settings';

// The rule under test is the one Zcash ships in its settings.
const publicAddressPattern = settings.localWallet?.publicAddressPattern;
const getZcashHistoryDisplayAddress = (address?: string) =>
  getPrivacyChainPublicDisplayAddress({ publicAddressPattern, address });
const getZcashHistoryDisplayFlow = (transfer?: IDecodedTxActionAssetTransfer) =>
  getPrivacyChainPublicDisplayFlow({ publicAddressPattern, transfer });

const transparent = `t1${'A'.repeat(33)}`;
const otherTransparent = `t3${'B'.repeat(33)}`;
const transfer = (from: string, to: string): IDecodedTxActionAssetTransfer => ({
  from,
  to,
  sends: [],
  receives: [],
});

describe('privacy chain public address visibility', () => {
  it('passes every address through on a chain without a pattern', () => {
    expect(
      getPrivacyChainPublicDisplayAddress({
        publicAddressPattern: undefined,
        address: 'Shielded',
      }),
    ).toBe('Shielded');
  });

  it.each([
    undefined,
    '',
    'Shielded',
    'Orchard pool',
    'Sapling pool',
    'zs1recipient',
    'u1recipient',
    't1invalid',
  ])('hides non-transparent endpoint %s', (address) => {
    expect(getZcashHistoryDisplayAddress(address)).toBe('');
  });

  it('shows a TEX exchange address, which is public', () => {
    const tex = 'tex1pyysjzgfpyysjzgfpyysjzgfpyysjzgfl7c006';
    expect(getZcashHistoryDisplayAddress(tex)).toBe(tex);
  });

  it('shows no flow for a shielded payment', () => {
    expect(
      getZcashHistoryDisplayFlow(transfer('Orchard pool', 'u1recipient')),
    ).toEqual({ from: [], to: [] });
  });

  it('shows only the transparent input when shielding', () => {
    expect(
      getZcashHistoryDisplayFlow(transfer(transparent, 'Sapling pool')),
    ).toEqual({ from: [transparent], to: [] });
  });

  it('shows only the transparent output when unshielding', () => {
    expect(
      getZcashHistoryDisplayFlow(transfer('Orchard pool', otherTransparent)),
    ).toEqual({ from: [], to: [otherTransparent] });
  });

  it('preserves both sides of a transparent payment', () => {
    expect(
      getZcashHistoryDisplayFlow(transfer(transparent, otherTransparent)),
    ).toEqual({ from: [transparent], to: [otherTransparent] });
  });

  it('does not invent an address when transfer endpoints are absent', () => {
    expect(getZcashHistoryDisplayFlow()).toEqual({ from: [], to: [] });
  });

  it('keeps distinct transparent inputs and deduplicates the summary endpoint', () => {
    const tx = transfer(transparent, 'Shielded');
    const input = (from: string) => ({
      from,
      to: 'Shielded',
      amount: '1',
      tokenIdOnNetwork: '',
      icon: '',
      name: 'Zcash',
      symbol: 'ZEC',
      isNFT: false,
    });
    tx.sends = [
      input(transparent),
      input(otherTransparent),
      input('Orchard pool'),
    ];
    expect(getZcashHistoryDisplayFlow(tx)).toEqual({
      from: [transparent, otherTransparent],
      to: [],
    });
  });
  it.each(['from', 'to'] as const)(
    'does not expose a projected owner on the shielded %s side',
    (direction) => {
      const tx = transfer('Shielded', 'Orchard pool');
      tx.sends = [
        {
          from: transparent,
          to: transparent,
          amount: '1',
          tokenIdOnNetwork: '',
          icon: '',
          name: 'Zcash',
          symbol: 'ZEC',
          isNFT: false,
        },
      ];
      tx[direction === 'from' ? 'to' : 'from'] = otherTransparent;
      expect(getZcashHistoryDisplayFlow(tx)[direction]).toEqual([]);
    },
  );
});
