import {
  getXmrIntegratedAddressPaymentId,
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

describe('Monero payment ID from an integrated address', () => {
  // monero-address 0.1.0 src/tests.rs: the standard address and it with payment ID b8963a57855cf73f.
  const standard =
    '4B33mFPMq6mKi7Eiyd5XuyKRVMGVZz1Rqb9ZTyGApXW5d1aT7UBDZ89ewmnWFkzJ5wPd2SFbn313vCT8a4E2Qf4KQH4pNey';
  const integrated =
    '4Ljin4CrSNHKi7Eiyd5XuyKRVMGVZz1Rqb9ZTyGApXW5d1aT7UBDZ89ewmnWFkzJ5wPd2SFbn313vCT8a4E2Qf4KbaTH6MnpXSn88oBX35';
  const subaddress =
    '8C5zHM5ud8nGC4hC2ULiBLSWx9infi8JUUmWEat4fcTf8J4H38iWYVdFmPCA9UmfLTZxD43RsyKnGEdZkoGij6csDeUnbEB';
  // The same address with an all-zero payment ID, encoded by monero-address.
  const integratedWithZeroId =
    '4Ljin4CrSNHKi7Eiyd5XuyKRVMGVZz1Rqb9ZTyGApXW5d1aT7UBDZ89ewmnWFkzJ5wPd2SFbn313vCT8a4E2Qf4KbTTZsHgcG7Z14bDEj2';

  it('reads the payment ID of an integrated address', () => {
    expect(getXmrIntegratedAddressPaymentId(integrated)).toBe(
      'b8963a57855cf73f',
    );
  });

  it.each([
    ['a standard address', standard],
    ['a subaddress', subaddress],
    ['an all-zero payment ID', integratedWithZeroId],
    ['text that is not a Monero address', 't1abc'],
    ['an empty string', ''],
  ])('has none for %s', (_name, address) => {
    expect(getXmrIntegratedAddressPaymentId(address)).toBeUndefined();
  });

  it('has none for a corrupted integrated address', () => {
    const corrupted = `${integrated.slice(0, 10)}${integrated[10] === 'a' ? 'b' : 'a'}${integrated.slice(11)}`;
    expect(getXmrIntegratedAddressPaymentId(corrupted)).toBeUndefined();
  });
});
