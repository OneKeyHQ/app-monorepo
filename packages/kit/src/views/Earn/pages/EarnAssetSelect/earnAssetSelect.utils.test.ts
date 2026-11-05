import {
  buildAssetSelectGroups,
  buildAssetSelectView,
  getAssetSelectOpening,
  isAddressKeyword,
  isInAssetPick,
  isSameAssetPick,
  isSameAssetPickAsset,
  listAssetSelectHeldNetworks,
  listAssetSelectNetworks,
  listPickableClasses,
  orderAssetSelectPhoneNetworks,
  scopeAssetSelectToken,
  scopeAssetSelectTokens,
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
  it('names fewer where the line is short', () => {
    expect(splitClassMembers([USDC, USDT, DAI, USDG], 1)).toEqual({
      shown: ['USDC'],
      rest: 3,
    });
  });
  it('knows an address from a name', () => {
    expect(isAddressKeyword('USDC')).toBe(false);
    expect(
      isAddressKeyword('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    ).toBe(true);
  });
});

describe('picks with a network (11-05)', () => {
  const ARBITRUM = { id: 'evm--42161', name: 'Arbitrum', logoURI: 'arb.png' };
  const usdc = token('USDC', {
    type: 'stable',
    networks: [
      { ...BASE, rate: 5.19, balance: '4', fiatValue: 4 },
      { ...ARBITRUM, rate: 3.1, balance: '10', fiatValue: 10 },
    ],
    addresses: [
      { networkId: BASE.id, address: '0xbase' },
      { networkId: ARBITRUM.id, address: '0xarb' },
    ],
    rate: 5.19,
    balance: '14',
    fiatValue: 14,
  });

  it('tells one network from every network', () => {
    const everywhere = { kind: 'token', symbol: 'USDC' } as const;
    const onBase = { ...everywhere, networkId: BASE.id };
    expect(isSameAssetPick(everywhere, onBase)).toBe(false);
    expect(isSameAssetPickAsset(everywhere, onBase)).toBe(true);
    expect(isSameAssetPick(onBase, { ...onBase })).toBe(true);
  });

  it('takes a token on the pick network only', () => {
    const stable = new Set(['USDC']);
    const pick = {
      kind: 'class',
      assetClass: 'stable',
      networkId: BASE.id,
    } as const;
    expect(
      isInAssetPick({
        symbol: 'USDC',
        networkId: BASE.id,
        pick,
        stableSymbols: stable,
      }),
    ).toBe(true);
    expect(
      isInAssetPick({
        symbol: 'USDC',
        networkId: ARBITRUM.id,
        pick,
        stableSymbols: stable,
      }),
    ).toBe(false);
    // Without the token's network, the kind alone decides
    expect(isInAssetPick({ symbol: 'USDC', pick, stableSymbols: stable })).toBe(
      true,
    );
  });

  it('gives a token its figures on one network', () => {
    expect(scopeAssetSelectToken(usdc)).toBe(usdc);
    expect(scopeAssetSelectToken(usdc, ARBITRUM.id)).toMatchObject({
      rate: 3.1,
      balance: '10',
      fiatValue: 10,
      addresses: [{ networkId: ARBITRUM.id, address: '0xarb' }],
    });
    expect(scopeAssetSelectToken(usdc, 'sol--101')).toBeUndefined();
    expect(scopeAssetSelectTokens([usdc], 'sol--101')).toEqual([]);
  });

  it('lists the networks the wallet holds most on first, then by name', () => {
    const eth = token('ETH', {
      type: 'eth',
      networks: [{ id: 'evm--1', name: 'Ethereum', logoURI: 'eth.png' }],
    });
    expect(listAssetSelectNetworks([eth, usdc]).map((item) => item.id)).toEqual(
      [ARBITRUM.id, BASE.id, 'evm--1'],
    );
  });
});

describe('the list by network and tab (11-05)', () => {
  const ARBITRUM = { id: 'evm--42161', name: 'Arbitrum', logoURI: 'arb.png' };
  const ETHEREUM = { id: 'evm--1', name: 'Ethereum', logoURI: 'eth.png' };
  // USDC on Base and Arbitrum, held on Arbitrum; USDT on Arbitrum alone
  const usdc = token('USDC', {
    type: 'stable',
    networks: [
      { ...BASE, rate: 5.19 },
      { ...ARBITRUM, rate: 3.1, balance: '10', fiatValue: 10 },
    ],
    addresses: [
      {
        networkId: BASE.id,
        address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      },
      {
        networkId: ARBITRUM.id,
        address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      },
    ],
    rate: 5.19,
    balance: '10',
    fiatValue: 10,
  });
  const usdt = token('USDT', {
    type: 'stable',
    networks: [{ ...ARBITRUM, rate: 6.2 }],
    rate: 6.2,
  });
  const dai = token('DAI', {
    type: 'stable',
    networks: [{ ...BASE, rate: 4.1 }],
    rate: 4.1,
  });
  const eth = token('ETH', {
    type: 'eth',
    networks: [
      { ...ETHEREUM, rate: 2.1, balance: '0.01', fiatValue: 40 },
      { ...BASE, rate: 2.4 },
    ],
    rate: 2.4,
    balance: '0.01',
    fiatValue: 40,
  });
  const wsteth = token('wstETH', {
    type: 'eth',
    networks: [{ ...ETHEREUM, rate: 3.1 }],
    rate: 3.1,
  });
  const cbBtc = token('cbBTC', {
    type: 'btc',
    networks: [{ ...BASE, rate: 1.2 }],
    rate: 1.2,
  });
  const link = token('LINK', {
    networks: [{ ...ETHEREUM, rate: 0.4 }],
    rate: 0.4,
  });
  const aave = token('AAVE', {
    networks: [{ ...ETHEREUM, rate: 0.3 }],
    rate: 0.3,
  });
  const all = [usdc, usdt, dai, eth, wsteth, cbBtc, link, aave];
  const symbols = (view: ReturnType<typeof buildAssetSelectView>) =>
    view.rows.map((row) =>
      row.type === 'class' ? `kind:${row.row.assetClass}` : row.token.symbol,
    );

  it('lists every token once under All, held first, with no kind rows', () => {
    const view = buildAssetSelectView({
      tokens: all,
      purpose: 'earn',
      category: 'all',
      keyword: '',
    });
    expect(view.categories).toEqual(['all', 'stable', 'eth', 'btc', 'other']);
    expect(view.category).toBe('all');
    expect(symbols(view)).toEqual([
      'ETH',
      'USDC',
      'USDT',
      'DAI',
      'wstETH',
      'cbBTC',
      'LINK',
      'AAVE',
    ]);
  });

  it('starts a kind tab with the whole kind, then its tokens', () => {
    const view = buildAssetSelectView({
      tokens: all,
      purpose: 'earn',
      category: 'stable',
      keyword: '',
    });
    expect(symbols(view)).toEqual(['kind:stable', 'USDC', 'USDT', 'DAI']);
    const kind = view.rows[0];
    expect(kind.type === 'class' ? kind.row.rate : undefined).toBe(6.2);
    expect(kind.type === 'class' ? kind.row.fiatValue : undefined).toBe(10);
  });

  it('heads neither Others nor a kind of one token', () => {
    expect(
      symbols(
        buildAssetSelectView({
          tokens: all,
          purpose: 'earn',
          category: 'other',
          keyword: '',
        }),
      ),
    ).toEqual(['LINK', 'AAVE']);
    expect(
      symbols(
        buildAssetSelectView({
          tokens: all,
          purpose: 'earn',
          category: 'btc',
          keyword: '',
        }),
      ),
    ).toEqual(['cbBTC']);
  });

  it('keeps to the network chosen, with its figures there', () => {
    const view = buildAssetSelectView({
      tokens: all,
      purpose: 'earn',
      networkId: ARBITRUM.id,
      category: 'all',
      keyword: '',
    });
    expect(view.categories).toEqual(['all', 'stable']);
    expect(symbols(view)).toEqual(['USDC', 'USDT']);
    const first = view.rows[0];
    expect(first.type === 'token' ? first.token.rate : undefined).toBe(3.1);
    expect(first.type === 'token' ? first.token.networks : []).toHaveLength(1);
  });

  it('shows All where the tab has nothing on the network', () => {
    const view = buildAssetSelectView({
      tokens: all,
      purpose: 'earn',
      networkId: ARBITRUM.id,
      category: 'btc',
      keyword: '',
    });
    expect(view.category).toBe('all');
    expect(symbols(view)).toEqual(['USDC', 'USDT']);
  });

  it('searches the network chosen; the tabs become the kinds found', () => {
    const view = buildAssetSelectView({
      tokens: all,
      purpose: 'earn',
      networkId: BASE.id,
      category: 'all',
      keyword: 'usd',
    });
    // "usd" names the stable kind, which has two tokens on Base
    expect(symbols(view)).toEqual(['kind:stable', 'USDC']);
    expect(view.categories).toEqual(['all', 'stable']);
  });

  it('narrows a search to the tab while it has matches', () => {
    const inEth = buildAssetSelectView({
      tokens: all,
      purpose: 'earn',
      category: 'eth',
      keyword: 'e',
    });
    expect(inEth.category).toBe('eth');
    expect(symbols(inEth)).toEqual(['kind:eth', 'ETH', 'wstETH']);
    // No BTC token matches: the search shows every kind it found
    const fromBtc = buildAssetSelectView({
      tokens: all,
      purpose: 'earn',
      category: 'btc',
      keyword: 'usdt',
    });
    expect(fromBtc.category).toBe('all');
    expect(symbols(fromBtc)).toEqual(['USDT']);
  });

  it('finds a pasted address only on the network chosen', () => {
    const arbAddress = '0xAF88D065E77C8CC2239327C5EDB3A432268E5831';
    expect(
      symbols(
        buildAssetSelectView({
          tokens: all,
          purpose: 'earn',
          category: 'all',
          keyword: arbAddress,
        }),
      ),
    ).toEqual(['USDC']);
    expect(
      buildAssetSelectView({
        tokens: all,
        purpose: 'earn',
        networkId: BASE.id,
        category: 'all',
        keyword: arbAddress,
      }).rows,
    ).toEqual([]);
  });

  it('orders a loan to borrow cheapest first under All', () => {
    const view = buildAssetSelectView({
      tokens: all,
      purpose: 'loanBorrow',
      category: 'all',
      keyword: '',
    });
    expect(symbols(view).slice(0, 3)).toEqual(['AAVE', 'LINK', 'cbBTC']);
  });

  it('lists the networks the wallet holds on, the most first', () => {
    expect(
      listAssetSelectHeldNetworks({
        tokens: all,
        networks: [BASE, ARBITRUM, ETHEREUM],
      }).map((item) => [item.network.id, item.fiatValue]),
    ).toEqual([
      [ETHEREUM.id, 40],
      [ARBITRUM.id, 10],
    ]);
  });

  it("opens on the pick's network and a kind's own tab", () => {
    const networks = [BASE, ARBITRUM];
    expect(
      getAssetSelectOpening({
        selected: { kind: 'token', symbol: 'USDC', networkId: BASE.id },
        networks,
      }),
    ).toEqual({ networkId: BASE.id, category: 'all' });
    expect(
      getAssetSelectOpening({
        selected: { kind: 'class', assetClass: 'eth' },
        networks,
      }),
    ).toEqual({ networkId: undefined, category: 'eth' });
    // A network the column doesn't list opens on every network
    expect(
      getAssetSelectOpening({
        selected: { kind: 'token', symbol: 'ETH', networkId: ETHEREUM.id },
        networks,
      }).networkId,
    ).toBeUndefined();
  });

  it('moves a network picked from the full list up front on the phone', () => {
    expect(
      orderAssetSelectPhoneNetworks(
        [BASE, ARBITRUM, ETHEREUM],
        ETHEREUM.id,
      ).map((item) => item.id),
    ).toEqual([ETHEREUM.id, BASE.id, ARBITRUM.id]);
    expect(orderAssetSelectPhoneNetworks([BASE, ARBITRUM])).toEqual([
      BASE,
      ARBITRUM,
    ]);
  });
});
