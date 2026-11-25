import sdkStarknet from '@onekeyhq/core/src/chains/starknet/sdkStarknet';

import {
  ERC20_ENTRYPOINT,
  ERC20_SELECTOR,
  STRK20_POOL_ENTRYPOINT,
  STRK20_POOL_SELECTOR,
} from './consts';

/**
 * ERC20_SELECTOR is hardcoded so starknet.js stays out of the background
 * bundle. Derive the same values through the core helper (the v1 execute
 * calldata puts the selector at index 2: [callsLen, to, selector, ...]) so a
 * typo or a renamed entrypoint fails here instead of at runtime.
 */
function selectorOf(entrypoint: string) {
  // buildExecuteCalldata emits decimal felts, so re-encode before comparing
  const selector = sdkStarknet.buildExecuteCalldata([
    { contractAddress: '0x1', entrypoint, calldata: [] },
  ])[2];
  return `0x${BigInt(selector).toString(16)}`;
}

describe('starknet erc20 selectors', () => {
  it.each(Object.keys(ERC20_SELECTOR) as (keyof typeof ERC20_SELECTOR)[])(
    'matches the hashed name for %s',
    (name) => {
      expect(ERC20_SELECTOR[name]).toBe(selectorOf(ERC20_ENTRYPOINT[name]));
    },
  );

  it('keeps the transfer and approve entrypoint names hashable too', () => {
    expect(selectorOf(ERC20_ENTRYPOINT.transfer)).toBe(
      '0x83afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e',
    );
    expect(selectorOf(ERC20_ENTRYPOINT.approve)).toBe(
      '0x219209e083275171774dab1df80982e9df2096516f06319c5c6d71ae0a8480c',
    );
  });
});

describe('strk20 pool selectors', () => {
  it.each(
    Object.keys(STRK20_POOL_SELECTOR) as (keyof typeof STRK20_POOL_SELECTOR)[],
  )('matches the hashed name for %s', (name) => {
    expect(STRK20_POOL_SELECTOR[name]).toBe(
      selectorOf(STRK20_POOL_ENTRYPOINT[name]),
    );
  });
});
