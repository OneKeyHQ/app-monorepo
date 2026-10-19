import * as BitcoinJS from 'bitcoinjs-lib';
import { BufferReader } from 'bitcoinjs-lib/src/bufferutils';
import { tapleafHash } from 'bitcoinjs-lib/src/payments/bip341';

import {
  isTaprootInput,
  toXOnly,
} from '@onekeyhq/core/src/chains/btc/sdkBtc/bip371';
import { ecc } from '@onekeyhq/core/src/secret';
import type { ITxInputToSign } from '@onekeyhq/core/src/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { PsbtInput } from 'bip174';

const equalBytes = (a: Uint8Array, b: Uint8Array) =>
  Buffer.from(a).equals(Buffer.from(b));

function readWitness(input: PsbtInput): Uint8Array[] {
  if (!input.finalScriptWitness) return [];
  const reader = new BufferReader(input.finalScriptWitness);
  const witness = reader.readVector();
  if (reader.offset !== input.finalScriptWitness.length) {
    throw new OneKeyLocalError('Invalid BTC final witness');
  }
  return witness;
}

function scriptPublicKeys(script?: Uint8Array): Uint8Array[] {
  return (script ? (BitcoinJS.script.decompile(script) ?? []) : []).filter(
    (chunk): chunk is Uint8Array =>
      chunk instanceof Uint8Array && [32, 33, 65].includes(chunk.length),
  );
}

