/* eslint-disable @typescript-eslint/naming-convention,camelcase,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-shadow,@typescript-eslint/no-unsafe-return,@typescript-eslint/restrict-plus-operands,@typescript-eslint/require-await,@typescript-eslint/no-unused-vars */
import { arrayify, hexlify } from '@ethersproject/bytes';
import {
  bcs,
  crypto_hash,
  starcoin_types,
  encoding as stcEncoding,
  utils,
} from '@starcoin/starcoin';
import * as ethUtil from 'ethereumjs-util';

import { BaseProvider } from '@onekeyhq/engine/src/client/BaseClient';
import type {
  AddressValidation,
  SignedTx,
  TypedMessage,
  UnsignedTx,
} from '@onekeyhq/engine/src/types/provider';
import type { Signer, Verifier } from '@onekeyhq/engine/src/types/secret';
import { check } from '@onekeyhq/shared/src/utils/assertUtils';

import { StcClient } from './starcoin';

export const buildUnsignedRawTx = (
  unsignedTx: UnsignedTx,
  chainId: string,
): [starcoin_types.RawUserTransaction, Uint8Array] => {
  const fromAddr = unsignedTx.inputs[0].address;
  const { scriptFn, data } = unsignedTx.payload;

  const gasLimit = unsignedTx.feeLimit;
  const gasPrice = unsignedTx.feePricePerUnit;
  const { nonce } = unsignedTx;
  const { expirationTime } = unsignedTx.payload;

  if (
    !fromAddr ||
    !(scriptFn || data) ||
    !gasLimit ||
    !gasPrice ||
    typeof nonce === 'undefined'
  ) {
    throw new Error('invalid unsignedTx');
  }

  let txPayload: starcoin_types.TransactionPayload;
  if (scriptFn) {
    txPayload = scriptFn;
  } else {
    txPayload = stcEncoding.bcsDecode(starcoin_types.TransactionPayload, data);
  }

  const rawTxn = utils.tx.generateRawUserTransaction(
    fromAddr,
    txPayload,
    gasLimit.toNumber(),
    gasPrice.toNumber(),
    nonce,
    expirationTime,
    Number(chainId),
  );

  const serializer = new bcs.BcsSerializer();
  rawTxn.serialize(serializer);

  return [rawTxn, serializer.getBytes()];
};

const hashRawTx = (rawUserTransactionBytes: Uint8Array): Uint8Array => {
  const hashSeedBytes = crypto_hash.createRawUserTransactionHasher().get_salt();
  return Uint8Array.of(...hashSeedBytes, ...rawUserTransactionBytes);
};

export const buildSignedTx = (
  senderPublicKey: string,
  rawSignature: Buffer,
  rawTxn: starcoin_types.RawUserTransaction,
) => {
  const publicKey = new starcoin_types.Ed25519PublicKey(
    Buffer.from(senderPublicKey, 'hex'),
  );
  const signature = new starcoin_types.Ed25519Signature(rawSignature);
  const transactionAuthenticatorVariantEd25519 =
    new starcoin_types.TransactionAuthenticatorVariantEd25519(
      publicKey,
      signature,
    );
  const signedUserTransaction = new starcoin_types.SignedUserTransaction(
    rawTxn,
    transactionAuthenticatorVariantEd25519,
  );
  const se = new bcs.BcsSerializer();
  signedUserTransaction.serialize(se);
  const txid = crypto_hash
    .createUserTransactionHasher()
    .crypto_hash(se.getBytes());
  const rawTx = hexlify(se.getBytes());

  return { txid, rawTx };
};

class Provider extends BaseProvider {
  get starcoin(): Promise<StcClient> {
    return this.clientSelector((i) => i instanceof StcClient);
  }

  async buildUnsignedTx(unsignedTx: UnsignedTx): Promise<UnsignedTx> {
    const feePricePerUnit = unsignedTx.feePricePerUnit
      ? unsignedTx.feePricePerUnit
      : (await (await this.starcoin).getFeePricePerUnit()).normal.price;
    const txInput = unsignedTx.inputs[0];
    const txOutput = unsignedTx.outputs[0];
    const payload = unsignedTx.payload || {};

    const { nonce } = unsignedTx;
    let { feeLimit } = unsignedTx;
    const fromAddr = txInput.address;
    let txPayload: starcoin_types.TransactionPayload;
    if (txInput && txOutput) {
      let toAddr = txOutput.address;
      const amount = txOutput.value;
      const { tokenAddress } = txOutput;
      if (toAddr.startsWith('stc')) {
        const riv = stcEncoding.decodeReceiptIdentifier(toAddr);
        toAddr = riv.accountAddress.startsWith('0x')
          ? riv.accountAddress
          : `0x${riv.accountAddress}`;
      }
      const typeArgs = [tokenAddress ?? '0x1::STC::STC'];
      const functionId = '0x1::TransferScripts::peer_to_peer_v2';
      const args = [toAddr, BigInt(amount.toNumber())];
      const nodeUrl = (await this.starcoin).rpc?.url;
      const scriptFunction = (await utils.tx.encodeScriptFunctionByResolve(
        functionId,
        typeArgs,
        args,
        nodeUrl,
      )) as starcoin_types.TransactionPayload;
      payload.scriptFn = scriptFunction;
      txPayload = scriptFunction;
    } else if (payload.data) {
      txPayload = stcEncoding.bcsDecode(
        starcoin_types.TransactionPayload,
        payload.data,
      );
    } else {
      // should not be here
      throw new Error('invalid unsignedTx payload');
    }
    const senderPublicKey = txInput.publicKey || '';
    if (!feeLimit) {
      check(senderPublicKey, 'senderPublicKey is required');
    }
    if (typeof nonce === 'undefined') {
      throw new Error('nonce is not available');
    }
    payload.expirationTime =
      payload.expirationTime || Math.floor(Date.now() / 1000) + 60 * 60;

    const maxGasAmount = 10000000;
    const { chainId } = this.chainInfo.implOptions;
    const gasUnitPrice = feePricePerUnit.toNumber();
    const expirationTimestampSecs =
      payload.expirationTime || Math.floor(Date.now() / 1000) + 60 * 60;
    const rawUserTransaction = utils.tx.generateRawUserTransaction(
      fromAddr,
      txPayload,
      maxGasAmount,
      gasUnitPrice,
      nonce as number | bigint,
      expirationTimestampSecs,
      chainId,
    );

    const rawUserTransactionHex = stcEncoding.bcsEncode(rawUserTransaction);

    let tokensChangedTo;

    if (!feeLimit) {
      const result = await (
        await this.starcoin
      ).estimateGasLimitAndTokensChangedTo(
        rawUserTransactionHex,
        senderPublicKey,
      );
      feeLimit = result.feeLimit;
      tokensChangedTo = result.tokensChangedTo;
    }
    return {
      inputs: txInput ? [txInput] : [],
      outputs: txOutput ? [txOutput] : [],
      feeLimit,
      tokensChangedTo,
      feePricePerUnit,
      nonce,
      payload,
    };
  }

