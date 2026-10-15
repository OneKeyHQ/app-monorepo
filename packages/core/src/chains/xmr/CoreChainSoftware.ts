import { NotImplemented, OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import { deriveXmrAccount } from './sdkXmrRuntime/address';
import {
  deriveXmrSpendPrivateKey,
  signXmrTransaction,
} from './sdkXmrRuntime/sign';
import { getXmrReviewRequest, parseXmrTransaction } from './transactionReview';
import { serializeXmrViewingKeyPair } from './viewingKeys';

import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressQueryImported,
  ICoreApiGetAddressesQueryHd,
  ICoreApiGetAddressesResult,
  ICoreApiGetExportedSecretKey,
  ICoreApiPrivateKeysMap,
  ICoreApiSignBasePayload,
  ICoreApiSignTxPayload,
  ICurveName,
  ISignedTxPro,
} from '../../types';

// Two derivations from one BIP-39 seed, picked by the account's path:
// - Trezor (and OneKey Pro firmware, default): SLIP-10 ed25519 at m/44'/128'/a'.
// - Cake Wallet: secp256k1 BIP-32 at m/44'/128'/a'/0/0.
// Both then take the 32-byte key mod l as the spend key; neither hashes it.
// ed25519 cannot derive a non-hardened segment, so a path with one is the
// secp256k1 derivation -- the rule cannot be ambiguous.
export function getXmrCurveForPath(path: string): ICurveName {
  return path
    .split('/')
    .slice(1)
    .some((segment) => !segment.endsWith("'"))
    ? 'secp256k1'
    : 'ed25519';
}

/**
 * Monero key derivation.
 *
 * ## From a BIP-39 seed
 *
 * Monero natively uses its own 25-word seed; OneKey standardizes on BIP-39.
 * The account's path picks the BIP-32 curve (see `getXmrCurveForPath`); after
 * that, `spend = sc_reduce32(bip32_key)` and `view = keccak256(spend)`, which
 * is what Trezor (default) and Cake Wallet (the second derive type) both do.
 *
 * The reduction itself lives in the Rust runtime (`keys::derive_from_bip32_key`)
 * rather than being reimplemented here. Two implementations of the same
 * derivation is exactly how two derivations drift apart.
 *
 * ## What leaves derivation
 *
 * `publicKey` carries `${spendPublicKeyHex}:${viewPrivateKeyHex}` — the
 * viewing pair, which is what scanning needs and the direct analogue of a
 * Zcash UFVK. The keyring moves it into the privacy-chain viewing key store
 * and leaves only the spend public key on the account record. The spend key
 * is **never** persisted; it is re-derived from the seed at signing time and
 * discarded.
 */
export default class CoreChainSoftware extends CoreChainApiBase {
  override getExportedSecretKey(
    _query: ICoreApiGetExportedSecretKey,
  ): Promise<string> {
    // Exporting a Monero spend key would hand over full control of the
    // account, and there is no Monero-native format the ecosystem imports
    // from that we could round-trip safely.
    throw new NotImplemented();
  }

  override async getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    return this.baseGetPrivateKeys({
      payload,
      curve: getXmrCurveForPath(payload.account.path),
    });
  }

  /**
   * Sign the transaction the user reviewed.
   *
   * Input selection, decoy draw, fee and change were all settled in the vault
   * at review time — the fee cannot be known without doing them, and the
   * number shown has to be the number paid. What arrives here is the finished
   * transaction, so signing is pure: no wallet database, no node.
   *
   * The spend key never leaves this call. It is reduced from the account's
   * BIP-32 key by the runtime, using the same `sc_reduce32` that produced the
   * address, so the two can never disagree.
   */
  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    const { unsignedTx } = payload;
    const encodedTx = parseXmrTransaction(unsignedTx.encodedTx);
    if (encodedTx.from !== payload.account.address) {
      throw new OneKeyLocalError(
        'xmr: transaction sender does not match the signing account',
      );
    }
    const signer = await this.baseGetSingleSigner({
      payload,
      curve: getXmrCurveForPath(payload.account.path),
    });
    const signed = await signXmrTransaction({
      signableHex: encodedTx.signableHex,
      bip32PrivateKeyHex: await signer.getPrvkeyHex(),
      review: getXmrReviewRequest(
        encodedTx,
        payload.networkInfo.isTestnet ? 'testnet' : 'mainnet',
      ),
    });
    return {
      // Deterministic at signing time, before any node sees the transaction.
      txid: signed.txid,
      rawTx: signed.rawHex,
      encodedTx,
    };
  }

  /**
   * The account's private spend key, for computing key images before a send.
   * Taken the way signing takes it; the caller hands it to the runtime and
   * keeps nothing.
   */
  async getSpendPrivateKeyHex(
    payload: ICoreApiSignBasePayload,
  ): Promise<string> {
    const signer = await this.baseGetSingleSigner({
      payload,
      curve: getXmrCurveForPath(payload.account.path),
    });
    return deriveXmrSpendPrivateKey(await signer.getPrvkeyHex());
  }

  /**
   * The account's viewing pair (`spendPub:viewPriv`), re-derived from the
   * seed for an account whose stored copy is missing. Same derivation as the
   * address, so the two can never disagree.
   */
  async getViewingKeyPair(payload: ICoreApiSignBasePayload): Promise<string> {
    const signer = await this.baseGetSingleSigner({
      payload,
      curve: getXmrCurveForPath(payload.account.path),
    });
    const derived = await deriveXmrAccount({
      network: payload.networkInfo.isTestnet ? 'testnet' : 'mainnet',
      bip32PrivateKeyHex: await signer.getPrvkeyHex(),
    });
    return serializeXmrViewingKeyPair(derived);
  }

  override async signMessage(): Promise<string> {
    // Monero has no signed-message format the ecosystem agrees on.
    throw new NotImplemented();
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    const { privateKeyRaw, networkInfo } = query;
    const derived = await deriveXmrAccount({
      network: networkInfo.isTestnet ? 'testnet' : 'mainnet',
      bip32PrivateKeyHex: privateKeyRaw,
    });

    return {
      // The viewing pair, not the spend key. Scanning needs both halves and
      // neither one grants spending authority.
      publicKey: serializeXmrViewingKeyPair(derived),
      address: derived.primaryAddress,
      addresses: {
        [networkInfo.networkId]: derived.primaryAddress,
      },
      __hwExtraInfo__: undefined,
    };
  }

  override async getAddressFromPublic(): Promise<ICoreApiGetAddressItem> {
    // A Monero address cannot be rebuilt from a public key alone: the view
    // key is half of it, and that half is private.
    throw new OneKeyLocalError(
      'xmr: an address cannot be derived from a public key; use getAddressFromPrivate',
    );
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    return this.baseGetAddressesFromHd(query, {
      curve: getXmrCurveForPath(query.template),
      generateFrom: 'privateKey',
    });
  }
}
