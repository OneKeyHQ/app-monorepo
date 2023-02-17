/* eslint-disable @typescript-eslint/naming-convention,camelcase,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-shadow,@typescript-eslint/no-unsafe-return,@typescript-eslint/restrict-plus-operands,@typescript-eslint/require-await,no-restricted-globals,no-continue,@typescript-eslint/no-unused-vars */

import {
  isValidCfxAddress,
  encode as toCfxAddress,
  decode as toEthAddress,
} from '@conflux-dev/conflux-address-js';
import { defaultAbiCoder } from '@ethersproject/abi';
import { hexZeroPad } from '@ethersproject/bytes';
import { keccak256 } from '@ethersproject/keccak256';
import BigNumber from 'bignumber.js';

import { BaseProvider } from '@onekeyhq/engine/src/client/BaseClient';
import type {
  AddressValidation,
  SignedTx,
  TypedMessage,
  UnsignedTx,
} from '@onekeyhq/engine/src/types/provider';
import type { Signer, Verifier } from '@onekeyhq/engine/src/types/secret';
import type { ISdkCfxTransaction } from '@onekeyhq/engine/src/vaults/impl/cfx/sdkCfx';
import sdkCfx from '@onekeyhq/engine/src/vaults/impl/cfx/sdkCfx';
import { check, checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import {
  fromBigIntHex,
  toBigIntHex,
} from '@onekeyhq/shared/src/utils/numberUtils';

import { MessageTypes } from '../eth/sdk/message';

import { Conflux } from './conflux';

const { Message, PersonalMessage, Transaction } = sdkCfx;

function hashCfxMessage(typedMessage: TypedMessage): string {
  const { type, message } = typedMessage;
  switch (type as MessageTypes) {
    case undefined:
    case MessageTypes.ETH_SIGN:
      return new Message(message).hash;
    case MessageTypes.PERSONAL_SIGN:
      return new PersonalMessage(message).hash;
    // TODO: cip-23 depends on @findeth/abi which makes builds fail on android
    // import { getMessage } from 'cip-23';
    // case MessageTypes.TYPE_DATA_V3:
    // case MessageTypes.TYPE_DATA_V4:
    //   return keccak256(getMessage(JSON.parse(message)));
    default:
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Invalid messageType: ${type}`);
  }
}

class Provider extends BaseProvider {
  get conflux(): Promise<Conflux> {
    return this.clientSelector((i) => i instanceof Conflux);
  }

  private internalPubkeyToAddress(pubkey: Buffer): string {
    const ethAddress = this.ethAddressToCfxAddress(
      keccak256(pubkey).slice(-40),
    );
    const networkID = parseInt(this.chainInfo.implOptions.chainId);
    return toCfxAddress(ethAddress, networkID);
  }

  verifyAddress(address: string): Promise<AddressValidation> {
    const isValid = isValidCfxAddress(address);

    return Promise.resolve({
      normalizedAddress: isValid ? address.toLowerCase() : undefined,
      displayAddress: isValid ? address.toLowerCase() : undefined,
      isValid,
    });
  }

  async pubkeyToAddress(
    verifier: Verifier,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    encoding?: string | undefined,
  ): Promise<string> {
    const uncompressPubKey = await verifier.getPubkey(false);
    return this.internalPubkeyToAddress(uncompressPubKey.slice(1));
  }

  /**
   * transform the eth address to cfx format address
   * @param address the eth format address {string}
   * @returns the cfx format address {string}
   */
  private ethAddressToCfxAddress(address: string): string {
    return `0x1${address.toLowerCase().slice(1)}`;
  }

  async buildUnsignedTx(unsignedTx: UnsignedTx): Promise<UnsignedTx> {
    const input = unsignedTx.inputs[0];
    const output = unsignedTx.outputs[0];

    const payload = unsignedTx.payload || {};
    let { nonce } = unsignedTx;
    let { feeLimit } = unsignedTx;

    if (input && output) {
      const fromAddress = input.address;
      const { tokenAddress } = output;
      let toAddress = output.address;
      let value: string = toBigIntHex(output.value);
      let data: string | undefined;

      if (tokenAddress) {
        toAddress = `0x${toEthAddress(toAddress).hexAddress.toString('hex')}`;
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
        const estimatedGasLimit = await (
          await this.conflux
        ).estimateGasLimit(fromAddress, toAddress, value, data);
        const estimatedGasLimitBN = fromBigIntHex(estimatedGasLimit);
        const multiplier =
          this.chainInfo.implOptions.contract_gaslimit_multiplier || 1.2;

        feeLimit =
          tokenAddress || (await (await this.conflux).isContract(toAddress))
            ? estimatedGasLimitBN.multipliedBy(multiplier).integerValue()
            : estimatedGasLimitBN;
      }

      if (typeof nonce !== 'number' || nonce < 0) {
        const [addressInfo] = await (
          await this.conflux
        ).getAddresses([fromAddress]);
        nonce = addressInfo?.nonce;
      }
      const [_, storageLimit] = await (
        await this.conflux
      ).estimateGasAndCollateral(fromAddress, toAddress, value, data);
      const epochHeight = await (await this.conflux).getEpochNumber();
      payload.storageLimit = fromBigIntHex(storageLimit);
      payload.epochHeight = epochHeight;
    }

    const feePricePerUnit =
      unsignedTx.feePricePerUnit ||
      (await (await this.conflux).getFeePricePerUnit()).normal.price;
    feeLimit = feeLimit || new BigNumber(21000);

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
    const params = this.buildCFXUnSignedTx(unsignedTx);
    const unSignedTx: ISdkCfxTransaction = new Transaction(params);
    const digest = keccak256(unSignedTx.encode(false));
    const [sig, recoveryParam] = await signers[fromAddress].sign(
      Buffer.from(digest.slice(2), 'hex'),
    );
    const [r, s]: [Buffer, Buffer] = [sig.slice(0, 32), sig.slice(32)];
    const SignedTx = new Transaction({
      ...params,
      r: hexZeroPad(`0x${r.toString('hex')}`, 32),
      s: hexZeroPad(`0x${s.toString('hex')}`, 32),
      v: recoveryParam,
    });
    const rawTx: string = SignedTx.serialize();
    const txid = keccak256(rawTx);
    return { txid, rawTx };
  }

  private buildCFXUnSignedTx(unsignedTx: UnsignedTx): any {
    const output = unsignedTx.outputs[0];
    const isERC20Transfer = !!output.tokenAddress;
    const toAddress = isERC20Transfer ? output.tokenAddress : output.address;
    const value = isERC20Transfer ? '0x0' : output.value;

    return {
      to: toAddress,
      value,
      gas: checkIsDefined(unsignedTx.feeLimit),
      gasPrice: checkIsDefined(unsignedTx.feePricePerUnit),
      storageLimit: unsignedTx.payload.storageLimit,
      epochHeight: unsignedTx.payload.epochHeight,
      nonce: checkIsDefined(unsignedTx.nonce),
      data: unsignedTx.payload?.data || '0x',
      chainId: parseInt(checkIsDefined(this.chainInfo.implOptions.chainId)),
    };
  }

  override async signMessage(
    message: TypedMessage,
    signer: Signer,
    address?: string,
  ): Promise<string> {
    return Message.sign(
      `0x${(await signer.getPrvkey()).toString('hex')}`,
      hashCfxMessage(message),
    );
  }

  override async verifyMessage(
    address: string,
    message: TypedMessage,
    signature: string,
  ): Promise<boolean> {
    const messageHash = hashCfxMessage(message);
    // Message.recover returns a string with 0x prefix.
    const publicKey = Message.recover(signature, messageHash).slice(2);
    return Promise.resolve(
      address === this.internalPubkeyToAddress(Buffer.from(publicKey, 'hex')),
    );
  }
}

export { Provider };
