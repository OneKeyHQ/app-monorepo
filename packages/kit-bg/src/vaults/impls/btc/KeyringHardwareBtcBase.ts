/* eslint-disable @typescript-eslint/no-unused-vars */

import BigNumber from 'bignumber.js';
import * as BitcoinJS from 'bitcoinjs-lib';

import type CoreChainSoftwareBtc from '@onekeyhq/core/src/chains/btc/CoreChainSoftware';
import {
  checkBtcAddressIsUsed,
  getBtcForkNetwork,
  isTaprootPath,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import type {
  IBtcInput,
  IBtcOutput,
  IEncodedTxBtc,
} from '@onekeyhq/core/src/chains/btc/types';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { AddressNotSupportSignMethodError } from '@onekeyhq/shared/src/errors';
import {
  convertDeviceError,
  convertDeviceResponse,
} from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import type VaultBtc from './Vault';
import type { IDBAccount, IDBUtxoAccount } from '../../../dbs/local/types';
import type {
  IBuildPrepareAccountsPrefixedPathParams,
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';
import type { RefTransaction } from '@onekeyfe/hd-core';
import type { HDNodeType, Messages } from '@onekeyfe/hd-transport';

export abstract class KeyringHardwareBtcBase extends KeyringHardwareBase {
  abstract override coreApi: CoreChainSoftwareBtc | undefined;

  override buildPrepareAccountsPrefixedPath(
    params: IBuildPrepareAccountsPrefixedPathParams,
  ): string {
    const fullPath = accountUtils.buildPathFromTemplate({
      template: params.template,
      index: params.index,
    });
    return accountUtils.removePathLastSegment({
      path: fullPath,
      removeCount: 2,
    });
  }

  async signTransaction(params: ISignTransactionParams): Promise<ISignedTxPro> {
    const { unsignedTx } = params;

    const { psbtHex, inputsToSign } = unsignedTx.encodedTx as IEncodedTxBtc;

    if (psbtHex && inputsToSign) {
      return this.signPsbt(params);
    }

    const { inputs, outputs } = unsignedTx.encodedTx as IEncodedTxBtc;
    const { dbDevice, deviceCommonParams } = checkIsDefined(
      params.deviceParams,
    );
    const network = await this.getNetwork();
    const vault = this.vault as VaultBtc;
    const coinName = await checkIsDefined(this.coreApi).getCoinName({
      network,
    });
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
    const prevTxs = await vault.collectTxsByApi(prevTxids);
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

  async signPsbt(params: ISignTransactionParams): Promise<ISignedTxPro> {
    const { unsignedTx, signOnly } = params;
    const { psbtHex, inputsToSign } = unsignedTx.encodedTx as IEncodedTxBtc;
    if (!psbtHex || !inputsToSign) {
      throw new Error('invalid psbt');
    }

    const dbAccount = (await this.vault.getAccount()) as IDBUtxoAccount;
    if (!isTaprootPath(dbAccount.path)) {
      throw new AddressNotSupportSignMethodError();
    }

    const network = await this.getNetwork();
    const coinName = await checkIsDefined(this.coreApi).getCoinName({
      network,
    });
    const sdk = await this.getHardwareSDKInstance();
    const { dbDevice, deviceCommonParams } = checkIsDefined(
      params.deviceParams,
    );
    const { connectId, deviceId } = dbDevice;
    // get fingerprint from device
    const pubkeyResult = await convertDeviceResponse(() =>
      sdk.btcGetPublicKey(connectId, deviceId, {
        ...deviceCommonParams,
        path: dbAccount.path,
        showOnOneKey: false,
      }),
    );

    const fingerprint = Number(pubkeyResult.root_fingerprint || 0)
      .toString(16)
      .padStart(8, '0');

    const networkInfo = await this.getCoreApiNetworkInfo();
    const btcNetwork = getBtcForkNetwork(networkInfo.networkChainCode);
    const psbt = BitcoinJS.Psbt.fromHex(psbtHex, {
      network: btcNetwork,
      maximumFeeRate: btcNetwork.maximumFeeRate,
    });
    for (let i = 0, len = inputsToSign.length; i < len; i += 1) {
      const input = inputsToSign[i];
      psbt.updateInput(input.index, {
        tapBip32Derivation: [
          {
            masterFingerprint: Buffer.from(fingerprint, 'hex'),
            pubkey: Buffer.from(input.publicKey, 'hex').subarray(1, 33),
            path: `${dbAccount.path}/${dbAccount.relPath ?? '0/0'}`,
            leafHashes: [],
          },
        ],
      });
    }

    for (let i = 0, len = psbt.txOutputs.length; i < len; i += 1) {
      const output = psbt.txOutputs[i];
      try {
        // If the address is the change address
        if (output.address === dbAccount.address && len > 1) {
          psbt.updateOutput(i, {
            tapInternalKey: Buffer.from(
              checkIsDefined(dbAccount.pub),
              'hex',
            ).subarray(1, 33),
            tapBip32Derivation: [
              {
                masterFingerprint: Buffer.from(fingerprint, 'hex'),
                pubkey: Buffer.from(
                  checkIsDefined(dbAccount.pub),
                  'hex',
                ).subarray(1, 33),
                path: `${dbAccount.path}/${dbAccount.relPath ?? '0/0'}`,
                leafHashes: [],
              },
            ],
          });
        }
      } catch (err) {
        //
      }
    }

    const response = await convertDeviceResponse(() =>
      sdk.btcSignPsbt(connectId, deviceId, {
        ...deviceCommonParams,
        psbt: psbt.toHex(),
        coin: coinName?.toLowerCase(),
      }),
    );

    const signedPsbt = response.psbt;

    let rawTx = '';
    const finalizedPsbt = BitcoinJS.Psbt.fromHex(signedPsbt, {
      network: btcNetwork,
    });
    inputsToSign.forEach((v) => {
      finalizedPsbt.finalizeInput(v.index);
    });
    if (!signOnly) {
      rawTx = finalizedPsbt.extractTransaction().toHex();
    }

    return {
      encodedTx: unsignedTx.encodedTx,
      txid: '',
      rawTx,
      psbtHex: signedPsbt,
      finalizedPsbtHex: finalizedPsbt.toHex(),
    };
  }

  async signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    const network = await this.getNetwork();
    const coinName = await checkIsDefined(this.coreApi).getCoinName({
      network,
    });
    const dbAccount = await this.vault.getAccount();
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const sdk = await this.getHardwareSDKInstance();
    const result = await Promise.all(
      params.messages.map(async ({ message, type }) => {
        const dAppSignType = (type as 'ecdsa' | 'bip322-simple') || undefined;

        if (dAppSignType && !isTaprootPath(dbAccount.path)) {
          throw new AddressNotSupportSignMethodError();
        }

        const response = await sdk.btcSignMessage(connectId, deviceId, {
          ...params.deviceParams?.deviceCommonParams,
          path: `${dbAccount.path}/${dbAccount.relPath ?? '0/0'}`,
          coin: coinName,
          messageHex: Buffer.from(message).toString('hex'),
          dAppSignType,
        });
        if (!response.success) {
          throw convertDeviceError(response.payload);
        }
        return { message, signature: response.payload.signature };
      }),
    );
    return result.map((ret) => ret.signature);
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const networkInfo = await this.getCoreApiNetworkInfo();
    const network = getBtcForkNetwork(networkInfo.networkChainCode);
    const addressEncoding = params.deriveInfo?.addressEncoding;
    const addressRelPath = accountUtils.buildUtxoAddressRelPath();

    return this.basePrepareHdUtxoAccounts(params, {
      checkIsAccountUsed: checkBtcAddressIsUsed,
      buildAddressesInfo: async ({ usedIndexes }) => {
        const publicKeys = await this.baseGetDeviceAccountPublicKeys({
          params,
          usedIndexes,
          sdkGetPublicKeysFn: async ({
            connectId,
            deviceId,
            template,
            coinName,
            showOnOnekeyFn,
          }) => {
            const buildFullPath = (p: { index: number }) =>
              accountUtils.buildPathFromTemplate({
                template,
                index: p.index,
              });
            const buildPrefixedPath = (p: { index: number }) =>
              this.buildPrepareAccountsPrefixedPath({
                template,
                index: p.index,
              });

            const allNetworkAccounts = await this.getAllNetworkPrepareAccounts({
              params,
              usedIndexes,
              hwSdkNetwork: this.hwSdkNetwork,
              buildPath: buildPrefixedPath,
              buildResultAccount: ({ account, index }) => ({
                path: account.path,
                xpub: account.payload?.xpub || '',
                xpubSegwit: account.payload?.xpubSegwit || '',
                node: account.payload?.node || ({} as HDNodeType),
              }),
            });
            if (allNetworkAccounts) {
              return allNetworkAccounts;
            }
            throw new Error('use sdk allNetworkGetAddress instead');

            // const sdk = await this.getHardwareSDKInstance();
            // defaultLogger.account.accountCreatePerf.sdkBtcGetPublicKey();
            // const response = await sdk.btcGetPublicKey(connectId, deviceId, {
            //   ...params.deviceParams.deviceCommonParams, // passpharse params
            //   bundle: usedIndexes.map((index, arrIndex) => ({
            //     path: `${pathPrefix}/${index}'`,
            //     coin: coinName?.toLowerCase(),
            //     showOnOneKey: showOnOnekeyFn(arrIndex),
            //   })),
            // });
            // defaultLogger.account.accountCreatePerf.sdkBtcGetPublicKeyDone({
            //   deriveTypeLabel: params.deriveInfo?.label ?? '',
            //   indexes: usedIndexes,
            //   coinName,
            // });
            // return response;
          },
        });

        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < publicKeys.length; i += 1) {
          const item = publicKeys[i];
          const { path, xpub, xpubSegwit } = item;

          const { addresses: addressFromXpub, publicKeys: publicKeysMap } =
            await checkIsDefined(this.coreApi).getAddressFromXpub({
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
