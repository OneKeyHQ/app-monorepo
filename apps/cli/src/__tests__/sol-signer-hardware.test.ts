import { decodeEd25519Signature } from '../signer/impls/sol/SignerHardware';

// Ed25519 signatures from the firmware MUST be 64 bytes. A malformed hex
// string would otherwise be silently truncated by Buffer.from(_, 'hex') and
// only surface later as a cryptic web3.js error inside addSignature() or as
// a (potentially regex-passing) bogus txid. These tests pin the fail-closed
// behavior introduced after a review found the original code missing this
// check.
describe('decodeEd25519Signature', () => {
  const valid64ByteHex = 'aa'.repeat(64);

  it('returns a 64-byte Buffer for valid hex', () => {
    const bytes = decodeEd25519Signature(valid64ByteHex, 'signTransaction');
    expect(bytes.length).toBe(64);
    expect(bytes.every((b) => b === 0xaa)).toBe(true);
  });

  it('rejects empty / undefined signatures', () => {
    expect(() => decodeEd25519Signature(undefined, 'signTransaction')).toThrow(
      /empty signature for SOL signTransaction/,
    );
    expect(() => decodeEd25519Signature('', 'signMessage')).toThrow(
      /empty signature for SOL signMessage/,
    );
  });

  it('rejects too-short hex (would otherwise silently produce a short Buffer)', () => {
    expect(() =>
      decodeEd25519Signature('aa'.repeat(32), 'signTransaction'),
    ).toThrow(/32 bytes \(expected 64\)/);
  });

  it('rejects too-long hex', () => {
    expect(() =>
      decodeEd25519Signature('aa'.repeat(65), 'signTransaction'),
    ).toThrow(/65 bytes \(expected 64\)/);
  });

  it('rejects malformed hex (odd length truncated by Buffer.from)', () => {
    // Buffer.from('a', 'hex') silently returns an empty buffer. Make sure
    // the byte-length guard catches this before the signature reaches
    // web3.js or gets base58-encoded as a fake txid.
    expect(() =>
      decodeEd25519Signature('a'.repeat(127), 'signTransaction'),
    ).toThrow(/expected 64/);
  });
});
