import { Psbt, Transaction, payments } from 'bitcoinjs-lib';

import { getBtcForkNetwork } from './networks';
import { decodedPsbt, getPsbtInputUtxo } from './providerUtils';

const psbtNetwork = getBtcForkNetwork('tbtc');
const script = payments.p2wpkh({ hash: Buffer.alloc(20, 1) }).output!;
const otherScript = payments.p2wpkh({ hash: Buffer.alloc(20, 2) }).output!;

function fixture(kind: 'witness' | 'nonWitness' | 'both' = 'both') {
  const parent = new Transaction();
  parent.addInput(Buffer.alloc(32, 3), 0);
  parent.addOutput(script, 100_000n);
  const psbt = new Psbt({ network: psbtNetwork });
  psbt.addInput({
    hash: parent.getHash(),
    index: 0,
    ...(kind !== 'witness' ? { nonWitnessUtxo: parent.toBuffer() } : {}),
    ...(kind !== 'nonWitness'
      ? { witnessUtxo: { script, value: 100_000n } }
      : {}),
  });
  psbt.addOutput({ script: otherScript, value: 99_000n });
  return { psbt, parent };
}

describe('PSBT fee decoding', () => {
  it.each(['witness', 'nonWitness', 'both'] as const)(
    'preserves the exact amount for %s UTXOs',
    (kind) => {
      const { psbt } = fixture(kind);
      const result = decodedPsbt({ psbt, psbtNetwork });
      expect(result.fee).toBe(1000);
      expect(result.inputInfos[0].value).toBe(100_000n);
      expect(result.inputInfos[0].address).not.toBe('');
    },
  );

  it.each(['value', 'script'] as const)(
    'rejects conflicting %s metadata after PSBT serialization',
    (field) => {
      const { psbt } = fixture('nonWitness');
      psbt.updateInput(0, {
        witnessUtxo: {
          script: field === 'script' ? otherScript : script,
          value: field === 'value' ? 99_100n : 100_000n,
        },
      });
      const parsed = Psbt.fromHex(psbt.toHex(), { network: psbtNetwork });
      expect(() => decodedPsbt({ psbt: parsed, psbtNetwork })).toThrow(
        'Conflicting UTXO records',
      );
    },
  );

  it.each(['hash', 'vout'] as const)(
    'rejects an incorrect parent %s',
    (field) => {
      const { parent } = fixture();
      const psbt = new Psbt({ network: psbtNetwork });
      psbt.addInput({
        hash: field === 'hash' ? Buffer.alloc(32, 4) : parent.getHash(),
        index: field === 'vout' ? 1 : 0,
        nonWitnessUtxo: parent.toBuffer(),
        witnessUtxo: { script, value: 100_000n },
      });
      psbt.addOutput({ script, value: 99_000n });
      expect(() => decodedPsbt({ psbt, psbtNetwork })).toThrow(
        field === 'hash' ? 'hash does not match' : 'has no output',
      );
    },
  );

  it('rejects a finalized foreign input without an amount instead of counting zero', () => {
    const { psbt } = fixture();
    psbt.addInput({
      hash: Buffer.alloc(32, 5),
      index: 0,
      finalScriptWitness: Uint8Array.from([0]),
    });
    expect(() => decodedPsbt({ psbt, psbtNetwork })).toThrow(
      'Missing UTXO for input #1',
    );
  });

  it('accepts a supplied zero-value UTXO', () => {
    const psbt = new Psbt({ network: psbtNetwork });
    psbt.addInput({
      hash: Buffer.alloc(32, 6),
      index: 0,
      witnessUtxo: { script, value: 0n },
    });
    psbt.addOutput({ script, value: 0n });
    expect(decodedPsbt({ psbt, psbtNetwork }).fee).toBe(0);
  });

  it('rejects an absent PSBT input', () => {
    const { psbt } = fixture();
    expect(() => getPsbtInputUtxo({ psbt, index: 1 })).toThrow(
      'Missing PSBT input #1',
    );
  });
});
