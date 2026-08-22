import { assertLedgerAttestationRelayUrl } from './ledgerAttestationRelayUrl';

describe('assertLedgerAttestationRelayUrl', () => {
  const rebateEndpoint = 'https://rebate.onekeycn.com';
  const token = 'opaque_single_use_token_1234567890';

  it('allows the environment-matched OneKey attestation endpoint', () => {
    expect(() =>
      assertLedgerAttestationRelayUrl({
        rebateEndpoint,
        relayUrl: `wss://attestation.onekeycn.com/v1/ledger/session/${token}`,
      }),
    ).not.toThrow();
  });

  it('allows an exact 24-byte base64url token', () => {
    expect(() =>
      assertLedgerAttestationRelayUrl({
        rebateEndpoint,
        relayUrl:
          'wss://attestation.onekeycn.com/v1/ledger/session/KdEX9mwqG_JcfrbqZna-s7ClljYcQG64',
      }),
    ).not.toThrow();
  });

  it.each([
    `wss://evil.example/v1/ledger/session/${token}`,
    `ws://attestation.onekeycn.com/v1/ledger/session/${token}`,
    `wss://attestation.onekeycn.com/other/${token}`,
    `wss://attestation.onekeycn.com/v1/ledger/session/${token}/`,
    `wss://attestation.onekeycn.com/v1/ledger/session/${token}/genuine`,
    `wss://attestation.onekeycn.com/v1/ledger/session/${token}?copy=1`,
    `wss://attestation.onekeycn.com/v1/ledger/session/${'a'.repeat(31)}`,
  ])('rejects an untrusted or malformed relay URL: %s', (relayUrl) => {
    expect(() =>
      assertLedgerAttestationRelayUrl({ rebateEndpoint, relayUrl }),
    ).toThrow('Ledger attestation relay is not allowed');
  });
});
