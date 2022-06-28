/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { Provider } from '@onekeyfe/blockchain-libs/dist/provider/chains/btc/provider';
import { getHDPath, getScriptType } from '@onekeyfe/hd-core';
import * as BitcoinJS from 'bitcoinjs-lib';

import { HardwareSDK } from '@onekeyhq/kit/src/utils/hardware';

import { COINTYPE_BTC as COIN_TYPE } from '../../../constants';
import {
  NotImplemented,
  OneKeyHardwareError,
  OneKeyInternalError,
} from '../../../errors';
import { AccountType, DBUTXOAccount } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import { getAccountDefaultByPurpose } from './utils';

import type {
  IPrepareHardwareAccountsParams,
  ISignCredentialOptions,
} from '../../types';
import type BTCVault from './Vault';
import type {
  SignedTx,
  TxInput,
  TxOutput,
  UTXO,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import type { RefTransaction } from '@onekeyfe/hd-core';
import type { Messages } from '@onekeyfe/hd-transport';

const DEFAULT_PURPOSE = 49;

export class KeyringHardware extends KeyringHardwareBase {
  async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const addresses = unsignedTx.inputs.map((output) => output.address);
    const utxos = await (this.vault as BTCVault).collectUTXOs();

    const signers: Record<string, string> = {};
    for (const utxo of utxos) {
      const { address, path } = utxo;
      if (addresses.includes(address)) {
        signers[address] = path;
      }
    }

    const provider = (await this.engine.providerManager.getProvider(
      this.networkId,
    )) as Provider;

    const { inputs, outputs } = unsignedTx;
    const prevTxids = Array.from(
      new Set(inputs.map((i) => (i.utxo as UTXO).txid)),
    );
    const prevTxs = await provider.collectTxs(prevTxids);
    const connectId = await this.getHardwareConnectId();
    const network = await this.getNetwork();

    const response = await HardwareSDK.btcSignTransaction(connectId, {
      // useEmptyPassphrase: true,
      coin: 'btc',
      inputs: inputs.map((i) => this.buildHardwareInput(i, signers[i.address])),
      outputs: outputs.map((o) => this.buildHardwareOutput(o)),
      refTxs: Object.values(prevTxs).map((i) => this.buildPrevTx(i)),
    });

    if (response.success) {
      const { serializedTx } = response.payload;
      const tx = BitcoinJS.Transaction.fromHex(serializedTx);

      return { txid: tx.getId(), rawTx: serializedTx };
    }

    if (response.payload.error) {
      throw new OneKeyHardwareError(new Error(response.payload.error));
    } else {
      throw new OneKeyHardwareError(new Error('Unknown error'));
    }
  }

  async signMessage(
    messages: any[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    throw new NotImplemented();
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBUTXOAccount>> {
    const { indexes, purpose, names } = params;
    const usedPurpose = purpose || DEFAULT_PURPOSE;
    const ignoreFirst = indexes[0] !== 0;
    const usedIndexes = [...(ignoreFirst ? [indexes[0] - 1] : []), ...indexes];
    const { namePrefix, addressEncoding } =
      getAccountDefaultByPurpose(usedPurpose);
    const provider = (await this.engine.providerManager.getProvider(
      this.networkId,
    )) as Provider;

    let response;
    try {
      const connectId = await this.getHardwareConnectId();
      response = await HardwareSDK.btcGetPublicKey(connectId, {
        bundle: usedIndexes.map((index) => ({
          path: `m/${usedPurpose}'/${COIN_TYPE}'/${index}'`,
          showOnOneKey: false,
        })),
      });
    } catch (error: any) {
      console.error(error);
      throw new OneKeyHardwareError(error);
    }

    if (!response.success) {
      console.error(response.payload);
      throw new OneKeyHardwareError({
        code: response.payload.code,
        message: (response.payload.error || response.payload) as string,
      });
    }

    if (response.payload.length !== usedIndexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }

    const ret = [];
    let index = 0;
    for (const { path, xpub } of response.payload) {
      const firstAddressRelPath = '0/0';
      const { [firstAddressRelPath]: address } = provider.xpubToAddresses(
        xpub,
        [firstAddressRelPath],
      );
      const name =
        (names || [])[index] || `${namePrefix} #${usedIndexes[index] + 1}`;
      if (!ignoreFirst || index > 0) {
        ret.push({
          id: `${this.walletId}--${path}`,
          name,
          type: AccountType.UTXO,
          path,
          coinType: COIN_TYPE,
          xpub,
          address,
          addresses: { [firstAddressRelPath]: address },
        });
      }

      if (usedIndexes.length === 1) {
        // Only getting the first account, ignore balance checking.
        break;
      }

      const { txs } = (await provider.getAccount(
        { type: 'simple', xpub },
        addressEncoding,
      )) as { txs: number };
      if (txs > 0) {
        index += 1;
        // TODO: blockbook API rate limit.
        await new Promise((r) => setTimeout(r, 200));
      } else {
        break;
      }
    }
    return ret;
  }

  buildHardwareInput = (input: TxInput, path: string): Messages.TxInputType => {
    const addressN = getHDPath(path);
    const scriptType = getScriptType(addressN);
    const utxo = input.utxo as UTXO;

    // @ts-expect-error
    return {
      prev_index: utxo.vout,
      prev_hash: utxo.txid,
      amount: utxo.value.integerValue().toString(),
      address_n: addressN,
      script_type: scriptType,
    };
  };

  buildHardwareOutput = (output: TxOutput): Messages.TxOutputType => {
    const { isCharge, bip44Path } = output.payload || {};

    if (isCharge && bip44Path) {
      const addressN = getHDPath(bip44Path);
      const scriptType = getScriptType(addressN);
      return {
        // @ts-expect-error
        script_type: scriptType,
        address_n: addressN,
        amount: output.value.integerValue().toString(),
      };
    }

    return {
      script_type: 'PAYTOADDRESS',
      address: output.address,
      amount: output.value.integerValue().toString(),
    };
  };

  buildPrevTx = (rawTx: string): RefTransaction => {
    const tx = BitcoinJS.Transaction.fromHex(rawTx);

    return {
      hash: tx.getId(),
      version: tx.version,
      inputs: tx.ins.map((i) => ({
        prev_hash: i.hash.reverse().toString('hex'),
        prev_index: i.index,
        script_sig: i.script.toString('hex'),
        sequence: i.sequence,
      })),
      bin_outputs: tx.outs.map((o) => ({
        amount: o.value,
        script_pubkey: o.script.toString('hex'),
      })),
      lock_time: tx.locktime,
    };
  };
}
