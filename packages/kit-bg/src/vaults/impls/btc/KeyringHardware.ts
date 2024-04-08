/* eslint-disable @typescript-eslint/no-unused-vars */

import BigNumber from 'bignumber.js';
import * as BitcoinJS from 'bitcoinjs-lib';

import {
  checkBtcAddressIsUsed,
  getBtcForkNetwork,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedTxPro,
  ITxInput,
  ITxOutput,
  ITxUTXO,
} from '@onekeyhq/core/src/types';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import type VaultBtc from './Vault';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignTransactionParams,
} from '../../types';
import type { RefTransaction } from '@onekeyfe/hd-core';
import type { Messages } from '@onekeyfe/hd-transport';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.btc.hd;

  async signTransaction(params: ISignTransactionParams): Promise<ISignedTxPro> {
    const { unsignedTx } = params;
    const { inputs = [], outputs = [] } = unsignedTx;
    const deviceParams = checkIsDefined(params.deviceParams);
    const vault = this.vault as VaultBtc;
    const coinName = await this.coreApi.getCoinName();
    const addresses = inputs.map((input) => input.address);
    const utxosInfo = await vault._collectUTXOsInfoByApi();

    const signers: Record<string, string> = {};
    for (const utxo of utxosInfo) {
      const { address, path } = utxo;
      if (addresses.includes(address)) {
        signers[address] = path;
      }
    }

    const prevTxids = Array.from(
      new Set(inputs.map((i) => i.utxo?.txid)),
    ).filter(Boolean);
    const prevTxs = await vault.collectTxs(prevTxids);
    const sdk = await this.getHardwareSDKInstance();

    const { connectId, deviceId } = deviceParams.dbDevice;

    const signParams = {
      coin: coinName.toLowerCase(),
      inputs: await Promise.all(
        inputs.map(async (i) => this.buildHardwareInput(i, signers[i.address])),
      ),
      outputs: await Promise.all(
        outputs.map(async (o) => this.buildHardwareOutput(o)),
      ),
      refTxs: Object.values(prevTxs).map((i) => this.buildPrevTx(i)),
    };

    const response = await sdk.btcSignTransaction(connectId, deviceId, {
      coin: coinName.toLowerCase(),
      inputs: await Promise.all(
        inputs.map(async (i) => this.buildHardwareInput(i, signers[i.address])),
      ),
      outputs: await Promise.all(
        outputs.map(async (o) => this.buildHardwareOutput(o)),
      ),
      refTxs: Object.values(prevTxs).map((i) => this.buildPrevTx(i)),
    });

    if (response.success) {
      const { serializedTx } = response.payload;
      const tx = BitcoinJS.Transaction.fromHex(serializedTx);

      return {
        txid: tx.getId(),
        rawTx: serializedTx,
        encodedTx: unsignedTx.encodedTx,
      };
    }

    throw convertDeviceError(response.payload);
  }

  private buildHardwareInput = async (
    input: ITxInput,
    path: string,
  ): Promise<Messages.TxInputType> => {
    const { getHDPath, getScriptType } = await CoreSDKLoader();
    const addressN = getHDPath(path);
    const scriptType = getScriptType(addressN);
    const utxo = input.utxo as ITxUTXO;

    // @ts-expect-error
    return {
      prev_index: utxo.vout,
      prev_hash: utxo.txid,
      amount: new BigNumber(utxo.value).toFixed(),
      address_n: addressN,
      script_type: scriptType,
    };
  };

  private buildHardwareOutput = async (
    output: ITxOutput,
  ): Promise<Messages.TxOutputType> => {
    const { isCharge, bip44Path, opReturn } = output.payload || {};

    if (opReturn && typeof opReturn === 'string' && opReturn.length > 0) {
      return {
        script_type: 'PAYTOOPRETURN',
        amount: '0',
        op_return_data: bufferUtils.bytesToHex(Buffer.from(opReturn)),
      };
    }
    if (isCharge && bip44Path) {
      const { getHDPath, getOutputScriptType } = await CoreSDKLoader();
      const addressN = getHDPath(bip44Path);
      const scriptType = getOutputScriptType(addressN);
      return {
        script_type: scriptType,
        address_n: addressN,
        amount: new BigNumber(output.value).toFixed(),
      };
    }

    return {
      script_type: 'PAYTOADDRESS',
      address: output.address,
      amount: new BigNumber(output.value).toFixed(),
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

  async signMessage(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const networkInfo = await this.getCoreApiNetworkInfo();
    const network = getBtcForkNetwork(networkInfo.networkChainCode);
    const addressEncoding = params.deriveInfo?.addressEncoding;

    return this.basePrepareHdUtxoAccounts(params, {
      checkIsAccountUsed: checkBtcAddressIsUsed,
      buildAddressesInfo: async ({ usedIndexes }) => {
        const isChange = false;
        const addressIndex = 0;

        const publicKeys = await this.baseGetDeviceAccountPublicKeys({
          params,
          usedIndexes,
          sdkGetPublicKeysFn: async ({
            connectId,
            deviceId,
            pathPrefix,
            coinName,
            showOnOnekeyFn,
          }) => {
            const sdk = await this.getHardwareSDKInstance();
            const response = await sdk.btcGetPublicKey(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams, // passpharse params
              bundle: usedIndexes.map((index, arrIndex) => ({
                path: `${pathPrefix}/${index}'`,
                coin: coinName?.toLowerCase(),
                showOnOneKey: showOnOnekeyFn(arrIndex),
              })),
            });
            return response;
          },
        });

        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < publicKeys.length; i += 1) {
          const item = publicKeys[i];
          const { path, xpub, xpubSegwit } = item;
          const addressRelPath = `${isChange ? '1' : '0'}/${addressIndex}`;
          const { addresses: addressFromXpub } =
            await this.coreApi.getAddressFromXpub({
              network,
              xpub,
              relativePaths: [addressRelPath],
              addressEncoding,
            });
          const { [addressRelPath]: address } = addressFromXpub;
          const addressInfo: ICoreApiGetAddressItem = {
            address,
            publicKey: '', // TODO return pub from getAddressFromXpub
            path,
            relPath: addressRelPath,
            xpub,
            xpubSegwit,
            addresses: {
              [addressRelPath]: address,
            },
          };
          ret.push(addressInfo);
        }
        return ret;
      },
    });
  }
}
