import {
  decodeAddress,
  encodeAddress,
  getZcashAccountIndexFromXpub,
  isShieldedAddress,
  validateZcashAddress,
} from '.';

import bs58check from 'bs58check';

import { getBtcForkNetwork } from '../../btc/sdkBtc/networks';

// hash160 = SHA256/RIPEMD of the well-known BIP32 test pubkey.
const HASH160 = '751e76e8199196d454941c45d1b3a323f1433bd6';
// Zcash mainnet transparent addresses for that hash160 (t1=P2PKH, t3=P2SH),
// and the BTC-legacy intermediates the shared pipeline emits for the same hash.
const T1 = 't1UYsZVJkLPeMjxEtACvSxfWuNmddpWfxzs';
const T3 = 't3VEtV2oBtHxjq7wKHJb3PHsqXHvMRgUmVw';
const BTC_P2PKH = '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH'; // version 0x00
const BTC_P2SH = '3CNHUhP3uyB9EUtRLsmvFUmvGdjGdkTxJw'; // version 0x05

describe('zcash transparent address codec', () => {
  it('reads the hardened account index from an account-level xpub', () => {
    const payload = Buffer.alloc(78);
    payload.writeUInt32BE(0x04_88_b2_1e, 0);
    payload[4] = 3;
    payload.writeUInt32BE(0x80_00_00_05, 9);
    expect(getZcashAccountIndexFromXpub(bs58check.encode(payload))).toBe(5);

    payload[4] = 2;
    expect(getZcashAccountIndexFromXpub(bs58check.encode(payload))).toBeNull();
    expect(getZcashAccountIndexFromXpub('not-an-xpub')).toBeNull();
  });

  it('encodes a BTC-legacy P2PKH intermediate to a t1 address', () => {
    expect(encodeAddress(BTC_P2PKH)).toBe(T1);
  });

  it('encodes a BTC-legacy P2SH intermediate to a t3 address', () => {
    expect(encodeAddress(BTC_P2SH)).toBe(T3);
  });

  it('decodes a t1 address back to the BTC-legacy P2PKH intermediate', () => {
    expect(decodeAddress(T1)).toBe(BTC_P2PKH);
  });

  it('decodes a t3 address back to the BTC-legacy P2SH intermediate', () => {
    expect(decodeAddress(T3)).toBe(BTC_P2SH);
  });

  it('is idempotent when encoding an already-encoded t-address', () => {
    expect(encodeAddress(T1)).toBe(T1);
    expect(encodeAddress(T3)).toBe(T3);
  });

  it('round-trips t-addresses through decode/encode', () => {
    expect(encodeAddress(decodeAddress(T1))).toBe(T1);
    expect(encodeAddress(decodeAddress(T3))).toBe(T3);
  });

  it('preserves the underlying hash160 across the conversion', () => {
    const decoded = Buffer.from(bs58check.decode(T1));
    expect(decoded.subarray(2).toString('hex')).toBe(HASH160);
  });

  it('rejects shielded addresses', () => {
    expect(isShieldedAddress('u1qqqqq')).toBe(true);
    expect(isShieldedAddress('zs1abc')).toBe(true);
    expect(isShieldedAddress(T1)).toBe(false);
    expect(() => decodeAddress('u1someunifiedaddress')).toThrow();
  });
});

describe('validateZcashAddress', () => {
  const network = getBtcForkNetwork('zec');

  it('accepts a valid t1 (P2PKH) address', () => {
    const r = validateZcashAddress({ address: T1, network });
    expect(r.isValid).toBe(true);
    expect(r.displayAddress).toBe(T1);
    expect(r.normalizedAddress).toBe(T1);
  });

  it('accepts a valid t3 (P2SH) address', () => {
    const r = validateZcashAddress({ address: T3, network });
    expect(r.isValid).toBe(true);
    expect(r.displayAddress).toBe(T3);
  });

  it('accepts a valid unified (u1) address', () => {
    // real mainnet UA, single orchard receiver (bech32m, HRP "u", 83-byte
    // jumbled payload)
    const UA =
      'u1nclshqcdr93nn3fdm7wawe68k0mklfs8a5czcht775gynnscm0xwhnealcv7vhfzw24mhnlehqhmrgg48dy5grwj6ststevlt3446fagw0ckl3z7y7c54dr5z7xjthtmrfs6gq6x53h';
    const r = validateZcashAddress({ address: UA, network });
    expect(r.isValid).toBe(true);
    expect(r.displayAddress).toBe(UA);
    expect(r.normalizedAddress).toBe(UA);
  });

  it('rejects malformed unified and legacy shielded addresses', () => {
    // u1-prefixed but not valid bech32m
    expect(
      validateZcashAddress({ address: 'u1someunifiedaddress', network })
        .isValid,
    ).toBe(false);
    // valid-checksum bech32m but payload shorter than the 48-byte F4Jumble floor
    expect(
      validateZcashAddress({ address: 'u1qqqqu7e3lz', network }).isValid,
    ).toBe(false);
    // Sapling destinations need the removed Sapling prover
    expect(
      validateZcashAddress({ address: 'zs1sapling', network }).isValid,
    ).toBe(false);
  });

  it('rejects malformed and non-Zcash addresses', () => {
    expect(
      validateZcashAddress({ address: 'notanaddress', network }).isValid,
    ).toBe(false);
    // a raw BTC mainnet address is not a Zcash t-address
    expect(validateZcashAddress({ address: BTC_P2PKH, network }).isValid).toBe(
      false,
    );
  });
});
