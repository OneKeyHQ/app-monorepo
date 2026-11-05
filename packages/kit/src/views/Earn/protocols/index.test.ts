import { getEarnProtocol } from '.';

describe('Earn protocol stake type', () => {
  it.each([
    ['native', 'ETH', 'USDT', true, 'wrap'],
    ['NATIVE', 'weth', 'USDT', false, 'normal'],
    ['Native', 'ETH', 'ETH', undefined, 'normal'],
    ['native', 'USDT', 'ETH', true, undefined],
    ['native', undefined, 'ETH', true, undefined],
    ['etherfi', 'USDT', 'ETH', true, 'wrap'],
    ['ETHERFI', 'USDT', 'weth', false, 'normal'],
    ['EtherFi', 'ETH', 'ETH', undefined, 'normal'],
    ['etherfi', 'ETH', 'eETH', true, undefined],
    ['etherfi', 'ETH', undefined, true, undefined],
    ['pendle', 'ETH', 'ETH', true, undefined],
    ['PENDLE', 'WETH', 'WETH', false, undefined],
    ['morpho', 'ETH', 'ETH', true, undefined],
    ['', 'ETH', 'ETH', true, undefined],
    [' native ', 'ETH', 'ETH', true, undefined],
  ])(
    'resolves %s with vault %s and token %s',
    (providerName, vaultSymbol, tokenSymbol, tokenIsNative, expected) => {
      expect(
        getEarnProtocol(providerName).resolveStakeType({
          vaultSymbol,
          tokenSymbol,
          tokenIsNative,
        }),
      ).toBe(expected);
    },
  );
});

describe('Earn protocol stake quote requirements', () => {
  it.each([
    ['Pendle', true],
    ['PENDLE', true],
    ['Native', false],
    ['EtherFi', false],
    ['Morpho', false],
    [' pendle ', false],
    ['', false],
  ])('%s requires a current quote: %s', (providerName, expected) => {
    expect(getEarnProtocol(providerName).requiresCurrentStakeQuote()).toBe(
      expected,
    );
  });
});

describe('Earn protocol stake plan', () => {
  it.each([
    ['native', 'wrap', undefined, 'wrappedTask', undefined, false],
    ['NATIVE', 'normal', undefined, 'direct', undefined, false],
    [
      'etherfi',
      'wrap',
      'confirm-setup-before-deposit',
      'wrappedTask',
      'confirm-setup-before-deposit',
      false,
    ],
    [
      'etherfi',
      'normal',
      'confirm-setup-before-deposit',
      'direct',
      'confirm-setup-before-deposit',
      false,
    ],
    ['etherfi', 'wrap', undefined, 'wrappedTask', undefined, false],
    ['pendle', undefined, undefined, 'direct', undefined, true],
    ['PENDLE', 'normal', undefined, 'direct', undefined, true],
    ['morpho', undefined, undefined, 'direct', undefined, false],
    [
      'native',
      'wrap',
      'confirm-setup-before-deposit',
      'wrappedTask',
      'confirm-setup-before-deposit',
      false,
    ],
  ] as const)(
    'plans %s stake %s with configured preparation %s',
    (
      provider,
      stakeType,
      preparationPolicy,
      execution,
      expectedPolicy,
      requiresCurrentQuote,
    ) => {
      expect(
        getEarnProtocol(provider).planStake({ stakeType, preparationPolicy }),
      ).toEqual({
        execution,
        preparationPolicy: expectedPolicy,
        requiresCurrentQuote,
      });
    },
  );
});
