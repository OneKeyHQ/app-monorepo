import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { getTxConfirmMevProtectionProvider } from './TxConfirmHeaderRight';

jest.mock('@onekeyhq/components', () => ({
  Button: () => null,
  HeaderButtonGroup: () => null,
  Image: () => null,
  Popover: () => null,
  SizableText: () => null,
  Skeleton: () => null,
  YStack: () => null,
  useMedia: () => ({ gtMd: true }),
  useThemeName: () => 'light',
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const BLINK = {
  name: 'Blink',
  logoURI: 'https://uni.onekey-asset.com/static/logo/blink.png',
  logoURIDark: 'https://uni.onekey-asset.com/static/logo/blink_dark.png',
};

function buildSwapUnsignedTx({
  senderNetworkId,
  receiverNetworkId,
}: {
  senderNetworkId: string;
  receiverNetworkId: string;
}): IUnsignedTxPro {
  return {
    encodedTx: {},
    swapInfo: {
      sender: { accountInfo: { networkId: senderNetworkId } },
      receiver: { accountInfo: { networkId: receiverNetworkId } },
      swapBuildResData: { result: {} },
    },
  } as unknown as IUnsignedTxPro;
}

function resolve({
  networkId,
  decodedTx,
}: {
  networkId: string;
  decodedTx?: IDecodedTx;
}) {
  return getTxConfirmMevProtectionProvider({
    decodedTxs: decodedTx ? [decodedTx] : [],
    unsignedTxs: [
      buildSwapUnsignedTx({
        senderNetworkId: networkId,
        receiverNetworkId: networkId,
      }),
    ],
    effectiveFeePayer: 'user',
    txFeeInfoInit: true,
  });
}

describe('getTxConfirmMevProtectionProvider client fallback', () => {
  // Blink is the only MEV RPC vendor on these chains after the 2026
  // Blink vs BlockRazor evaluation (OK-61501); the local fallback must never
  // advertise another vendor.
  it.each([
    ['ethereum', 'evm--1'],
    ['bsc', 'evm--56'],
    ['base', 'evm--8453'],
    ['arbitrum', 'evm--42161'],
    ['robinhood', 'evm--4663'],
    ['solana', 'sol--101'],
  ])('falls back to Blink for a same-chain swap on %s', (_, networkId) => {
    expect(resolve({ networkId })).toEqual(BLINK);
  });

  it('keeps Shio for sui', () => {
    expect(resolve({ networkId: 'sui--mainnet' })).toMatchObject({
      name: 'Shio',
    });
  });

  it('prefers the server-provided provider over the fallback', () => {
    const serverProvider = { name: 'Server', logoURI: 'https://x/y.png' };
    const decodedTx = {
      txDisplay: { mevProtectionProvider: serverProvider },
    } as unknown as IDecodedTx;
    expect(resolve({ networkId: 'evm--56', decodedTx })).toBe(serverProvider);
  });

  it('returns null for a bridge swap', () => {
    expect(
      getTxConfirmMevProtectionProvider({
        decodedTxs: [],
        unsignedTxs: [
          buildSwapUnsignedTx({
            senderNetworkId: 'evm--56',
            receiverNetworkId: 'evm--1',
          }),
        ],
        effectiveFeePayer: 'user',
        txFeeInfoInit: true,
      }),
    ).toBeNull();
  });

  it('returns null for a chain without an MEV vendor', () => {
    expect(resolve({ networkId: 'evm--137' })).toBeNull();
  });
});
