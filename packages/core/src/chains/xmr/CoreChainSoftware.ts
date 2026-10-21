import { NotImplemented, OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import { deriveXmrAccount } from './sdkXmrRuntime/address';
import { signXmrTransaction } from './sdkXmrRuntime/sign';
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
// - Trezor (default): SLIP-10 ed25519 at m/44'/128'/a'.
// - Cake Wallet: secp256k1 BIP-32 at m/44'/128'/a'/0/0.
// ed25519 cannot derive a non-hardened segment, so a path with one is the
// secp256k1 derivation.
export function getXmrCurveForPath(path: string): ICurveName {
  return path
    .split('/')
    .slice(1)
    .some((segment) => !segment.endsWith("'"))
    ? 'secp256k1'
    : 'ed25519';
}

/**
 * Monero keys from a BIP-39 seed: `spend = sc_reduce32(bip32_key)` and
 * `view = keccak256(spend)`. The reduction lives only in the Rust runtime so
 * there is a single implementation.
 *
 * `publicKey` carries the viewing pair (`spendPub:viewPriv`). The spend key is
 * never persisted and never leaves the runtime: signing and key-image import
 * hand it the BIP-32 key, which it reduces per call.
 */
export default class CoreChainSoftware extends CoreChainApiBase {
  override getExportedSecretKey(
    _query: ICoreApiGetExportedSecretKey,
  ): Promise<string> {
    // A spend key grants full control, and there is no Monero-native import
    // format to round-trip.
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
   * Inputs, decoys, fee and change were fixed at review time, so signing
   * needs no wallet database or node.
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
   * The account's BIP-32 key for the runtime's key-image import; the caller
   * keeps nothing and the runtime reduces it to the spend key.
   */
  async getKeyImageBip32PrivateKeyHex(
    payload: ICoreApiSignBasePayload,
  ): Promise<string> {
    const signer = await this.baseGetSingleSigner({
      payload,
      curve: getXmrCurveForPath(payload.account.path),
    });
    return signer.getPrvkeyHex();
  }

  /** Re-derives the viewing pair (`spendPub:viewPriv`) when the stored copy is missing. */
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
      // The viewing pair, not the spend key; neither half grants spending.
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
