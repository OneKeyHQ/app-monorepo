import {
  getBadgeQueryTokenAddress,
  isCexDepositExplicitlyDisabled,
  mergeCexSupportedInfo,
} from './cexDepositSupportUtils';

describe('getBadgeQueryTokenAddress', () => {
  it('keeps an ERC-20 contract address', () => {
    expect(
      getBadgeQueryTokenAddress({
        tokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      }),
    ).toBe('0xdac17f958d2ee523a2206206994597c13d831ec7');
  });

  it('omits token context for NFT transfers', () => {
    expect(
      getBadgeQueryTokenAddress({
        isNFT: true,
        tokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      }),
    ).toBeUndefined();
  });

  it('sends empty string for native tokens with non-empty internal IDs', () => {
    expect(
      getBadgeQueryTokenAddress({
        isNative: true,
        tokenAddress: 'uatom',
      }),
    ).toBe('');
    expect(
      getBadgeQueryTokenAddress({
        isNative: true,
        tokenAddress: '0x2::sui::SUI',
      }),
    ).toBe('');
    expect(getBadgeQueryTokenAddress({ tokenAddress: '' })).toBe('');
  });

  it('preserves missing fungible-token context', () => {
    expect(getBadgeQueryTokenAddress({ isNFT: false })).toBeUndefined();
    expect(
      getBadgeQueryTokenAddress({ tokenAddress: undefined }),
    ).toBeUndefined();
  });
});

describe('isCexDepositExplicitlyDisabled', () => {
  it('alerts only when depositEnable is boolean false', () => {
    expect(isCexDepositExplicitlyDisabled(false)).toBe(true);
  });

  it('fails open for true, null, and missing values', () => {
    expect(isCexDepositExplicitlyDisabled(true)).toBe(false);
    expect(isCexDepositExplicitlyDisabled(null)).toBe(false);
    expect(isCexDepositExplicitlyDisabled(undefined)).toBe(false);
  });
});

describe('mergeCexSupportedInfo', () => {
  it('returns undefined when no response carried the field', () => {
    expect(mergeCexSupportedInfo([undefined, undefined])).toBeUndefined();
  });

  it('lets an explicit false win regardless of order', () => {
    expect(
      mergeCexSupportedInfo([
        { depositEnable: true, cexLabel: 'Binance' },
        { depositEnable: false, cexLabel: 'Binance' },
      ]),
    ).toEqual({ depositEnable: false, cexLabel: 'Binance' });
    expect(
      mergeCexSupportedInfo([
        { depositEnable: false, cexLabel: 'binance' },
        { depositEnable: true, cexLabel: 'Binance' },
      ]),
    ).toEqual({ depositEnable: false, cexLabel: 'binance' });
  });

  it('keeps true when no response is explicitly disabled', () => {
    expect(
      mergeCexSupportedInfo([{ depositEnable: true }, { depositEnable: null }]),
    ).toEqual({ depositEnable: true });
  });
});
