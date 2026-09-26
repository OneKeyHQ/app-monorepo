import { UR } from '@ngraveio/bc-ur';

import { AirGapTronSDK } from './AirGapTronSDK';

describe('AirGapTronSDK', () => {
  it('parses a legacy signature-only response without requiring a transaction ID', () => {
    const signature = 'ab'.repeat(65);
    // CBOR map: UUID-tagged request ID at key 1, signature bytes at key 2.
    const cbor = Buffer.from(
      `a201d8255000000000000040008000000000000000025841${signature}`,
      'hex',
    );

    expect(
      new AirGapTronSDK().parseSignature(new UR(cbor, 'tron-signature')),
    ).toEqual({
      requestId: '00000000-0000-4000-8000-000000000000',
      signature,
      raw: '',
      txId: '',
    });
  });
});
