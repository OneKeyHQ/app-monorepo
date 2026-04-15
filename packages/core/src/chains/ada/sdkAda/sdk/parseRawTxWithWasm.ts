// Cardano tx body parsers backed by the official CardanoWasm library.
// Shared by adaWebSdk / OffscreenApiAdaSdk / WebEmbedApi so all three
// "hosts" (web, extension offscreen, native webembed) use the same Rust
// implementation instead of a hand-rolled CBOR decoder.

import type { IParsedRawTxBodyStakeInfo, IParsedRawTxInput } from './types';

type ICardanoWasm = typeof import('@emurgo/cardano-serialization-lib-asmjs');

let wasmPromise: Promise<ICardanoWasm> | null = null;
const getCardanoWasm = (): Promise<ICardanoWasm> => {
  if (!wasmPromise) {
    wasmPromise = import('@emurgo/cardano-serialization-lib-asmjs');
  }
  return wasmPromise;
};

export const parseRawTxInputsWithWasm = async (
  rawTxHex: string,
): Promise<IParsedRawTxInput[]> => {
  const Wasm = await getCardanoWasm();
  const tx = Wasm.Transaction.from_hex(rawTxHex);
  const inputs = tx.body().inputs();
  const out: IParsedRawTxInput[] = [];
  for (let i = 0; i < inputs.len(); i += 1) {
    const input = inputs.get(i);
    out.push({
      prev_hash: input.transaction_id().to_hex(),
      prev_index: input.index(),
    });
  }
  return out;
};

export const parseRawTxBodyStakeInfoWithWasm = async (
  rawTxHex: string,
): Promise<IParsedRawTxBodyStakeInfo> => {
  const Wasm = await getCardanoWasm();
  const tx = Wasm.Transaction.from_hex(rawTxHex);
  const body = tx.body();

  const certs = body.certs();
  const hasCertificates = !!certs && certs.len() > 0;

  const withdrawals = body.withdrawals();
  const hasWithdrawals = !!withdrawals && withdrawals.keys().len() > 0;

  const requiredSigners = body.required_signers();
  const requiredSignerHashes: string[] = [];
  if (requiredSigners) {
    for (let i = 0; i < requiredSigners.len(); i += 1) {
      requiredSignerHashes.push(requiredSigners.get(i).to_hex());
    }
  }

  return { hasCertificates, hasWithdrawals, requiredSignerHashes };
};

// Returns the hex stake key hash for key-credential base addresses (types 0
// and 1 in Cardano address layout); returns null for script-credential stakes
// or non-base addresses. Caller should treat null as "cannot safely filter
// stake witness".
export const extractStakeKeyHashFromBaseAddressWithWasm = async (
  addr: string,
): Promise<string | null> => {
  const Wasm = await getCardanoWasm();
  try {
    const address = Wasm.Address.from_bech32(addr);
    const baseAddress = Wasm.BaseAddress.from_address(address);
    if (!baseAddress) return null;
    const stakeCred = baseAddress.stake_cred();
    // Only key-credential stakes can be filtered via verification-key
    // witness. Script stakes are controlled by a script and we can't
    // compare against a single hash.
    if (stakeCred.kind() !== Wasm.CredKind.Key) return null;
    // spell-checker:disable-next-line
    const stakeKey = stakeCred.to_keyhash();
    if (!stakeKey) return null;
    return stakeKey.to_hex();
  } catch {
    return null;
  }
};
