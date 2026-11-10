import {
  getBadgeQueryTokenAddress,
  getCexDepositWarningExchange,
  getCexDepositWarningFacts,
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

  it('falls back to the network native token address when isNative is missing', () => {
    expect(
      getBadgeQueryTokenAddress({
        tokenAddress: 'uatom',
        nativeTokenAddress: 'uatom',
      }),
    ).toBe('');
    expect(
      getBadgeQueryTokenAddress({
        tokenAddress: 'ibc/token',
        nativeTokenAddress: 'uatom',
      }),
    ).toBe('ibc/token');
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

describe('getCexDepositWarningExchange', () => {
  it('normalizes cex labels and falls back to unknown', () => {
    expect(getCexDepositWarningExchange(' Binance ')).toBe('binance');
    expect(getCexDepositWarningExchange(undefined)).toBe('unknown');
    expect(getCexDepositWarningExchange('')).toBe('unknown');
    expect(getCexDepositWarningExchange(`0x${'ab'.repeat(21)}`)).toBe(
      'unknown',
    );
  });
});

describe('getCexDepositWarningFacts', () => {
  it('trims values and omits a missing exchange label', () => {
    expect(
      getCexDepositWarningFacts({
        tokenSymbol: ' DAI ',
        networkName: ' Ethereum ',
        exchangeLabel: ' Binance ',
      }),
    ).toEqual({
      tokenSymbol: 'DAI',
      networkName: 'Ethereum',
      exchangeName: 'Binance',
    });
    expect(getCexDepositWarningFacts({})).toEqual({});
  });

  it.each(['default', 'info'] as const)(
    'uses a matching %s display badge label case-insensitively',
    (type) => {
      expect(
        getCexDepositWarningFacts({
          exchangeLabel: 'binance',
          addressBadges: [
            {
              label: 'BiNaNcE',
              type,
            },
          ],
        }),
      ).toEqual({
        exchangeName: 'BiNaNcE',
      });
    },
  );

  it('uses a matching display name but preserves the raw exchange label otherwise', () => {
    expect(
      getCexDepositWarningFacts({
        exchangeLabel: 'binance',
        exchangeDisplayName: 'BINANCE',
      }),
    ).toEqual({
      exchangeName: 'BINANCE',
    });
    expect(
      getCexDepositWarningFacts({
        exchangeLabel: 'binance',
        exchangeDisplayName: 'Binance.com',
      }),
    ).toEqual({
      exchangeName: 'binance',
    });
  });

  it.each(['warning', 'critical'] as const)(
    'ignores a matching %s badge without changing the raw label',
    (type) => {
      expect(
        getCexDepositWarningFacts({
          exchangeLabel: 'binance',
          addressBadges: [
            {
              label: 'BINANCE',
              type,
            },
          ],
        }),
      ).toEqual({
        exchangeName: 'binance',
      });
    },
  );

  it('ignores mismatched display badges without changing the raw label', () => {
    expect(
      getCexDepositWarningFacts({
        exchangeLabel: 'binance',
        addressBadges: [
          {
            label: 'Binance.com',
            type: 'info',
          },
        ],
      }),
    ).toEqual({
      exchangeName: 'binance',
    });
  });

  it('omits blank token, network, and exchange details', () => {
    expect(
      getCexDepositWarningFacts({
        tokenSymbol: ' ',
        networkName: '  ',
        exchangeLabel: ' ',
        exchangeDisplayName: '  ',
      }),
    ).toEqual({});
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
