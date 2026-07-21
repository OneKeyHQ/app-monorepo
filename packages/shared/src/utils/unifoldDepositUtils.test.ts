import { assertUnifoldEchoMatches } from './unifoldDepositUtils';

const REQUEST = {
  recipientAddress: '0x8dE690000000000000000000000000003c8eb0aa',
  destinationChainType: 'ethereum',
  destinationChainId: '1337',
  destinationTokenAddress: '0x00000000000000000000000000000000',
};

const MATCHING_ECHO = { ...REQUEST };

describe('assertUnifoldEchoMatches', () => {
  it('passes on an exact echo', () => {
    expect(() =>
      assertUnifoldEchoMatches(MATCHING_ECHO, REQUEST),
    ).not.toThrow();
  });

  it('ignores address casing differences', () => {
    expect(() =>
      assertUnifoldEchoMatches(
        {
          ...MATCHING_ECHO,
          recipientAddress: REQUEST.recipientAddress.toUpperCase(),
          destinationTokenAddress:
            REQUEST.destinationTokenAddress.toUpperCase(),
        },
        REQUEST,
      ),
    ).not.toThrow();
  });

  it.each([
    [
      'recipientAddress',
      { recipientAddress: '0x0000000000000000000000000000000000000bad' },
    ],
    ['destinationChainType', { destinationChainType: 'solana' }],
    ['destinationChainId', { destinationChainId: '1' }],
    [
      'destinationTokenAddress',
      { destinationTokenAddress: '0x6d1e0000000000000000000000000000' },
    ],
  ])('throws when %s differs', (_field, override) => {
    expect(() =>
      assertUnifoldEchoMatches({ ...MATCHING_ECHO, ...override }, REQUEST),
    ).toThrow('echo mismatch');
  });

  it('throws on missing echo or empty fields (fail-closed)', () => {
    expect(() => assertUnifoldEchoMatches(undefined, REQUEST)).toThrow();
    expect(() => assertUnifoldEchoMatches(null, REQUEST)).toThrow();
    expect(() =>
      assertUnifoldEchoMatches(
        { ...MATCHING_ECHO, recipientAddress: '' },
        REQUEST,
      ),
    ).toThrow();
  });
});
