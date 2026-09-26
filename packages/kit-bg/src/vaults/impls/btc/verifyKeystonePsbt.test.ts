import * as BitcoinJS from 'bitcoinjs-lib';
import { tapleafHash } from 'bitcoinjs-lib/src/payments/bip341';

import {
  getBitcoinECPair,
  initBitcoinEcc,
  tweakSigner,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';

import { verifyKeystonePsbt } from './verifyKeystonePsbt';

initBitcoinEcc();
const network = BitcoinJS.networks.bitcoin;
const signingKey = Buffer.from('01'.padStart(64, '0'), 'hex');
const signer = getBitcoinECPair().fromPrivateKey(signingKey);
const otherSigner = getBitcoinECPair().fromPrivateKey(
  Buffer.from('02'.padStart(64, '0'), 'hex'),
);
const xOnly = (key: Uint8Array) => key.slice(1, 33);
const tweakedSigner = tweakSigner(signingKey, Buffer.from(signer.publicKey));

type IKind =
  | 'legacy'
  | 'nested'
  | 'segwit'
  | 'taproot'
  | 'multisig'
  | 'scriptpath';

function buildRequest(kind: IKind = 'segwit') {
  const p2wpkh = BitcoinJS.payments.p2wpkh({
    pubkey: signer.publicKey,
    network,
  });
  const leaf = BitcoinJS.script.compile([
    xOnly(signer.publicKey),
    BitcoinJS.opcodes.OP_CHECKSIG,
  ]);
  let payment = p2wpkh;
  if (kind === 'legacy') {
    payment = BitcoinJS.payments.p2pkh({ pubkey: signer.publicKey, network });
  } else if (kind === 'nested') {
    payment = BitcoinJS.payments.p2sh({ redeem: p2wpkh, network });
  } else if (kind === 'taproot') {
    payment = BitcoinJS.payments.p2tr({
      internalPubkey: xOnly(signer.publicKey),
      network,
    });
  } else if (kind === 'multisig') {
    payment = BitcoinJS.payments.p2wsh({
      redeem: BitcoinJS.payments.p2ms({
        m: 2,
        pubkeys: [signer.publicKey, otherSigner.publicKey],
        network,
      }),
      network,
    });
  } else if (kind === 'scriptpath') {
    payment = BitcoinJS.payments.p2tr({
      internalPubkey: xOnly(otherSigner.publicKey),
      scriptTree: { output: leaf },
      redeem: { output: leaf, redeemVersion: 0xc0 },
      network,
    });
  }
  const prev = new BitcoinJS.Transaction();
  prev.addInput(Buffer.alloc(32, 1), 0);
  prev.addOutput(payment.output!, 20_000n);
  const unsignedPsbt = new BitcoinJS.Psbt({ network });
  unsignedPsbt.addInput({
    hash: prev.getId(),
    index: 0,
    ...(kind === 'legacy'
      ? { nonWitnessUtxo: prev.toBuffer() }
      : { witnessUtxo: { script: payment.output!, value: 20_000n } }),
    ...(kind === 'nested' ? { redeemScript: p2wpkh.output } : {}),
    ...(kind === 'multisig' ? { witnessScript: payment.redeem!.output } : {}),
    ...(kind === 'taproot' ? { tapInternalKey: xOnly(signer.publicKey) } : {}),
    ...(kind === 'scriptpath'
      ? {
          tapInternalKey: xOnly(otherSigner.publicKey),
          tapLeafScript: [
            {
              script: leaf,
              leafVersion: 0xc0,
              controlBlock: payment.witness![payment.witness!.length - 1],
            },
          ],
        }
      : {}),
  });
  unsignedPsbt.addOutput({ address: p2wpkh.address!, value: 19_000n });
  const inputsToSign = [
    {
      index: 0,
      address: payment.address!,
      publicKey: Buffer.from(signer.publicKey).toString('hex'),
    },
  ];
  return { unsignedPsbt, inputsToSign, network };
}

describe('verifyKeystonePsbt', () => {
  describe.each<IKind>(['legacy', 'nested', 'segwit', 'taproot', 'scriptpath'])(
    '%s',
    (kind) => {
      it.each([false, true])(
        'accepts valid signatures with finalized=%s',
        (finalized) => {
          const request = buildRequest(kind);
          const before = request.unsignedPsbt.toHex();
          const signedPsbt = request.unsignedPsbt
            .clone()
            .signInput(0, kind === 'taproot' ? tweakedSigner : signer);
          if (finalized) signedPsbt.finalizeAllInputs();
          const verified = verifyKeystonePsbt({ ...request, signedPsbt });
          expect(
            verified.finalizeAllInputs().extractTransaction().outs[0].value,
          ).toBe(19_000n);
          expect(request.unsignedPsbt.toHex()).toBe(before);
        },
      );

      it('requires the requested signature in the response even when already present in the request', () => {
        const request = buildRequest(kind);
        const responseWithoutSignature = request.unsignedPsbt.clone();
        request.unsignedPsbt.signInput(
          0,
          kind === 'taproot' ? tweakedSigner : signer,
        );
        expect(() =>
          verifyKeystonePsbt({
            ...request,
            signedPsbt: responseWithoutSignature,
          }),
        ).toThrow('Missing requested');
        expect(() =>
          verifyKeystonePsbt({
            ...request,
            signedPsbt: request.unsignedPsbt.clone(),
          }),
        ).not.toThrow();
      });

      it('rejects the original unsigned PSBT', () => {
        const request = buildRequest(kind);
        expect(() =>
          verifyKeystonePsbt({
            ...request,
            signedPsbt: request.unsignedPsbt.clone(),
          }),
        ).toThrow('Missing requested');
      });
    },
  );

  it.each<IKind>(['segwit', 'taproot'])(
    'rejects a corrupt %s signature',
    (kind) => {
      const request = buildRequest(kind);
      const signedPsbt = request.unsignedPsbt
        .clone()
        .signInput(0, kind === 'taproot' ? tweakedSigner : signer);
      const input = signedPsbt.data.inputs[0];
      const signature =
        kind === 'taproot' ? input.tapKeySig! : input.partialSig![0].signature;
      signature[10] ^= 1;
      expect(() => verifyKeystonePsbt({ ...request, signedPsbt })).toThrow(
        'signature',
      );
    },
  );

  it.each<IKind>(['segwit', 'taproot'])(
    'verifies %s against original UTXO values',
    (kind) => {
      const request = buildRequest(kind);
      const signedPsbt = request.unsignedPsbt.clone();
      signedPsbt.data.inputs[0].witnessUtxo!.value += 1n;
      signedPsbt.signInput(0, kind === 'taproot' ? tweakedSigner : signer);
      expect(() => verifyKeystonePsbt({ ...request, signedPsbt })).toThrow(
        'signature',
      );
    },
  );

  it('rejects a valid signature for a replaced UTXO script and another account', () => {
    const request = buildRequest();
    const signedPsbt = request.unsignedPsbt.clone();
    signedPsbt.data.inputs[0].witnessUtxo!.script = BitcoinJS.payments.p2wpkh({
      pubkey: otherSigner.publicKey,
    }).output!;
    signedPsbt.signInput(0, otherSigner);
    expect(() => verifyKeystonePsbt({ ...request, signedPsbt })).toThrow(
      'signature',
    );
  });

  it.each<IKind>(['segwit', 'taproot'])(
    'rejects an unrequested %s sighash mode',
    (kind) => {
      const request = buildRequest(kind);
      const signedPsbt = request.unsignedPsbt.clone();
      signedPsbt.updateInput(0, {
        sighashType: BitcoinJS.Transaction.SIGHASH_NONE,
      });
      signedPsbt.signInput(0, kind === 'taproot' ? tweakedSigner : signer, [
        BitcoinJS.Transaction.SIGHASH_NONE,
      ]);
      expect(() => verifyKeystonePsbt({ ...request, signedPsbt })).toThrow(
        'signature',
      );
    },
  );

  it('accepts an explicitly requested Taproot SIGHASH_ALL signature', () => {
    const request = buildRequest('taproot');
    request.unsignedPsbt.updateInput(0, {
      sighashType: BitcoinJS.Transaction.SIGHASH_ALL,
    });
    const signedPsbt = request.unsignedPsbt
      .clone()
      .signInput(0, tweakedSigner, [BitcoinJS.Transaction.SIGHASH_ALL]);
    const verified = verifyKeystonePsbt({ ...request, signedPsbt });
    expect(verified.data.inputs[0].tapKeySig).toHaveLength(65);
    expect(
      verified.finalizeAllInputs().extractTransaction().ins[0].witness,
    ).toHaveLength(1);
  });

  it('keeps a valid multisig contribution without requiring other signatures', () => {
    const request = buildRequest('multisig');
    const signedPsbt = request.unsignedPsbt.clone().signInput(0, signer);
    const verified = verifyKeystonePsbt({ ...request, signedPsbt });
    expect(verified.data.inputs[0].partialSig).toHaveLength(1);
    expect(() => verified.finalizeAllInputs()).toThrow();
  });

  it.each<IKind>(['multisig', 'scriptpath'])(
    'accepts %s when the request carries the signer account address',
    (kind) => {
      const request = buildRequest(kind);
      request.inputsToSign[0].address = BitcoinJS.payments.p2wpkh({
        pubkey: signer.publicKey,
        network,
      }).address!;
      const signedPsbt = request.unsignedPsbt.clone().signInput(0, signer);
      expect(() =>
        verifyKeystonePsbt({ ...request, signedPsbt }),
      ).not.toThrow();
      request.inputsToSign[0].publicKey = Buffer.from(
        otherSigner.publicKey,
      ).toString('hex');
      expect(() => verifyKeystonePsbt({ ...request, signedPsbt })).toThrow(
        'Missing requested',
      );
    },
  );

  it('rejects a multisig contribution only from another signer', () => {
    const request = buildRequest('multisig');
    const signedPsbt = request.unsignedPsbt.clone().signInput(0, otherSigner);
    expect(() => verifyKeystonePsbt({ ...request, signedPsbt })).toThrow(
      'Missing requested',
    );
  });

  it('accepts finalized multisig signatures and verifies all of them', () => {
    const request = buildRequest('multisig');
    const signedPsbt = request.unsignedPsbt
      .clone()
      .signInput(0, signer)
      .signInput(0, otherSigner)
      .finalizeAllInputs();
    const verified = verifyKeystonePsbt({ ...request, signedPsbt });
    expect(verified.data.inputs[0].partialSig).toHaveLength(2);
    expect(
      verified.finalizeAllInputs().extractTransaction().ins[0].witness,
    ).toHaveLength(4);
  });

  it('matches a Taproot script signature to its exact leaf', () => {
    const request = buildRequest('scriptpath');
    const signedPsbt = request.unsignedPsbt.clone().signInput(0, signer);
    const entry = signedPsbt.data.inputs[0].tapScriptSig![0];
    entry.leafHash = tapleafHash({
      output: BitcoinJS.script.compile([BitcoinJS.opcodes.OP_TRUE]),
      version: 0xc0,
    });
    expect(() => verifyKeystonePsbt({ ...request, signedPsbt })).toThrow(
      'script signature',
    );
  });

  it('does not let a pre-existing invalid cosigner signature reach finalization', () => {
    const request = buildRequest('multisig');
    request.unsignedPsbt.signInput(0, otherSigner);
    request.unsignedPsbt.data.inputs[0].partialSig![0].signature[10] ^= 1;
    const signedPsbt = request.unsignedPsbt.clone().signInput(0, signer);
    expect(() => verifyKeystonePsbt({ ...request, signedPsbt })).toThrow(
      'signature',
    );
  });

  it('verifies the specified leaf when the same public key appears in multiple Taproot leaves', () => {
    const request = buildRequest('scriptpath');
    const firstScript =
      request.unsignedPsbt.data.inputs[0].tapLeafScript![0].script;
    const secondScript = BitcoinJS.script.compile([
      BitcoinJS.opcodes.OP_TRUE,
      BitcoinJS.opcodes.OP_DROP,
      xOnly(signer.publicKey),
      BitcoinJS.opcodes.OP_CHECKSIG,
    ]);
    const paymentFor = (output: Uint8Array) =>
      BitcoinJS.payments.p2tr({
        internalPubkey: xOnly(otherSigner.publicKey),
        scriptTree: [{ output: firstScript }, { output: secondScript }],
        redeem: { output, redeemVersion: 0xc0 },
        network,
      });
    const firstPayment = paymentFor(firstScript);
    const secondPayment = paymentFor(secondScript);
    request.unsignedPsbt.data.inputs[0].witnessUtxo!.script =
      firstPayment.output!;
    request.unsignedPsbt.data.inputs[0].tapLeafScript = [
      firstPayment,
      secondPayment,
    ].map((payment) => ({
      script: payment.redeem!.output!,
      leafVersion: 0xc0,
      controlBlock: payment.witness![payment.witness!.length - 1],
    }));
    request.inputsToSign[0].address = firstPayment.address!;
    const leafHash = tapleafHash({ output: secondScript, version: 0xc0 });
    const signedPsbt = request.unsignedPsbt
      .clone()
      .signTaprootInput(0, signer, leafHash);
    const verified = verifyKeystonePsbt({ ...request, signedPsbt });
    expect(verified.data.inputs[0].tapScriptSig![0].leafHash).toEqual(leafHash);
    signedPsbt.data.inputs[0].tapScriptSig![0].leafHash = tapleafHash({
      output: firstScript,
      version: 0xc0,
    });
    expect(() => verifyKeystonePsbt({ ...request, signedPsbt })).toThrow(
      'script signature',
    );
  });

  it('rejects trailing bytes in a final witness', () => {
    const request = buildRequest('taproot');
    const signedPsbt = request.unsignedPsbt
      .clone()
      .signInput(0, tweakedSigner)
      .finalizeAllInputs();
    signedPsbt.data.inputs[0].finalScriptWitness = Buffer.concat([
      signedPsbt.data.inputs[0].finalScriptWitness!,
      Buffer.from([0]),
    ]);
    expect(() => verifyKeystonePsbt({ ...request, signedPsbt })).toThrow(
      'final witness',
    );
  });
});
