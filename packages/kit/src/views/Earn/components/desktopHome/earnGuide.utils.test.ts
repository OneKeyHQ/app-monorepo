import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import {
  EARN_GUIDE_SETTLE_MS,
  EARN_GUIDE_VAULT,
  countsAsGuideDeposit,
  deriveGuideState,
  findGuideGas,
  getEarnGuideNetworkId,
  getGuideScope,
  getPreviewGuideState,
  hasGuideGas,
  isGuideOverWithoutPositions,
  isGuideVaultOffer,
  nextPreviewStep,
  pickGuideSwapFrom,
  shouldShowGuide,
} from './earnGuide.utils';

import type {
  IEarnDesktopHoldOffer,
  IEarnDesktopWalletNetworkGroup,
} from './earnDesktopHome.utils';

const BASE = 'evm--8453';

const token = (
  symbol: string,
  key: string,
  extra: Partial<IAccountToken> = {},
): IAccountToken => ({
  $key: key,
  symbol,
  name: symbol,
  address: key,
  decimals: 18,
  isNative: false,
  ...extra,
});

const fiat = (balanceParsed: string): ITokenFiat => ({
  balance: balanceParsed,
  balanceParsed,
  fiatValue: '0',
  price: 0,
  currency: 'usd',
});

const group = (
  networkId: string,
  tokens: IAccountToken[],
  map: Record<string, ITokenFiat>,
): IEarnDesktopWalletNetworkGroup => ({
  accountId: 'acc',
  networkId,
  tokens,
  map,
});

const protocolOffer = (
  provider: string,
  vault?: string,
): IEarnDesktopHoldOffer => ({
  kind: 'protocol',
  key: `${BASE}-${provider}-${vault ?? ''}`,
  apr: 4,
  isFixedRate: false,
  item: {
    provider: { name: provider, vault },
    network: { networkId: BASE, name: 'Base', logoURI: '' },
    isEarning: false,
  } as unknown as IStakeProtocolListItem,
});

describe('guide tasks', () => {
  it('starts at task 1 without ETH on Base', () => {
    expect(deriveGuideState({ hasGas: false, saved: {} })).toEqual({
      done: [false, false, false],
      current: 1,
    });
  });

  it('starts at the deposit with ETH on Base', () => {
    expect(deriveGuideState({ hasGas: true, saved: {} })).toEqual({
      done: [true, false, false],
      current: 2,
    });
  });

  it('keeps tasks 1 and 2 done after a deposit, whatever ETH is left', () => {
    expect(
      deriveGuideState({ hasGas: false, saved: { depositedAt: 1 } }),
    ).toEqual({ done: [true, true, false], current: 3 });
  });

  it('marks every task done when finished', () => {
    expect(
      deriveGuideState({
        hasGas: true,
        saved: { depositedAt: 1, completed: true },
      }).done,
    ).toEqual([true, true, true]);
  });
});

describe('guide preview', () => {
  it('shows every task before the previewed one done', () => {
    expect(getPreviewGuideState(3)).toEqual({
      done: [true, true, false],
      current: 3,
    });
  });

  it('cycles 1 to 3 and back to the real state', () => {
    const seen = [];
    let step = nextPreviewStep(undefined);
    while (step) {
      seen.push(step);
      step = nextPreviewStep(step);
    }
    expect(seen).toEqual([1, 2, 3]);
  });
});

describe('when the guide shows', () => {
  const base = {
    isLoading: false,
    hasWallet: true,
    isWatching: false,
    hasPositions: false,
    saved: {},
  };

  it('shows for a wallet without positions', () => {
    expect(shouldShowGuide(base)).toBe(true);
  });

  it('shows with no wallet at all', () => {
    expect(shouldShowGuide({ ...base, hasWallet: false })).toBe(true);
  });

  it('waits for the page to load', () => {
    expect(shouldShowGuide({ ...base, isLoading: true })).toBe(false);
  });

  it('never shows for a watched account', () => {
    expect(shouldShowGuide({ ...base, isWatching: true })).toBe(false);
  });

  it('ends when a position comes some other way', () => {
    expect(shouldShowGuide({ ...base, hasPositions: true })).toBe(false);
  });

  it('stays for the last task after a deposit', () => {
    expect(
      shouldShowGuide({
        ...base,
        hasPositions: true,
        saved: { depositedAt: 1 },
      }),
    ).toBe(true);
  });

  it('is gone once finished, before the position is listed too', () => {
    const saved = { depositedAt: 1, completed: true };
    expect(shouldShowGuide({ ...base, saved })).toBe(false);
    expect(shouldShowGuide({ ...base, hasPositions: true, saved })).toBe(false);
  });

  it('shows in preview whatever the account holds', () => {
    expect(
      shouldShowGuide({
        ...base,
        isWatching: true,
        hasPositions: true,
        saved: { completed: true },
        previewStep: 2,
      }),
    ).toBe(true);
  });
});

