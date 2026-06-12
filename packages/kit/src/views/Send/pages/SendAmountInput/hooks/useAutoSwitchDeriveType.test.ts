import BigNumber from 'bignumber.js';

import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';

import { pickBestSibling } from './useAutoSwitchDeriveType';

import type { ISiblingDeriveBalance } from './useSiblingDeriveBalances';

function makeSibling({
  deriveType,
  encoding,
  balance,
}: {
  deriveType: IAccountDeriveTypes;
  encoding: EAddressEncodings;
  balance: string;
}): ISiblingDeriveBalance {
  const deriveInfo = {
    namePrefix: deriveType,
    label: deriveType,
    template: '',
    coinType: '0',
    coinName: 'BTC',
    addressEncoding: encoding,
  } as unknown as IAccountDeriveInfo;
  return {
    accountId: `acc-${deriveType}`,
    account: { id: `acc-${deriveType}` } as ISiblingDeriveBalance['account'],
    deriveType,
    deriveInfo,
    balanceParsed: balance,
    availableBalance: new BigNumber(balance),
  };
}

describe('pickBestSibling', () => {
  it('returns undefined when no sibling can cover the amount', () => {
    const result = pickBestSibling({
      siblings: [
        makeSibling({
          deriveType: 'BIP86',
          encoding: EAddressEncodings.P2TR,
          balance: '0.001',
        }),
        makeSibling({
          deriveType: 'BIP44',
          encoding: EAddressEncodings.P2PKH,
          balance: '0.0005',
        }),
      ],
      amount: new BigNumber('0.5'),
      currentDeriveType: 'BIP84',
    });
    expect(result).toBeUndefined();
  });

  it('skips the current deriveType even if it has enough', () => {
    const result = pickBestSibling({
      siblings: [
        makeSibling({
          deriveType: 'BIP84',
          encoding: EAddressEncodings.P2WPKH,
          balance: '5',
        }),
        makeSibling({
          deriveType: 'BIP86',
          encoding: EAddressEncodings.P2TR,
          balance: '1',
        }),
      ],
      amount: new BigNumber('0.5'),
      currentDeriveType: 'BIP84',
    });
    expect(result?.deriveType).toBe('BIP86');
  });

  it('prefers the cheapest-fee tier when multiple siblings can cover', () => {
    // P2WPKH (cheapest), P2TR (next), P2SH (next), P2PKH (most expensive).
    // Even though P2WPKH has the smallest balance among candidates,
    // it wins on tier.
    const result = pickBestSibling({
      siblings: [
        makeSibling({
          deriveType: 'BIP86',
          encoding: EAddressEncodings.P2TR,
          balance: '5',
        }),
        makeSibling({
          deriveType: 'BIP84',
          encoding: EAddressEncodings.P2WPKH,
          balance: '0.6',
        }),
        makeSibling({
          deriveType: 'default',
          encoding: EAddressEncodings.P2SH_P2WPKH,
          balance: '10',
        }),
      ],
      amount: new BigNumber('0.5'),
      // current is Legacy so all three above are valid candidates
      currentDeriveType: 'BIP44',
    });
    expect(result?.deriveType).toBe('BIP84');
  });

  it('within the same fee tier, picks the smallest sufficient balance', () => {
    const result = pickBestSibling({
      siblings: [
        makeSibling({
          deriveType: 'BIP86',
          encoding: EAddressEncodings.P2TR,
          balance: '10', // overkill
        }),
        // Two P2TR-tier siblings differ only in balance — smaller wins.
        {
          ...makeSibling({
            deriveType: 'BIP44',
            encoding: EAddressEncodings.P2TR,
            balance: '0.6',
          }),
          deriveType: 'BIP44' as IAccountDeriveTypes,
        },
      ],
      amount: new BigNumber('0.5'),
      currentDeriveType: 'BIP84',
    });
    expect(result?.balanceParsed).toBe('0.6');
  });

  it('treats balance exactly equal to the amount as sufficient', () => {
    const result = pickBestSibling({
      siblings: [
        makeSibling({
          deriveType: 'BIP86',
          encoding: EAddressEncodings.P2TR,
          balance: '0.00003628',
        }),
      ],
      amount: new BigNumber('0.00003'),
      currentDeriveType: 'default',
    });
    expect(result?.deriveType).toBe('BIP86');
  });

  it('skips deriveTypes the caller has marked as already tried', () => {
    // After a previous auto-switch, BIP84 has been "left" so we should not
    // bounce back to it even though it covers and outranks BIP86 on fees.
    const result = pickBestSibling({
      siblings: [
        makeSibling({
          deriveType: 'BIP84',
          encoding: EAddressEncodings.P2WPKH,
          balance: '5',
        }),
        makeSibling({
          deriveType: 'BIP86',
          encoding: EAddressEncodings.P2TR,
          balance: '5',
        }),
      ],
      amount: new BigNumber('0.5'),
      currentDeriveType: 'default',
      excludeDeriveTypes: new Set(['BIP84']),
    });
    expect(result?.deriveType).toBe('BIP86');
  });

  it('returns undefined when only the excluded deriveTypes can cover', () => {
    const result = pickBestSibling({
      siblings: [
        makeSibling({
          deriveType: 'BIP84',
          encoding: EAddressEncodings.P2WPKH,
          balance: '5',
        }),
      ],
      amount: new BigNumber('0.5'),
      currentDeriveType: 'default',
      excludeDeriveTypes: new Set(['BIP84']),
    });
    expect(result).toBeUndefined();
  });

  // Entry-case (amount === 0): user landed on a 0-balance deriveType.
  // We pick by fee-tier + LARGEST balance, and exclude zero-balance siblings.

  it('entry case (amount=0): picks the cheapest fee tier with non-zero balance', () => {
    const result = pickBestSibling({
      siblings: [
        makeSibling({
          deriveType: 'BIP44',
          encoding: EAddressEncodings.P2PKH,
          balance: '10',
        }),
        makeSibling({
          deriveType: 'BIP86',
          encoding: EAddressEncodings.P2TR,
          balance: '0.5',
        }),
        makeSibling({
          deriveType: 'BIP84',
          encoding: EAddressEncodings.P2WPKH,
          balance: '0.1',
        }),
      ],
      amount: new BigNumber(0),
      currentDeriveType: 'default',
    });
    expect(result?.deriveType).toBe('BIP84');
  });

  it('entry case (amount=0): within same fee tier, picks the LARGEST balance', () => {
    const result = pickBestSibling({
      siblings: [
        {
          ...makeSibling({
            deriveType: 'BIP44',
            encoding: EAddressEncodings.P2TR,
            balance: '0.1',
          }),
          deriveType: 'BIP44' as IAccountDeriveTypes,
        },
        makeSibling({
          deriveType: 'BIP86',
          encoding: EAddressEncodings.P2TR,
          balance: '5',
        }),
      ],
      amount: new BigNumber(0),
      currentDeriveType: 'default',
    });
    expect(result?.deriveType).toBe('BIP86');
  });

  it('entry case (amount=0): excludes zero-balance siblings', () => {
    const result = pickBestSibling({
      siblings: [
        makeSibling({
          deriveType: 'BIP86',
          encoding: EAddressEncodings.P2TR,
          balance: '0',
        }),
        makeSibling({
          deriveType: 'BIP44',
          encoding: EAddressEncodings.P2PKH,
          balance: '0',
        }),
      ],
      amount: new BigNumber(0),
      currentDeriveType: 'default',
    });
    expect(result).toBeUndefined();
  });
});
