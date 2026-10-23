import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import {
  EARN_GUIDE_VAULT,
  deriveGuideState,
  findGuideGas,
  getGuideScope,
  getPreviewGuideState,
  hasGuideGas,
  isGuideVaultOffer,
  nextPreviewStep,
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

describe('guide steps', () => {
  it('starts at step 1 without ETH on Base', () => {
    expect(deriveGuideState({ hasGas: false, saved: {} })).toEqual({
      done: [false, false, false, false],
      current: 1,
    });
  });

  it('starts at step 2 with ETH on Base', () => {
    expect(deriveGuideState({ hasGas: true, saved: {} }).current).toBe(2);
  });

  it('moves to the deposit once a vault is picked', () => {
    expect(
      deriveGuideState({ hasGas: true, saved: { vaultKey: 'v' } }).current,
    ).toBe(3);
  });

  it('goes back to step 1 when the ETH is gone before the deposit', () => {
    expect(
      deriveGuideState({ hasGas: false, saved: { vaultKey: 'v' } }),
    ).toEqual({ done: [false, true, false, false], current: 1 });
  });

  it('keeps steps 1 to 3 done after its deposit, whatever ETH is left', () => {
    expect(
      deriveGuideState({ hasGas: false, saved: { depositedAt: 1 } }),
    ).toEqual({ done: [true, true, true, false], current: 4 });
  });

  it('marks every step done when finished', () => {
    expect(
      deriveGuideState({
        hasGas: true,
        saved: { vaultKey: 'v', depositedAt: 1, completed: true },
      }).done,
    ).toEqual([true, true, true, true]);
  });
});

describe('guide preview', () => {
  it('shows every step before the previewed one done', () => {
    expect(getPreviewGuideState(3)).toEqual({
      done: [true, true, false, false],
      current: 3,
    });
  });

  it('cycles 1 to 4 and back to the real state', () => {
    const seen = [];
    let step = nextPreviewStep(undefined);
    while (step) {
      seen.push(step);
      step = nextPreviewStep(step);
    }
    expect(seen).toEqual([1, 2, 3, 4]);
  });
});

describe('when the guide card shows', () => {
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

  it('stays for step 4 after its own deposit', () => {
    expect(
      shouldShowGuide({
        ...base,
        hasPositions: true,
        saved: { depositedAt: 1 },
      }),
    ).toBe(true);
  });

  it('always shows without positions, finished before or not', () => {
    expect(shouldShowGuide({ ...base, saved: { completed: true } })).toBe(true);
  });

  it('is gone once finished with a position', () => {
    expect(
      shouldShowGuide({
        ...base,
        hasPositions: true,
        saved: { depositedAt: 1, completed: true },
      }),
    ).toBe(false);
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
