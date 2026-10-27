import {
  getXmrSpendPublicKeyFromAddress,
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

describe('Monero spend public key from an address', () => {
  // cspell:ignore getwatchkey
  // firmware-pro tests/device_tests/monero/test_getwatchkey.py, account 0.
  const address =
    '4Ahp23WfMrMFK3wYL2hLWQFGt87ZTeRkufS6JoQZu6MEFDokAQeGWmu9MA3GFq1yVLSJQbKJqVAn9F9DLYGpRzRAEXqAXKM';

  it('reads the spend key of a primary address', () => {
    expect(getXmrSpendPublicKeyFromAddress(address)).toBe(
      'efa28120860bbe558fa9f978dd254555566ba5a86974bae5c608f9a83822c955',
    );
  });

  it('rejects a corrupted address', () => {
    const corrupted = `${address.slice(0, 10)}${address[10] === 'a' ? 'b' : 'a'}${address.slice(11)}`;
    expect(() => getXmrSpendPublicKeyFromAddress(corrupted)).toThrow(
      'xmr: invalid address checksum',
    );
  });

  it('rejects text that is not a Monero address', () => {
    expect(() => getXmrSpendPublicKeyFromAddress('t1abc')).toThrow(/^xmr: /);
  });
});
