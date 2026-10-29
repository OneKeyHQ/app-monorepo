import {
  buildAssetSelectGroups,
  isAddressKeyword,
  isInAssetPick,
  isSameAssetPick,
  listPickableClasses,
  searchAssetSelect,
  splitClassMembers,
} from './earnAssetSelect.utils';

import type { IEarnAssetSelectToken } from './earnAssetSelect.utils';

const BASE = { id: 'evm--8453', name: 'Base', logoURI: 'base.png' };

const token = (
  symbol: string,
  extra: Partial<IEarnAssetSelectToken> = {},
): IEarnAssetSelectToken => ({
  symbol,
  name: `${symbol} name`,
  logoURI: `${symbol}.png`,
  type: 'other',
  networks: [BASE],
  addresses: [],
  ...extra,
});

const USDC = token('USDC', {
  type: 'stable',
  rate: 5.19,
  name: 'USD Coin',
  addresses: [
    {
      networkId: BASE.id,
      address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    },
  ],
});
const USDT = token('USDT', { type: 'stable', rate: 6.21, fiatValue: 0 });
const DAI = token('DAI', { type: 'stable', rate: 4.1, fiatValue: 12.4 });
const USDG = token('USDG', { type: 'stable', rate: 3.2 });
const ETH = token('ETH', { type: 'eth', rate: 2.1, fiatValue: 40 });
const WSTETH = token('wstETH', { type: 'eth', rate: 3.1 });
const CB_BTC = token('cbBTC', { type: 'btc', rate: 1.2 });
const LINK = token('LINK', { rate: 0.4 });
const TOKENS = [USDC, USDT, DAI, USDG, ETH, WSTETH, CB_BTC, LINK];

describe('buildAssetSelectGroups', () => {
  it('keeps the kinds in order, heads two tokens or more with a row', () => {
    const groups = buildAssetSelectGroups({ tokens: TOKENS, purpose: 'earn' });
    expect(groups.map((group) => group.key)).toEqual([
      'stable',
      'eth',
      'btc',
      'other',
    ]);
    expect(groups.map((group) => Boolean(group.classRow))).toEqual([
      true,
      true,
      // One BTC token and Others: no row that picks them all
      false,
      false,
    ]);
    expect(listPickableClasses(groups)).toEqual(['stable', 'eth']);
  });

  it('lists Earn held first, then by best rate; the row takes the best', () => {
    const [stable] = buildAssetSelectGroups({
      tokens: TOKENS,
      purpose: 'earn',
    });
    expect(stable.tokens.map((item) => item.symbol)).toEqual([
      'DAI',
      'USDT',
      'USDC',
      'USDG',
    ]);
    expect(stable.classRow?.rate).toBe(6.21);
    expect(stable.classRow?.fiatValue).toBe(12.4);
  });

  it('lists loans cheapest first; the row takes the lowest', () => {
    const [stable] = buildAssetSelectGroups({
      tokens: TOKENS,
      purpose: 'loanBorrow',
    });
    expect(stable.tokens.map((item) => item.symbol)).toEqual([
      'USDG',
      'DAI',
      'USDC',
      'USDT',
    ]);
    expect(stable.classRow?.rate).toBe(3.2);
  });

  it('lists collateral held first, then by name; no rate on its row', () => {
    const [stable] = buildAssetSelectGroups({
      tokens: TOKENS,
      purpose: 'loanSupply',
    });
    expect(stable.tokens.map((item) => item.symbol)).toEqual([
      'DAI',
      'USDC',
      'USDG',
      'USDT',
    ]);
    expect(stable.classRow?.rate).toBeUndefined();
  });
});

describe('searchAssetSelect', () => {
  const groups = buildAssetSelectGroups({ tokens: TOKENS, purpose: 'earn' });

  it('finds a kind by its words, tokens by the closest match', () => {
    const result = searchAssetSelect({
      groups,
      keyword: 'eth',
      purpose: 'earn',
    });
    expect(result.classRows.map((row) => row.assetClass)).toEqual(['eth']);
    expect(result.tokens.map((item) => item.token.symbol)).toEqual([
      'ETH',
      'wstETH',
    ]);
    expect(
      searchAssetSelect({ groups, keyword: 'Stable', purpose: 'earn' })
        .classRows[0]?.assetClass,
    ).toBe('stable');
  });

  it('finds a token by its name', () => {
    const result = searchAssetSelect({
      groups,
      keyword: 'usd coin',
      purpose: 'earn',
    });
    expect(result.tokens.map((item) => item.token.symbol)).toEqual(['USDC']);
  });

  it("doesn't offer a kind that has no row of its own", () => {
    const result = searchAssetSelect({
      groups,
      keyword: 'btc',
      purpose: 'earn',
    });
    expect(result.classRows).toEqual([]);
    expect(result.tokens.map((item) => item.token.symbol)).toEqual(['cbBTC']);
  });

  it('finds a pasted contract address, in any letter case', () => {
    const result = searchAssetSelect({
      groups,
      keyword: '0x833589FCD6EDB6E08F4C7C32D4F71B54BDA02913',
      purpose: 'earn',
    });
    expect(result.classRows).toEqual([]);
    expect(result.tokens.map((item) => item.token.symbol)).toEqual(['USDC']);
    expect(result.tokens[0]?.matchedAddress).toBe(
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    );
  });

  it('finds nothing for an address no token here has', () => {
    const result = searchAssetSelect({
      groups,
      keyword: '0x0000000000000000000000000000000000000001',
      purpose: 'earn',
    });
    expect(result.tokens).toEqual([]);
  });
});

describe('picks', () => {
  const stableSymbols = new Set(['USDC', 'USDT']);
  it('takes in the token itself, or any token of the kind', () => {
    expect(
      isInAssetPick({
        symbol: 'usdc',
        pick: { kind: 'token', symbol: 'USDC' },
        stableSymbols,
      }),
    ).toBe(true);
    expect(
      isInAssetPick({
        symbol: 'DAI',
        pick: { kind: 'class', assetClass: 'stable' },
        stableSymbols,
      }),
    ).toBe(true);
    expect(
      isInAssetPick({
        symbol: 'cbBTC',
        pick: { kind: 'class', assetClass: 'stable' },
        stableSymbols,
      }),
    ).toBe(false);
  });

  it('tells two picks apart', () => {
    expect(
      isSameAssetPick(
        { kind: 'token', symbol: 'usdc' },
        { kind: 'token', symbol: 'USDC' },
      ),
    ).toBe(true);
    expect(
      isSameAssetPick(
        { kind: 'class', assetClass: 'eth' },
        { kind: 'token', symbol: 'ETH' },
      ),
    ).toBe(false);
  });
});

describe('words', () => {
  it('names the first three and counts the rest', () => {
    expect(splitClassMembers([USDC, USDT, DAI, USDG])).toEqual({
      shown: ['USDC', 'USDT', 'DAI'],
      rest: 1,
    });
  });
  it('knows an address from a name', () => {
    expect(isAddressKeyword('USDC')).toBe(false);
    expect(
      isAddressKeyword('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    ).toBe(true);
  });
});
