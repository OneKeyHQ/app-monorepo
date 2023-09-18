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
  override pubkeyToAddress(
    verifier: Verifier,
    encoding?: string | undefined,
  ): Promise<string> {
    // use coreChainApi instead
    throw new Error('Method not implemented 8838925.');
  }

  override signTransaction(
    unsignedTx: UnsignedTx,
    signers: { [p: string]: Signer },
  ): Promise<SignedTx> {
    // use coreChainApi instead
    throw new Error('Method not implemented 4776513.');
  }

  async buildUnsignedTx(unsignedTx: UnsignedTx): Promise<UnsignedTx> {
    const input = unsignedTx.inputs[0];
    const output = unsignedTx.outputs[0];

    const payload = unsignedTx.payload || {};
    const { nonce } = unsignedTx;
    let { feeLimit, feeLimitForDisplay } = unsignedTx;

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
          client.estimateGasLimit({
            fromAddress,
            toAddress,
            value,
            data,
            customData: payload.customData,
          }),
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
        feeLimitForDisplay = estimatedGasLimitBN;
      }
    }

    feeLimit = feeLimit || new BigNumber(21000);
    feeLimitForDisplay = feeLimitForDisplay || feeLimit || new BigNumber(21000);

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
      feeLimitForDisplay,
      feePricePerUnit,
      payload,
    });
  }

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

  override verifyMessage = async (
    address: string,
    message: TypedMessage,
    signature: string,
  ): Promise<boolean> => {
    const recoveredAddress = await this.ecRecover(message, signature);
    return address.toLowerCase() === recoveredAddress.toLowerCase();
  };

  async ecRecover(message: TypedMessage, signature: string): Promise<string> {
    const messageHash = hashMessage({
      messageType: message.type as MessageTypes,
      message: message.message,
    });
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
