/* eslint-disable @typescript-eslint/no-unused-vars */

import BigNumber from 'bignumber.js';
import * as BitcoinJS from 'bitcoinjs-lib';

import {
  checkBtcAddressIsUsed,
  getBtcForkNetwork,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import type {
  IBtcInput,
  IBtcOutput,
  IEncodedTxBtc,
} from '@onekeyhq/core/src/chains/btc/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
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
    const { inputs, outputs } = unsignedTx.encodedTx as IEncodedTxBtc;
    const { dbDevice, deviceCommonParams } = checkIsDefined(
      params.deviceParams,
    );
    const network = await this.getNetwork();
    const vault = this.vault as VaultBtc;
    const coinName = await this.coreApi.getCoinName({ network });
    const addresses = inputs.map((input) => input.address);
    const { utxoList: utxosInfo } = await vault._collectUTXOsInfoByApi();

    const signers: Record<string, string> = {};
    for (const utxo of utxosInfo) {
      const { address, path } = utxo;
      if (addresses.includes(address)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        signers[address] = path;
      }
    }

    const prevTxids = Array.from(new Set(inputs.map((i) => i.txid))).filter(
      Boolean,
    );
    const prevTxs = await vault.collectTxs(prevTxids);
    const sdk = await this.getHardwareSDKInstance();

    const { connectId, deviceId } = dbDevice;

    const response = await sdk.btcSignTransaction(connectId, deviceId, {
      coin: coinName.toLowerCase(),
      inputs: await Promise.all(
        inputs.map(async (i) => this.buildHardwareInput(i, signers[i.address])),
      ),
      outputs: await Promise.all(
        outputs.map(async (o) => this.buildHardwareOutput(o)),
      ),
      refTxs: Object.values(prevTxs).map((i) => this.buildPrevTx(i)),
      ...deviceCommonParams,
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
    input: IBtcInput,
    path: string,
  ): Promise<Messages.TxInputType> => {
    const { getHDPath, getScriptType } = await CoreSDKLoader();
    const addressN = getHDPath(path);
    const scriptType = getScriptType(addressN);

    // @ts-expect-error
    return {
      prev_index: input.vout,
      prev_hash: input.txid,
      amount: new BigNumber(input.value).toFixed(),
      address_n: addressN,
      script_type: scriptType,
    };
  };

  private buildHardwareOutput = async (
    output: IBtcOutput,
  ): Promise<Messages.TxOutputType> => {
    const { isChange, bip44Path, opReturn } = output.payload || {};

    if (opReturn && typeof opReturn === 'string' && opReturn.length > 0) {
      return {
        script_type: 'PAYTOOPRETURN',
        amount: '0',
        op_return_data: bufferUtils.bytesToHex(Buffer.from(opReturn)),
      };
    }
    if (isChange && bip44Path) {
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
    throw new NotImplemented();
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
          const addressRelPath = accountUtils.buildUtxoAddressRelPath();
          const { addresses: addressFromXpub, publicKeys: publicKeysMap } =
            await this.coreApi.getAddressFromXpub({
              network,
              xpub,
              relativePaths: [addressRelPath],
              addressEncoding,
            });
          const { [addressRelPath]: publicKey } = publicKeysMap;
          const { [addressRelPath]: address } = addressFromXpub;

          const addressInfo: ICoreApiGetAddressItem = {
            address,
            publicKey,
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

  override async batchGetAddresses(params: IPrepareHardwareAccountsParams) {
    const { indexes } = params;
    const addresses = await this.baseGetDeviceAccountAddresses({
      params,
      usedIndexes: indexes,
      sdkGetAddressFn: async ({
        connectId,
        deviceId,
        pathPrefix,
        pathSuffix,
        coinName,
        showOnOnekeyFn,
      }) => {
        const sdk = await this.getHardwareSDKInstance();

        const response = await sdk.btcGetAddress(connectId, deviceId, {
          ...params.deviceParams.deviceCommonParams,
          bundle: indexes.map((index, arrIndex) => ({
            path: `${pathPrefix}/${pathSuffix.replace('{index}', `${index}`)}`,
            coin: coinName?.toLowerCase(),
            showOnOneKey: showOnOnekeyFn(arrIndex),
          })),
        });
        return response;
      },
    });

    return addresses.map((item) => ({
      path: item.path ?? '',
      address: item.address ?? '',
    }));
  }
}
