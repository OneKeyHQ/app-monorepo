import { createRequire } from 'module';

import { BIP322 } from 'bip322-js';

import { verifyBitcoinMessage } from './signMessage';

const message = 'fee-fix compatibility fixture';
// Fixed signatures and virtual transactions produced with bip322-js 3.0.0
// and bitcoinjs-lib 6.1.7 using a synthetic key, before the dependency upgrade.
const fixtures = [
  {
    type: 'p2wpkh',
    address: 'bc1q0xcqpzrky6eff2g52qdye53xkk9jxkvrh6yhyw',
    testnetAddress: 'tb1q0xcqpzrky6eff2g52qdye53xkk9jxkvraulyla',
    signature:
      'AkcwRAIgUFykk0Swe01G60PdJpVA+/D5lR/TuWnKq1+TThmKP/QCIBAPKY3t9cp3VCHOMJeSa49KLtHmUfRPnufDhAItogJXASEDG4TFVnsSZECZXT7VqroFZdceGDRgSBn/nBf16dXdB48=',
    script: '001479b000887626b294a914501a4cd226b58b235983',
    virtualHex:
      '00000000010000000000000000000000000000000000000000000000000000000000000000ffffffff22002021ade7cf6b3f35caf490b0b6136596815982aa923884415bd7dc85eafce2c75d0000000001000000000000000016001479b000887626b294a914501a4cd226b58b23598300000000',
  },
  {
    type: 'p2sh-p2wpkh',
    address: '35LM1A29K95ADiQ8rJ9uEfVZCKffZE4D9i',
    testnetAddress: '2MvtZ4txAvbaWRW2gXRmmrcUpQfsqNgpfUm',
    signature:
      'AkgwRQIhAMxfbVR8E1XA/HnL545OWS6I7LEvAQEWA9miRBfXvpjpAiBaJgEYyzAx0lzFCDOYliBGC78tElWb7Tqu7/HZEdlmOQEhAxuExVZ7EmRAmV0+1aq6BWXXHhg0YEgZ/5wX9enV3QeP',
    script: 'a91427f7b1d97b04ec10e77d4b1527dbb8c9f92c54b587',
    virtualHex:
      '00000000010000000000000000000000000000000000000000000000000000000000000000ffffffff22002021ade7cf6b3f35caf490b0b6136596815982aa923884415bd7dc85eafce2c75d0000000001000000000000000017a91427f7b1d97b04ec10e77d4b1527dbb8c9f92c54b58700000000',
  },
  {
    type: 'p2tr',
    address: 'bc1p33wm0auhr9kkahzd6l0kqj85af4cswn276hsxg6zpz85xe2r0y8syx4e5t',
    testnetAddress:
      'tb1p33wm0auhr9kkahzd6l0kqj85af4cswn276hsxg6zpz85xe2r0y8snwrkwy',
    signature:
      'AUGtWPFcuavnnSLLtPmkjnBEI+YZPMfBOvXDlqmcMP5wodL8iuJAcZw9tLV8+vwKpdvMquLaXj4qFAyYKNxL1I4ZAQ==',
    script:
      '51208c5db7f797196d6edc4dd7df6048f4ea6b883a6af6af032342088f436543790f',
    virtualHex:
      '00000000010000000000000000000000000000000000000000000000000000000000000000ffffffff22002021ade7cf6b3f35caf490b0b6136596815982aa923884415bd7dc85eafce2c75d000000000100000000000000002251208c5db7f797196d6edc4dd7df6048f4ea6b883a6af6af032342088f436543790f00000000',
  },
];

describe.each(fixtures)('BIP322 $type compatibility', (fixture) => {
  it.each(['address', 'testnetAddress'] as const)(
    'verifies an existing signature on %s',
    (addressKey) => {
      const args = {
        message,
        address: fixture[addressKey],
        signature: fixture.signature,
        format: 'bip322',
      };
      expect(verifyBitcoinMessage(args)).toBe(true);
      expect(verifyBitcoinMessage({ ...args, message: `${message}!` })).toBe(
        false,
      );
      expect(verifyBitcoinMessage({ ...args, signature: 'AAAA' })).toBe(false);
    },
  );

  it('preserves the virtual transaction bytes', () => {
    expect(
      BIP322.buildToSpendTx(
        message,
        Buffer.from(fixture.script, 'hex'),
      ).toHex(),
    ).toBe(fixture.virtualHex);
  });
});

it('preserves legacy Bitcoin message verification', () => {
  expect(
    verifyBitcoinMessage({
      message,
      address: '1C6Rc3w25VHud3dLDamutaqfKWqhrLRTaD',
      signature:
        'IHaol3VW/8CDcW5dz/rft4zUBN51PYP6Ot9MwOOX52KASCWKxgl79g/dbQDW31llHKfKGD8q0qK+gmgqEhyWrMY=',
      format: 'ecdsa',
    }),
  ).toBe(true);
});

describe('the original bitcoinjs-lib resolved by BIP322', () => {
  const dependencyRequire = createRequire(require.resolve('bip322-js'));
  const { Psbt, Transaction } = dependencyRequire('bitcoinjs-lib') as {
    Psbt: new () => ReturnType<typeof BIP322.buildToSignTx>;
    Transaction: new () => ReturnType<typeof BIP322.buildToSpendTx>;
  };

  it('uses the patched 6.x package independently of the OneKey alias', () => {
    const manifest = dependencyRequire('bitcoinjs-lib/package.json') as {
      name: string;
      version: string;
    };
    expect(manifest).toMatchObject({
      name: 'bitcoinjs-lib',
      version: '6.1.10',
    });
  });

  it('rejects inconsistent UTXO amounts during fee accounting and extraction', () => {
    const script = Buffer.from(fixtures[0].script, 'hex');
    const parent = new Transaction();
    parent.addInput(Buffer.alloc(32, 3), 0);
    parent.addOutput(script, 100_000);
    const psbt = new Psbt()
      .addInput({
        hash: parent.getHash(),
        index: 0,
        nonWitnessUtxo: parent.toBuffer(),
        witnessUtxo: { script, value: 99_100 },
        finalScriptWitness: Buffer.from([0]),
      })
      .addOutput({ script, value: 99_000 });
    expect(() => psbt.getFee()).toThrow(/Witness UTXO/);
    expect(() => psbt.getFeeRate()).toThrow(/Witness UTXO/);
    expect(() => psbt.extractTransaction()).toThrow(/Witness UTXO/);
  });

  it('rejects a finalized input without UTXO metadata', () => {
    const psbt = new Psbt()
      .addInput({
        hash: Buffer.alloc(32, 4),
        index: 0,
        finalScriptWitness: Buffer.from([0]),
      })
      .addOutput({ script: Buffer.from(fixtures[0].script, 'hex'), value: 0 });
    expect(() => psbt.getFee()).toThrow(/Need a Utxo/);
    expect(() => psbt.getFeeRate()).toThrow(/Need a Utxo/);
    expect(() => psbt.extractTransaction()).toThrow(/Need a Utxo/);
  });
});