  async pubkeyToAddress(verifier: Verifier, encoding = 'hex'): Promise<string> {
    let address = '';
    const pubkeyBytes = await verifier.getPubkey();
    if (encoding === 'hex') {
      address = stcEncoding.publicKeyToAddress(pubkeyBytes.toString('hex'));
    } else if (encoding === 'bech32') {
      address = stcEncoding.publicKeyToReceiptIdentifier(
        pubkeyBytes.toString('hex'),
      );
    } else {
      throw new Error('invalid encoding');
    }
    return address;
  }

  async signTransaction(
    unsignedTx: UnsignedTx,
    signers: { [p: string]: Signer },
  ): Promise<SignedTx> {
    const [rawTxn, rawUserTransactionBytes] = buildUnsignedRawTx(
      unsignedTx,
      this.chainInfo.implOptions.chainId,
    );
    const msgBytes = hashRawTx(rawUserTransactionBytes);

    const {
      inputs: [{ address: fromAddr, publicKey: senderPublicKey }],
    } = unsignedTx;
    check(
      typeof senderPublicKey !== 'undefined',
      'senderPublicKey is required',
    );

    const [signature] = await signers[fromAddr].sign(Buffer.from(msgBytes));
    return buildSignedTx(senderPublicKey as string, signature, rawTxn);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async verifyAddress(address: string): Promise<AddressValidation> {
    if (address.startsWith('stc')) {
      try {
        const riv = stcEncoding.decodeReceiptIdentifier(address);
        return {
          normalizedAddress: `0x${riv.accountAddress}`,
          displayAddress: address,
          isValid: true,
          encoding: 'bech32',
        };
      } catch (error) {
        // pass
      }
    } else {
      try {
        const normalizedAddress = address.startsWith('0x')
          ? address.toLowerCase()
          : `0x${address.toLowerCase()}`;
        const accountAddress = stcEncoding.addressToSCS(normalizedAddress);
        // in order to check invalid address length, because the auto padding 0 at head of address
        if (stcEncoding.addressFromSCS(accountAddress) === normalizedAddress) {
          return {
            normalizedAddress,
            displayAddress: normalizedAddress,
            isValid: true,
            encoding: 'hex',
          };
        }
      } catch (error) {
        // pass
      }
    }

    return {
      isValid: false,
    };
  }

  override signMessage = async (
    { type, message: messageHex }: TypedMessage,
    signer: Signer,
    address?: string,
  ): Promise<string> => {
    const privateKey = await signer.getPrvkey();
    const originMessage = Buffer.from(
      ethUtil.stripHexPrefix(messageHex),
      'hex',
    ).toString('utf8');
    const { publicKey, signature } = await utils.signedMessage.signMessage(
      originMessage,
      privateKey.toString('hex'),
    );
    if (type === 1) {
      const chainId = parseInt(this.chainInfo.implOptions.chainId);
      const msgBytes = arrayify(messageHex);
      const signingMessage = new starcoin_types.SigningMessage(msgBytes);
      const signedMessageHex = await utils.signedMessage.generateSignedMessage(
        signingMessage,
        chainId,
        publicKey,
        signature,
      );
      return signedMessageHex;
    }
    return signature;
  };

  override verifyMessage = async (
    publicKey: string, // require pubkey here!!
    { message }: TypedMessage,
    signature: string,
  ): Promise<boolean> => {
    // starcoin sdk doesn't provide a direct method to verify message, need to
    // build up a signedMessage ourselves.
    const messageBytes = new Uint8Array(Buffer.from(message, 'utf8'));
    const signedMessageHex = await utils.signedMessage.generateSignedMessage(
      new starcoin_types.SigningMessage(messageBytes),
      parseInt(this.chainInfo.implOptions.chainId),
      publicKey,
      signature,
    );
    try {
      const address = await utils.signedMessage.recoverSignedMessageAddress(
        signedMessageHex,
      );
      return address === stcEncoding.publicKeyToAddress(publicKey);
    } catch (e) {
      console.error(e);
      return false;
    }
  };
}

export { Provider };
