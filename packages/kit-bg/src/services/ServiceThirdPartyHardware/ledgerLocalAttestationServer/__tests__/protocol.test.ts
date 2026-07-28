import {
  MAX_LEDGER_RELAY_APDU_BYTES,
  parseLedgerRelayClientMessage,
} from '../protocol';

describe('Ledger attestation relay protocol', () => {
  it('rejects oversized APDU responses before allocating relay state', () => {
    expect(() =>
      parseLedgerRelayClientMessage(
        JSON.stringify({
          type: 'apdu-response',
          requestId: 'request-1',
          dataHex: 'aa'.repeat(MAX_LEDGER_RELAY_APDU_BYTES + 1),
          statusCodeHex: '9000',
        }),
      ),
    ).toThrow('too large');
  });

  it('rejects malformed status words and unknown messages', () => {
    expect(() =>
      parseLedgerRelayClientMessage(
        JSON.stringify({
          type: 'apdu-response',
          requestId: 'request-1',
          dataHex: '',
          statusCodeHex: '90',
        }),
      ),
    ).toThrow('statusCodeHex');
    expect(() =>
      parseLedgerRelayClientMessage('{"type":"verified","verified":true}'),
    ).toThrow('Unsupported');
  });
});
