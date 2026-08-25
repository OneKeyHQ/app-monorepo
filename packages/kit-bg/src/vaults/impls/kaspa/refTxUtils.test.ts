import type { IKaspaBlockTransaction } from '@onekeyhq/core/src/chains/kaspa/sdkKaspa/types';

import { buildKaspaRefTx } from './refTxUtils';

const networkId = 'kaspa--kaspa';
const txId = '9bf74f7f5f5b5b3e3b5d3c27769897e3aa907cff29045b5049df2ed294791231';
const prevTxId =
  '1ad23c4b34354be1dbc0e8f4a0a2f0f3b0c5b6a7d8e9f0112233445566778899';
const script =
  '2008e329d016e63871fbb8ea9a2fbe0aa4dcd6e0a1f6e9c9d5b2a3948576e1f2ac';

function blockTx(
  overrides: Partial<IKaspaBlockTransaction> = {},
): IKaspaBlockTransaction {
  return {
    version: 0,
    subnetworkId: '0000000000000000000000000000000000000000',
    lockTime: 0,
    gas: 0,
    payload: '',
    verboseData: { transactionId: txId },
    inputs: [
      {
        previousOutpoint: { transactionId: prevTxId, index: 1 },
        signatureScript: '41aa',
        sigOpCount: 1,
        sequence: 0,
        computeBudget: 0,
      },
    ],
    outputs: [
      {
        amount: 3_035_044_000_000,
        scriptPublicKey: { scriptPublicKey: script, version: 0 },
      },
    ],
    ...overrides,
  };
}

describe('buildKaspaRefTx', () => {
  it('maps every field the device recomputes the txid from', () => {
    const r = buildKaspaRefTx({ tx: blockTx(), networkId });
    expect(r).toEqual({
      txId,
      version: 0,
      inputs: [{ prevTxId, outputIndex: 1, sequenceNumber: '0' }],
      outputs: [{ satoshis: '3035044000000', script, scriptVersion: 0 }],
      lockTime: '0',
      subNetworkID: '0000000000000000000000000000000000000000',
      gas: '0',
      payload: '',
    });
  });

  // The proxy nulls numeric fields whose value is 0, so these must read as 0
  // rather than abort every signature that streams a refTx.
  it('reads a nulled sequence, lockTime, gas and script version as 0', () => {
    const tx = blockTx({ lockTime: null, gas: null });
    tx.inputs![0].sequence = null;
    tx.outputs[0].scriptPublicKey.version = undefined;
    const r = buildKaspaRefTx({ tx, networkId });
    expect(r.inputs[0].sequenceNumber).toBe('0');
    expect(r.lockTime).toBe('0');
    expect(r.gas).toBe('0');
    expect(r.outputs[0].scriptVersion).toBe(0);
  });

  // An empty amount is far more likely to be a value that could not be
  // represented than a genuine zero, so it must not be defaulted.
  it('rejects a missing output amount instead of defaulting it', () => {
    const tx = blockTx();
    // @ts-expect-error exercising a malformed upstream response
    tx.outputs[0].amount = null;
    expect(() => buildKaspaRefTx({ tx, networkId })).toThrow(
      /output\.amount missing/,
    );
  });

  it('rejects values already rounded by the JSON parse', () => {
    const amountTx = blockTx();
    amountTx.outputs[0].amount = Number.MAX_SAFE_INTEGER + 2;
    expect(() => buildKaspaRefTx({ tx: amountTx, networkId })).toThrow(
      /is not a uint64 we can trust/,
    );

    // A 2^64-1 sequence reaches us as 2^64: the nearest double, which is what
    // the parse rounded it to.
    const seqTx = blockTx();
    seqTx.inputs![0].sequence = 2 ** 64;
    expect(() => buildKaspaRefTx({ tx: seqTx, networkId })).toThrow(
      /input\.sequence .* is not a uint64 we can trust/,
    );
  });

  it('keeps a lossless uint64 string the parse never touched', () => {
    // A number past 2^53 was already rounded; a string was not, so it is read as sent.
    const tx = blockTx();
    tx.outputs[0].amount = '18446744073709551615';
    expect(buildKaspaRefTx({ tx, networkId }).outputs[0].satoshis).toBe(
      '18446744073709551615',
    );
  });

  it('rejects a string past the uint64 range', () => {
    const tx = blockTx();
    tx.outputs[0].amount = '18446744073709551616';
    expect(() => buildKaspaRefTx({ tx, networkId })).toThrow(
      /is not a uint64 we can trust/,
    );
  });

  it('rejects a negative value', () => {
    const tx = blockTx();
    tx.outputs[0].amount = -1;
    expect(() => buildKaspaRefTx({ tx, networkId })).toThrow(
      /is not a uint64 we can trust/,
    );
  });

  it('rejects a non-numeric value', () => {
    const tx = blockTx({ lockTime: 'not-a-number' });
    expect(() => buildKaspaRefTx({ tx, networkId })).toThrow(
      /is not a uint64 we can trust/,
    );
  });

  it('rejects a prev tx whose input carries a non-default sigOpCount', () => {
    // The refTx stream cannot carry sigOpCount, so the device would recompute a
    // different id and refuse to sign, with no fallback left at that point.
    const tx = blockTx();
    tx.inputs![0].sigOpCount = 3;
    expect(() => buildKaspaRefTx({ tx, networkId })).toThrow(
      /unsupported sigOpCount/,
    );
  });

  it('accepts the default sigOpCount, whether it is sent or omitted', () => {
    const sent = blockTx();
    sent.inputs![0].sigOpCount = 1;
    expect(() => buildKaspaRefTx({ tx: sent, networkId })).not.toThrow();

    const omitted = blockTx();
    delete omitted.inputs![0].sigOpCount;
    expect(() => buildKaspaRefTx({ tx: omitted, networkId })).not.toThrow();
  });

  it('accepts a coinbase prev tx, which has no inputs', () => {
    const r = buildKaspaRefTx({ tx: blockTx({ inputs: null }), networkId });
    expect(r.inputs).toEqual([]);
    expect(r.outputs).toHaveLength(1);
  });

  it('rejects a tx with no outputs, which could only hash wrong', () => {
    expect(() =>
      buildKaspaRefTx({ tx: blockTx({ outputs: [] }), networkId }),
    ).toThrow(/no outputs/);
  });

  it('rejects a tx the block response gave no id for', () => {
    expect(() =>
      buildKaspaRefTx({ tx: blockTx({ verboseData: {} }), networkId }),
    ).toThrow(/no txId/);
  });

  it('keeps a non-zero sequence, gas, lockTime and script version', () => {
    const tx = blockTx({ lockTime: 12_345, gas: 678 });
    tx.inputs![0].sequence = 42;
    tx.outputs[0].scriptPublicKey.version = 1;
    const r = buildKaspaRefTx({ tx, networkId });
    expect(r.inputs[0].sequenceNumber).toBe('42');
    expect(r.lockTime).toBe('12345');
    expect(r.gas).toBe('678');
    expect(r.outputs[0].scriptVersion).toBe(1);
  });

  it('carries the payload and subnetwork id of a v1 tx untouched', () => {
    const tx = blockTx({
      version: 1,
      subnetworkId: '97b1000000000000000000000000000000000000',
      payload: '95789c',
    });
    const r = buildKaspaRefTx({ tx, networkId });
    expect(r.version).toBe(1);
    expect(r.subNetworkID).toBe('97b1000000000000000000000000000000000000');
    expect(r.payload).toBe('95789c');
  });
});
