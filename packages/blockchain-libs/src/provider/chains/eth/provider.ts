/* eslint-disable @typescript-eslint/naming-convention,camelcase,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-shadow,@typescript-eslint/no-unsafe-return,@typescript-eslint/restrict-plus-operands,@typescript-eslint/require-await,@typescript-eslint/no-unused-vars */

import { defaultAbiCoder } from '@ethersproject/abi';
import { getAddress } from '@ethersproject/address';
import { hexZeroPad, splitSignature } from '@ethersproject/bytes';
import { keccak256 } from '@ethersproject/keccak256';
import { serialize } from '@ethersproject/transactions';
import {
  getEncryptionPublicKey,
  decrypt as mmSigUtilDecrypt,
} from '@metamask/eth-sig-util';
import BigNumber from 'bignumber.js';
import * as ethUtil from 'ethereumjs-util';

import { BaseProvider } from '@onekeyhq/engine/src/client/BaseClient';
import type {
  AddressValidation,
  SignedTx,
  TypedMessage,
  UnsignedTx,
} from '@onekeyhq/engine/src/types/provider';
import type { Signer, Verifier } from '@onekeyhq/engine/src/types/secret';
import { check, checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import {
  fromBigIntHex,
  toBigIntHex,
} from '@onekeyhq/shared/src/utils/numberUtils';

import { Geth } from './geth';
import { hashMessage } from './sdk/message';

import type { MessageTypes } from './sdk/message';
import type { UnsignedTransaction } from '@ethersproject/transactions';

class Provider extends BaseProvider {
  get geth(): Promise<Geth> {
    return this.clientSelector((i) => i instanceof Geth);
  }

  get chainId(): number {
    return Number(this.chainInfo?.implOptions?.chainId);
  }

  verifyAddress(address: string): Promise<AddressValidation> {
    let isValid = false;
    let checksumAddress = '';

    try {
      checksumAddress = getAddress(address);
      isValid = checksumAddress.length === 42;
    } catch {
      // pass
    }

    return Promise.resolve({
      normalizedAddress: checksumAddress.toLowerCase() || undefined,
      displayAddress: checksumAddress || undefined,
      isValid,
    });
  }

  async pubkeyToAddress(
    verifier: Verifier,
    encoding: string | undefined,
  ): Promise<string> {
    const pubkey = await verifier.getPubkey(false);
    return `0x${keccak256(pubkey.slice(-64)).slice(-40)}`;
  }

  async buildUnsignedTx(unsignedTx: UnsignedTx): Promise<UnsignedTx> {
    const input = unsignedTx.inputs[0];
    const output = unsignedTx.outputs[0];

    const payload = unsignedTx.payload || {};
    const { nonce } = unsignedTx;
    let { feeLimit } = unsignedTx;

    check(typeof nonce === 'number' && nonce >= 0, 'nonce is required');

    if (input && output) {
      const fromAddress = input.address;
      const { tokenAddress } = output;
      let toAddress = output.address;
      let value: string = toBigIntHex(output.value);
      let data: string | undefined;

      if (tokenAddress) {
        data = `0xa9059cbb${defaultAbiCoder
          .encode(['address', 'uint256'], [toAddress, value])
          .slice(2)}`; // method_selector(transfer) + byte32_pad(address) + byte32_pad(value)
        value = '0x0';
        toAddress = tokenAddress;
      } else {
        data = payload.data;
      }

      if (typeof data === 'string' && data) {
        payload.data = data;
      }

      if (!feeLimit) {
        const estimatedGasLimit = await this.geth.then((client) =>
          client.estimateGasLimit(fromAddress, toAddress, value, data),
        );
        const estimatedGasLimitBN = fromBigIntHex(estimatedGasLimit);
        const multiplier =
          this.chainInfo.implOptions.contract_gaslimit_multiplier || 1.2;

        feeLimit =
          tokenAddress ||
          ((await this.verifyAddress(toAddress)).isValid &&
            (await this.geth.then((client) => client.isContract(toAddress))))
            ? estimatedGasLimitBN.multipliedBy(multiplier).integerValue()
            : estimatedGasLimitBN;
      }
    }

    feeLimit = feeLimit || new BigNumber(21000);

    let { feePricePerUnit } = unsignedTx;
    if (!feePricePerUnit) {
      const feePrice = await this.geth.then((i) => i.getFeePricePerUnit());
      const { normal } = feePrice;
      feePricePerUnit = normal.price;

      if (normal.payload) {
        Object.assign(payload, normal.payload);
      }
    }

    return Object.assign(unsignedTx, {
      inputs: input ? [input] : [],
      outputs: output ? [output] : [],
      nonce,
      feeLimit,
      feePricePerUnit,
      payload,
    });
  }

  async signTransaction(
    unsignedTx: UnsignedTx,
    signers: { [address: string]: Signer },
  ): Promise<SignedTx> {
    const fromAddress = unsignedTx.inputs[0]?.address;
    check(fromAddress && signers[fromAddress], 'Signer not found');

    const tx = this.buildEtherUnSignedTx(unsignedTx);
    const digest = keccak256(serialize(tx));
    const [sig, recoveryParam] = await signers[fromAddress].sign(
      Buffer.from(digest.slice(2), 'hex'),
    );
    const [r, s]: [Buffer, Buffer] = [sig.slice(0, 32), sig.slice(32)];
    const signature = splitSignature({
      recoveryParam,
      r: hexZeroPad(`0x${r.toString('hex')}`, 32),
      s: hexZeroPad(`0x${s.toString('hex')}`, 32),
    });

    const rawTx: string = serialize(tx, signature);
    const txid = keccak256(rawTx);
    return { txid, rawTx };
  }

  private buildEtherUnSignedTx(unsignedTx: UnsignedTx): UnsignedTransaction {
    const output = unsignedTx.outputs[0];
    const isERC20Transfer = !!output.tokenAddress;
    const toAddress = isERC20Transfer ? output.tokenAddress : output.address;
    const value = isERC20Transfer ? '0x0' : toBigIntHex(output.value);
    const nonce = checkIsDefined(unsignedTx.nonce);

    const baseTx = {
      to: toAddress || undefined, // undefined is for deploy contract calls.
      value,
      gasLimit: toBigIntHex(checkIsDefined(unsignedTx.feeLimit)),
      nonce: `0x${nonce.toString(16)}`, // some RPC do not accept nonce as number
      data: unsignedTx.payload?.data || '0x',
      chainId: parseInt(checkIsDefined(this.chainInfo.implOptions.chainId)),
    };

    if (unsignedTx.payload?.EIP1559Enabled === true) {
      Object.assign(baseTx, {
        type: 2,
        maxFeePerGas: toBigIntHex(
          new BigNumber(checkIsDefined(unsignedTx.payload?.maxFeePerGas)),
        ),
        maxPriorityFeePerGas: toBigIntHex(
          new BigNumber(
            checkIsDefined(unsignedTx.payload?.maxPriorityFeePerGas),
          ),
        ),
      });
    } else {
      Object.assign(baseTx, {
        gasPrice: toBigIntHex(checkIsDefined(unsignedTx.feePricePerUnit)),
      });
    }

    // @ts-ignore
    return baseTx;
  }

  override signMessage = async (
    message: TypedMessage,
    signer: Signer,
    address?: string,
  ): Promise<string> => {
    let finalMessage: any = message.message;

    // Special temporary fix for attribute name error on SpaceSwap
    // https://onekeyhq.atlassian.net/browse/OK-18748
    try {
      finalMessage = JSON.parse(message.message);
      if (
        finalMessage.message.value1 !== undefined &&
        finalMessage.message.value === undefined
      ) {
        finalMessage.message.value = finalMessage.message.value1;

        finalMessage = JSON.stringify(finalMessage);
      } else {
        finalMessage = message.message;
      }
    } catch (e) {
      finalMessage = message.message;
    }

    const messageHash = hashMessage(message.type as MessageTypes, finalMessage);
    const [sig, recId] = await signer.sign(ethUtil.toBuffer(messageHash));
    return ethUtil.addHexPrefix(
      Buffer.concat([sig, Buffer.from([recId + 27])]).toString('hex'),
    );
  };

  override verifyMessage = async (
    address: string,
    message: TypedMessage,
    signature: string,
  ): Promise<boolean> => {
    const recoveredAddress = await this.ecRecover(message, signature);
    return address.toLowerCase() === recoveredAddress.toLowerCase();
  };

  async ecRecover(message: TypedMessage, signature: string): Promise<string> {
    const messageHash = hashMessage(
      message.type as MessageTypes,
      message.message,
    );
    const hashBuffer = ethUtil.toBuffer(messageHash);
    const sigBuffer = ethUtil.toBuffer(signature);
    check(hashBuffer.length === 32, 'Invalid message hash length');
    check(sigBuffer.length === 65, 'Invalid signature length');

    const [r, s, v] = [
      sigBuffer.slice(0, 32),
      sigBuffer.slice(32, 64),
      sigBuffer[64],
    ];
    const publicKey = ethUtil.ecrecover(hashBuffer, v, r, s);
    return ethUtil.addHexPrefix(
      ethUtil.pubToAddress(publicKey).toString('hex'),
    );
  }

  // The below two mm- methods are very specific functions needed to mimic a
  // metamask provider.
  async mmDecrypt(serializedMessage: string, signer: Signer): Promise<string> {
    const encryptedData = JSON.parse(
      ethUtil.toBuffer(serializedMessage).toString(),
    );
    return mmSigUtilDecrypt({
      encryptedData,
      privateKey: (await signer.getPrvkey()).toString('hex'),
    });
  }

  async mmGetPublicKey(signer: Signer): Promise<string> {
    return getEncryptionPublicKey((await signer.getPrvkey()).toString('hex'));
  }
}

export { Provider };