describe('a finished guide and an account without positions', () => {
  const finishedAt = 1_000_000;
  const saved = { depositedAt: finishedAt, completed: true };

  it('waits while the deposit is still being listed', () => {
    expect(
      isGuideOverWithoutPositions({
        saved,
        hasPositions: false,
        now: finishedAt + EARN_GUIDE_SETTLE_MS,
      }),
    ).toBe(false);
  });

  it('starts over when the account still has none after that', () => {
    expect(
      isGuideOverWithoutPositions({
        saved,
        hasPositions: false,
        now: finishedAt + EARN_GUIDE_SETTLE_MS + 1,
      }),
    ).toBe(true);
  });

  it('leaves an account with positions, and an unfinished guide, alone', () => {
    const now = finishedAt + EARN_GUIDE_SETTLE_MS + 1;
    expect(
      isGuideOverWithoutPositions({ saved, hasPositions: true, now }),
    ).toBe(false);
    expect(
      isGuideOverWithoutPositions({
        saved: { depositedAt: finishedAt },
        hasPositions: false,
        now,
      }),
    ).toBe(false);
  });
});

describe("which deposit is the guide's", () => {
  const base = {
    hasWallet: true,
    isWatching: false,
    hasPositions: false,
    saved: {},
  };

  it('takes the first deposit of an account without positions', () => {
    expect(countsAsGuideDeposit(base)).toBe(true);
  });

  it('leaves out an account that has positions, or deposited before', () => {
    expect(countsAsGuideDeposit({ ...base, hasPositions: true })).toBe(false);
    expect(countsAsGuideDeposit({ ...base, saved: { depositedAt: 1 } })).toBe(
      false,
    );
  });

  it('leaves out no wallet and a watched account', () => {
    expect(countsAsGuideDeposit({ ...base, hasWallet: false })).toBe(false);
    expect(countsAsGuideDeposit({ ...base, isWatching: true })).toBe(false);
  });
});

describe('guide gas and vault', () => {
  it('reads native ETH on Base only', () => {
    const groups = [
      group(
        BASE,
        [token('ETH', 'base_eth', { isNative: true }), token('USDC', 'u')],
        { base_eth: fiat('0.0004'), u: fiat('25') },
      ),
      group('evm--1', [token('ETH', 'eth', { isNative: true })], {
        eth: fiat('1'),
      }),
    ];
    expect(findGuideGas(groups, BASE)).toBeCloseTo(0.0004);
    expect(findGuideGas([], BASE)).toBe(0);
  });

  it('needs at least the minimum', () => {
    expect(hasGuideGas(0.0001)).toBe(true);
    expect(hasGuideGas('0.00009')).toBe(false);
    expect(hasGuideGas(undefined)).toBe(false);
  });

  it('finds the example vault whatever the address case', () => {
    expect(
      isGuideVaultOffer(
        protocolOffer(
          'Morpho',
          EARN_GUIDE_VAULT.toUpperCase().replace('X', 'x'),
        ),
      ),
    ).toBe(true);
    expect(isGuideVaultOffer(protocolOffer('morpho', '0xabc'))).toBe(false);
    expect(isGuideVaultOffer(protocolOffer('aave'))).toBe(false);
  });

  it('keeps no wallet under its own scope', () => {
    expect(getGuideScope({})).toBe('none');
    expect(getGuideScope({ accountId: 'a', indexedAccountId: 'i' })).toBe('i');
    expect(getGuideScope({ accountId: 'a' })).toBe('a');
  });
});

describe('what Swap starts on for the ETH on Base', () => {
  const base = getEarnGuideNetworkId();
  const held = (
    networkId: string,
    fiatValueUsd: string,
    isNative = false,
    amount = '1',
  ) => ({ networkId, amount, fiatValueUsd, token: { isNative } });

  it("takes the most valuable coin of a network's own on another network", () => {
    const eth = held('evm--42161', '8', true);
    expect(
      pickGuideSwapFrom(
        [held('evm--1', '300'), eth, held('evm--4663', '5', true)],
        base,
      ),
    ).toBe(eth);
  });

  it('takes the most valuable token elsewhere when no coin of a network is held', () => {
    const usdc = held('evm--1', '300');
    expect(pickGuideSwapFrom([held('evm--42161', '20'), usdc], base)).toBe(
      usdc,
    );
  });

  it('never takes a token on Base: the swap fee is the ETH that is missing', () => {
    expect(pickGuideSwapFrom([held(base, '500')], base)).toBeUndefined();
  });

  it('leaves out empty balances', () => {
    expect(
      pickGuideSwapFrom([held('evm--1', '0', true, '0')], base),
    ).toBeUndefined();
  });
});
