import * as BitcoinJS from 'bitcoinjs-lib';

import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import {
  CoreSDKLoader,
  HardwareSDK,
} from '@onekeyhq/shared/src/device/hardwareInstance';
import {
  COINTYPE_BCH,
  COINTYPE_DOGE,
} from '@onekeyhq/shared/src/engine/engineConsts';

import {
  NotImplemented,
  OneKeyHardwareError,
  OneKeyInternalError,
} from '../../../errors';
import { slicePathTemplate } from '../../../managers/derivation';
import { getAccountNameInfoByTemplate } from '../../../managers/impl';
import { AccountType } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import { getAccountDefaultByPurpose } from './utils';

import type { DBUTXOAccount } from '../../../types/account';
import type {
  IGetAddressParams,
  IPrepareHardwareAccountsParams,
} from '../../types';
import type { TxInput, TxOutput, UTXO } from './types';
import type BTCForkVault from './VaultBtcFork';
import type { RefTransaction } from '@onekeyfe/hd-core';
import type { Messages } from '@onekeyfe/hd-transport';

export class KeyringHardware extends KeyringHardwareBase {
  override async signTransaction(unsignedTx: UnsignedTx): Promise<SignedTx> {
    const coinName = (this.vault as unknown as BTCForkVault).getCoinName();
    const addresses = unsignedTx.inputs.map((input) => input.address);
    const utxos = await (this.vault as unknown as BTCForkVault).collectUTXOs();

    const signers: Record<string, string> = {};
    for (const utxo of utxos) {
      const { address, path } = utxo;
      if (addresses.includes(address)) {
        signers[address] = path;
      }
    }

    const provider = await (
      this.vault as unknown as BTCForkVault
    ).getProvider();

    const { inputs, outputs } = unsignedTx;
    const prevTxids = Array.from(
      new Set(inputs.map((i) => (i.utxo as UTXO).txid)),
    );
    const prevTxs = await provider.collectTxs(prevTxids);
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    await this.getHardwareSDKInstance();

    const response = await HardwareSDK.btcSignTransaction(connectId, deviceId, {
      coin: coinName.toLowerCase(),
      inputs: await Promise.all(
        inputs.map(async (i) => this.buildHardwareInput(i, signers[i.address])),
      ),
      outputs: await Promise.all(
        outputs.map(async (o) => this.buildHardwareOutput(o)),
      ),
      refTxs: Object.values(prevTxs).map((i) => this.buildPrevTx(i)),
      ...passphraseState,
    });

    if (response.success) {
      const { serializedTx } = response.payload;
      const tx = BitcoinJS.Transaction.fromHex(serializedTx);

      return { txid: tx.getId(), rawTx: serializedTx };
    }

    throw convertDeviceError(response.payload);
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    const { indexes, purpose, names, template } = params;

    const impl = await this.getNetworkImpl();
    const vault = this.vault as unknown as BTCForkVault;
    const defaultPurpose = vault.getDefaultPurpose();
    const coinName = vault.getCoinName();
    const COIN_TYPE = vault.getCoinType();

    const usedPurpose = purpose || defaultPurpose;
    const ignoreFirst = indexes[0] !== 0;
    const usedIndexes = [...(ignoreFirst ? [indexes[0] - 1] : []), ...indexes];
    const { addressEncoding } = getAccountDefaultByPurpose(
      usedPurpose,
      coinName,
    );
    const { prefix: namePrefix } = getAccountNameInfoByTemplate(impl, template);
    const provider = await (
      this.vault as unknown as BTCForkVault
    ).getProvider();

    let response;
    try {
      const { connectId, deviceId } = await this.getHardwareInfo();
      const passphraseState = await this.getWalletPassphraseState();
      await this.getHardwareSDKInstance();
      const { pathPrefix } = slicePathTemplate(template);
      response = await HardwareSDK.btcGetPublicKey(connectId, deviceId, {
        bundle: usedIndexes.map((index) => ({
          path: `${pathPrefix}/${index}'`,
          coin: coinName.toLowerCase(),
          showOnOneKey: false,
        })),
        ...passphraseState,
      });
    } catch (error: any) {
      console.error(error);
      throw new OneKeyHardwareError(error);
    }

    if (!response.success || !response.payload) {
      console.error(response.payload);
      throw convertDeviceError(response.payload);
    }

    if (response.payload.length !== usedIndexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }

    const ret = [];
    let index = 0;
    for (const { path, xpub, xpubSegwit } of response.payload) {
      const firstAddressRelPath = '0/0';
      const { [firstAddressRelPath]: address } = provider.xpubToAddresses(
        xpub,
        [firstAddressRelPath],
        addressEncoding,
      );
      const prefix = [COINTYPE_DOGE, COINTYPE_BCH].includes(COIN_TYPE)
        ? coinName
        : namePrefix;
      const name =
        (names || [])[index] || `${prefix} #${usedIndexes[index] + 1}`;
      if (!ignoreFirst || index > 0) {
        ret.push({
          id: `${this.walletId}--${path}`,
          name,
          type: AccountType.UTXO,
          path,
          coinType: COIN_TYPE,
          xpub,
          xpubSegwit: xpubSegwit || xpub,
          address,
          addresses: { [firstAddressRelPath]: address },
          template,
        });
      }

      if (usedIndexes.length === 1) {
        // Only getting the first account, ignore balance checking.
        break;
      }

      const { txs } = (await provider.getAccount(
        { type: 'simple', xpub: xpubSegwit || xpub },
        addressEncoding,
      )) as { txs: number };
      if (txs > 0) {
        index += 1;
        // blockbook API rate limit.
        await new Promise((r) => setTimeout(r, 200));
      } else {
        // Software should prevent a creation of an account
        // if a previous account does not have a transaction history (meaning none of its addresses have been used before).
        // https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki
        break;
      }
    }
    return ret;
  }

  private buildHardwareInput = async (
    input: TxInput,
    path: string,
  ): Promise<Messages.TxInputType> => {
    const { getHDPath, getScriptType } = await CoreSDKLoader();
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

  private buildHardwareOutput = async (
    output: TxOutput,
  ): Promise<Messages.TxOutputType> => {
    const { isCharge, bip44Path } = output.payload || {};

    if (isCharge && bip44Path) {
      const { getHDPath, getOutputScriptType } = await CoreSDKLoader();
      const addressN = getHDPath(bip44Path);
      const scriptType = getOutputScriptType(addressN);
      return {
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

  private buildPrevTx = (rawTx: string): RefTransaction => {
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

  async getAddress(params: IGetAddressParams): Promise<string> {
    const coinName = (this.vault as unknown as BTCForkVault).getCoinName();
    const dbAccount = (await this.getDbAccount({
      noCache: true,
    })) as DBUTXOAccount;
    const { addresses, address, path } = dbAccount;
    const pathSuffix = Object.keys(dbAccount.addresses).find(
      (key) => addresses[key] === address,
    );

    if (!pathSuffix) {
      return '';
    }

    await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const response = await HardwareSDK.btcGetAddress(connectId, deviceId, {
      path: `${path}/${pathSuffix}`,
      showOnOneKey: params.showOnOneKey,
      coin: coinName.toLowerCase(),
      ...passphraseState,
    });
    if (response.success) {
      return response.payload.address;
    }
    throw convertDeviceError(response.payload);
  }

  signMessage(): Promise<string[]> {
    throw new NotImplemented();
  }
}
