import {
  parseXmrViewingKeyPair,
  serializeXmrViewingKeyPair,
} from './viewingKeys';

const pair = {
  spendPublicKeyHex: 'ab'.repeat(32),
  viewPrivateKeyHex: 'cd'.repeat(32),
};

describe('Monero viewing-material storage boundary', () => {
  it('round-trips the existing account format with only viewing capabilities', () => {
    expect(parseXmrViewingKeyPair(serializeXmrViewingKeyPair(pair))).toEqual(
      pair,
    );
    expect(
      parseXmrViewingKeyPair(serializeXmrViewingKeyPair(pair).toUpperCase()),
    ).toEqual(pair);
  });

  it.each([
    '',
    `${pair.spendPublicKeyHex}:`,
    `${pair.spendPublicKeyHex}:${pair.viewPrivateKeyHex}:extra`,
    `${'gg'.repeat(32)}:${pair.viewPrivateKeyHex}`,
    `${pair.spendPublicKeyHex}:${'cd'.repeat(31)}`,
  ])(
    'rejects malformed material without including it in the error',
    (stored) => {
      expect(() => parseXmrViewingKeyPair(stored)).toThrow(
        /^xmr: invalid stored viewing material$/,
      );
    },
  );
});