// Verify against the original UTXOs/scripts, never device-supplied replacements.
// Only verified signature fields are copied into the original PSBT.
export function verifyKeystonePsbt({
  unsignedPsbt,
  signedPsbt,
  inputsToSign,
  network,
}: {
  unsignedPsbt: BitcoinJS.Psbt;
  signedPsbt: BitcoinJS.Psbt;
  inputsToSign: ITxInputToSign[];
  network: BitcoinJS.Network;
}): BitcoinJS.Psbt {
  if (!inputsToSign.length)
    throw new OneKeyLocalError('No BTC inputs requested for signing');
  const verified = unsignedPsbt.clone();
  const validation = unsignedPsbt.clone();
  for (const requested of inputsToSign) {
    const { index } = requested;
    const original = unsignedPsbt.data.inputs[index];
    const returned = signedPsbt.data.inputs[index];
    if (!Number.isSafeInteger(index) || !original || !returned) {
      throw new OneKeyLocalError('Invalid BTC signing input index');
    }
    const pubkey = Buffer.from(requested.publicKey, 'hex');
    const taproot = isTaprootInput(original);
    const allowedHashTypes = requested.sighashTypes?.length
      ? requested.sighashTypes
      : [
          original.sighashType ??
            (taproot
              ? BitcoinJS.Transaction.SIGHASH_DEFAULT
              : BitcoinJS.Transaction.SIGHASH_ALL),
        ];
    const prevout =
      original.witnessUtxo ??
      (original.nonWitnessUtxo
        ? BitcoinJS.Transaction.fromBuffer(original.nonWitnessUtxo).outs[
            unsignedPsbt.txInputs[index].index
          ]
        : undefined);
    if (!prevout) throw new OneKeyLocalError('Missing BTC signing input UTXO');
    const validate = (patch: Partial<PsbtInput>, key?: Uint8Array): boolean => {
      validation.data.inputs[index] = {
        ...original,
        partialSig: undefined,
        tapKeySig: undefined,
        tapScriptSig: undefined,
        ...patch,
      };
      try {
        return validation.validateSignaturesOfInput(
          index,
          (keyToVerify, digest, signature) =>
            keyToVerify.length === 32
              ? ecc.verifySchnorr(digest, keyToVerify, signature)
              : ecc.verify(digest, keyToVerify, signature),
          key,
        );
      } catch {
        return false;
      }
    };
    const witness = readWitness(returned);
    let hasRequestedSignature = false;
    if (taproot) {
      const hashTypeFor = (signature: Uint8Array) =>
        signature.length === 64
          ? BitcoinJS.Transaction.SIGHASH_DEFAULT
          : signature[64];
      const validHashType = (signature: Uint8Array) =>
        (signature.length === 64 ||
          (signature.length === 65 && signature[64] !== 0)) &&
        allowedHashTypes.includes(hashTypeFor(signature));
      const keySignature =
        returned.tapKeySig ?? (witness.length === 1 ? witness[0] : undefined);
      if (keySignature) {
        // Script-path/multisig requests may carry the signer's account address.
        // Only key-path spending identifies the output by that address directly.
        if (
          !equalBytes(
            prevout.script,
            BitcoinJS.address.toOutputScript(requested.address, network),
          )
        ) {
          throw new OneKeyLocalError('BTC signing input address mismatch');
        }
        if (
          original.tapInternalKey &&
          !equalBytes(original.tapInternalKey, toXOnly(pubkey))
        ) {
          throw new OneKeyLocalError('BTC Taproot signing key mismatch');
        }
        if (
          !validHashType(keySignature) ||
          !validate({
            tapKeySig: keySignature,
            sighashType: hashTypeFor(keySignature),
          })
        ) {
          throw new OneKeyLocalError('Invalid BTC Taproot key signature');
        }
        verified.data.inputs[index].tapKeySig = keySignature;
        hasRequestedSignature = true;
      }
      const scriptSignatures = [...(returned.tapScriptSig ?? [])];
      const validateScriptSignature = (
        entry: NonNullable<PsbtInput['tapScriptSig']>[number],
      ) => {
        const leaves = original.tapLeafScript?.filter((leaf) =>
          equalBytes(
            tapleafHash({ output: leaf.script, version: leaf.leafVersion }),
            entry.leafHash,
          ),
        );
        return Boolean(
          leaves?.length &&
          validHashType(entry.signature) &&
          validate(
            {
              tapScriptSig: [entry],
              tapLeafScript: leaves,
              sighashType: hashTypeFor(entry.signature),
            },
            entry.pubkey,
          ),
        );
      };
      if (witness.length > 1) {
        const leaf = original.tapLeafScript?.find(
          (value) =>
            equalBytes(value.script, witness[witness.length - 2]) &&
            equalBytes(value.controlBlock, witness[witness.length - 1]),
        );
        if (!leaf)
          throw new OneKeyLocalError('Unexpected BTC Taproot signing script');
        const leafHash = tapleafHash({
          output: leaf.script,
          version: leaf.leafVersion,
        });
        for (const signature of witness.slice(0, -2)) {
          for (const key of scriptPublicKeys(leaf.script)) {
            const entry = { pubkey: key, signature, leafHash };
            if (validateScriptSignature(entry)) scriptSignatures.push(entry);
          }
        }
      }
      const signaturesByKey = new Map(
        (original.tapScriptSig ?? []).map((entry) => [
          `${Buffer.from(entry.pubkey).toString('hex')}:${Buffer.from(entry.leafHash).toString('hex')}`,
          entry,
        ]),
      );
      for (const entry of [
        ...(original.tapScriptSig ?? []),
        ...scriptSignatures,
      ]) {
        if (!validateScriptSignature(entry))
          throw new OneKeyLocalError('Invalid BTC Taproot script signature');
        signaturesByKey.set(
          `${Buffer.from(entry.pubkey).toString('hex')}:${Buffer.from(entry.leafHash).toString('hex')}`,
          entry,
        );
        hasRequestedSignature ||=
          scriptSignatures.includes(entry) &&
          equalBytes(entry.pubkey, toXOnly(pubkey));
      }
      if (signaturesByKey.size)
        verified.data.inputs[index].tapScriptSig = Array.from(
          signaturesByKey.values(),
        );
    } else {
      const signatures = [...(returned.partialSig ?? [])];
      const validatePartial = (
        entry: NonNullable<PsbtInput['partialSig']>[number],
      ) => {
        try {
          return (
            allowedHashTypes.includes(
              BitcoinJS.script.signature.decode(entry.signature).hashType,
            ) && validate({ partialSig: [entry] }, entry.pubkey)
          );
        } catch {
          return false;
        }
      };
      const stack = witness.length
        ? witness
        : (BitcoinJS.script.decompile(
            returned.finalScriptSig ?? new Uint8Array(),
          ) ?? []);
      const keys = [
        pubkey,
        ...scriptPublicKeys(original.witnessScript),
        ...scriptPublicKeys(original.redeemScript),
      ];
      for (const signature of stack) {
        if (
          signature instanceof Uint8Array &&
          BitcoinJS.script.isCanonicalScriptSignature(signature)
        ) {
          for (const key of keys) {
            const entry = { pubkey: key, signature };
            if (validatePartial(entry)) signatures.push(entry);
          }
        }
      }
      const signaturesByKey = new Map(
        (original.partialSig ?? []).map((entry) => [
          Buffer.from(entry.pubkey).toString('hex'),
          entry,
        ]),
      );
      for (const entry of [...(original.partialSig ?? []), ...signatures]) {
        if (!validatePartial(entry))
          throw new OneKeyLocalError('Invalid BTC input signature');
        signaturesByKey.set(Buffer.from(entry.pubkey).toString('hex'), entry);
        hasRequestedSignature ||=
          signatures.includes(entry) && equalBytes(entry.pubkey, pubkey);
      }
      if (signaturesByKey.size)
        verified.data.inputs[index].partialSig = Array.from(
          signaturesByKey.values(),
        );
    }
    if (!hasRequestedSignature)
      throw new OneKeyLocalError('Missing requested BTC signature');
  }
  return verified;
}
