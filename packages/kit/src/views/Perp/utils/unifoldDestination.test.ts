import { validateHypercoreDestination } from './unifoldDestination';

import type { DestinationToken } from '@unifold/core';

const EXPECTED = {
  chainId: '1337',
  tokenAddress: '0x00000000000000000000000000000000',
};

const mkToken = (
  chains: Array<{ chain_id: string; token_address: string }>,
): DestinationToken =>
  ({
    symbol: 'USDC (Perp)',
    name: 'USDC',
    icon_url: '',
    chains,
  }) as unknown as DestinationToken;

describe('validateHypercoreDestination', () => {
  it('passes when a remote token covers the hardcoded destination chain', () => {
    expect(
      validateHypercoreDestination(
        [
          mkToken([
            {
              chain_id: '1337',
              token_address: '0x00000000000000000000000000000000',
            },
          ]),
        ],
        EXPECTED,
      ),
    ).toBe(true);
  });

  it('matches token address case-insensitively', () => {
    expect(
      validateHypercoreDestination(
        [mkToken([{ chain_id: '1337', token_address: '0x00000000000000000000000000000000'.toUpperCase() }])],
        EXPECTED,
      ),
    ).toBe(true);
  });

  it('fails when no token covers the destination', () => {
    expect(
      validateHypercoreDestination(
        [mkToken([{ chain_id: '42161', token_address: '0xabc' }])],
        EXPECTED,
      ),
    ).toBe(false);
  });

  it('fails closed on empty/undefined remote list', () => {
    expect(validateHypercoreDestination([], EXPECTED)).toBe(false);
    expect(validateHypercoreDestination(undefined, EXPECTED)).toBe(false);
  });
});
