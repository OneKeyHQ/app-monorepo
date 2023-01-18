import BigNumber from 'bignumber.js';
import { baseDecode, baseEncode } from 'borsh';

import { BaseProvider } from '@onekeyhq/engine/src/client/BaseClient';
import type {
  AddressValidation,
  SignedTx,
  UnsignedTx,
} from '@onekeyhq/engine/src/types/provider';
import type { Signer, Verifier } from '@onekeyhq/engine/src/types/secret';

import { NearCli } from './nearcli';
import { PublicKey } from './sdk/key_pair';
import * as nearTx from './sdk/transaction';

import type { GasCostConfig } from './nearcli';

const FT_TRANSFER_GAS = '30000000000000';
const FT_TRANSFER_DEPOSIT = '1';

const IMPLICIT_ACCOUNT_PATTERN = /^[a-z\d]{64}$/;
const REGISTER_ACCOUNT_PATTERN =
  /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

const packActions = (unsignedTx: UnsignedTx) => {
  const { outputs } = unsignedTx;
  const [output] = outputs;
  const actions = [];

  if (!output.tokenAddress) {
    actions.push(nearTx.transfer(output.value.integerValue().toFixed()));
  } else {
    actions.push(
      nearTx.functionCall(
        'ft_transfer',
        {
          amount: output.value.integerValue().toFixed(),
          receiver_id: output.address,
        },
        FT_TRANSFER_GAS,
        FT_TRANSFER_DEPOSIT,
      ),
    );
  }

  return actions;
};

class Provider extends BaseProvider {
  private _txCostConfig!: Record<string, GasCostConfig>;

  get nearCli(): Promise<NearCli> {
    return this.clientSelector((i) => i instanceof NearCli);
  }

  async getTxCostConfig(): Promise<Record<string, GasCostConfig>> {
    if (!this._txCostConfig) {
      this._txCostConfig = await this.nearCli.then((i) => i.getTxCostConfig());
    }

    return this._txCostConfig;
  }

  async pubkeyToAddress(
    verifier: Verifier,
    encoding?: string,
  ): Promise<string> {
    const pubkey = await verifier.getPubkey(true);
    if (encoding === 'ENCODED_PUBKEY') {
      return `ed25519:${baseEncode(pubkey)}`;
    }
    return pubkey.toString('hex');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async verifyAddress(address: string): Promise<AddressValidation> {
    let encoding: string | undefined;
    if (IMPLICIT_ACCOUNT_PATTERN.test(address)) {
      encoding = 'IMPLICIT_ACCOUNT';
    } else if (REGISTER_ACCOUNT_PATTERN.test(address)) {
      return {
        isValid: true,
        normalizedAddress: address,
        displayAddress: address,
        encoding: 'REGISTER_ACCOUNT',
      };
    } else if (address.includes(':')) {
      const [prefix, encoded] = address.split(':');
      try {
        if (
          prefix === 'ed25519' &&
          Buffer.from(baseDecode(encoded)).length === 32
        ) {
          encoding = 'ENCODED_PUBKEY';
        }
      } catch (e) {
        // ignored
      }
    }

    if (encoding) {
      return {
        isValid: true,
        normalizedAddress: address,
        displayAddress: address,
        encoding,
      };
    }
    return {
      isValid: false,
    };
  }

  async buildUnsignedTx(unsignedTx: UnsignedTx): Promise<UnsignedTx> {
    const cli = await this.nearCli;
    const {
      inputs: [input],
      payload = {},
    } = unsignedTx;
    let { nonce, feeLimit } = unsignedTx;

    const feePricePerUnit =
      unsignedTx.feePricePerUnit ||
      (await cli.getFeePricePerUnit().then((i) => i.normal.price));

    if (input) {
      nonce =
        nonce ?? (await cli.getAddress(input.address).then((i) => i.nonce));

      const { blockHash } = await cli.getBestBlock();
      Object.assign(payload, { blockHash });

      if (!feeLimit) {
        const txCostConfig = await this.getTxCostConfig();
        // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
        const { transfer_cost, action_receipt_creation_config } = txCostConfig;

        if (!input.tokenAddress) {
          // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
          feeLimit = new BigNumber(transfer_cost.execution)
            // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
            .plus(action_receipt_creation_config.execution)
            .multipliedBy(2);
        } else {
          feeLimit = new BigNumber(FT_TRANSFER_GAS); // hard to estimate gas of function call
        }
      }
    }

    feeLimit = feeLimit || new BigNumber('100000000000');

    return { ...unsignedTx, feePricePerUnit, feeLimit, nonce, payload };
  }

  async signTransaction(
    unsignedTx: UnsignedTx,
    signers: { [p: string]: Signer },
  ): Promise<SignedTx> {
    const {
      inputs: [input],
      outputs: [output],
      nonce,
      payload: { blockHash },
    } = unsignedTx;
    const signer = signers[input.address];
    const pubkey = await signer.getPubkey(true);

    const actions = packActions(unsignedTx);
    const tx = nearTx.createTransaction(
      input.address,
      PublicKey.from(new Uint8Array(pubkey)),
      output.tokenAddress || output.address,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      nonce!,
      actions,
      baseDecode(blockHash),
    );
    const [hash, signedTx] = await nearTx.signTransactionObject(tx, (digest) =>
      signer.sign(Buffer.from(digest)).then((res) => new Uint8Array(res[0])),
    );

    return {
      txid: baseEncode(hash),
      rawTx: Buffer.from(signedTx.encode()).toString('base64'),
    };
  }
}

export { Provider };
