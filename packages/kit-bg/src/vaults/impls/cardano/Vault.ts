/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import {
  decodePrivateKeyByXprv,
  validBootstrapAddress,
  validShelleyAddress,
} from '@onekeyhq/core/src/chains/ada/sdkAda';
import type {
  IAdaUTXO,
  IEncodedTxAda,
} from '@onekeyhq/core/src/chains/ada/types';
import {
  decodeSensitiveText,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  InsufficientBalance,
  InvalidAddress,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import sdk from './sdkCardano';
import { getChangeAddress } from './sdkCardano/cardanoUtils';
import settings from './settings';

import type { IDBUtxoAccount, IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
  IVaultSettings,
} from '../../types';

export default class Vault extends VaultBase {
  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId } = params;
    const { address } = account;
    return Promise.resolve({
      networkId,
      normalizedAddress: address,
      displayAddress: address,
      address,
      baseAddress: address,
      isValid: true,
      allowEmptyAddress: false,
    });
  }

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxAda> {
    const { transfersInfo } = params;
    if (!transfersInfo || isEmpty(transfersInfo)) {
      throw new OneKeyInternalError('transfersInfo is required');
    }
    if (transfersInfo.length > 1) {
      throw new OneKeyInternalError('Only one transfer is allowed');
    }
    const transferInfo = transfersInfo[0];
    if (!transferInfo.to) {
      throw new Error('buildEncodedTx ERROR: transferInfo.to is missing');
    }
    const { to, amount, tokenInfo } = transferInfo;
    const dbAccount = (await this.getAccount()) as IDBUtxoAccount;
    const { path, addresses } = dbAccount;
    const network = await this.getNetwork();
    const { decimals, feeMeta } = network;
    const utxos = await this._collectUTXOsInfoByApi({
      address: dbAccount.address,
      path,
      addresses,
    });
    const amountBN = new BigNumber(amount);

    let output;
    if (tokenInfo?.address) {
      output = {
        address: to,
        amount: undefined,
        assets: [
          {
            quantity: amountBN.shiftedBy(tokenInfo?.decimals).toFixed(),
            unit: tokenInfo?.address,
          },
        ],
      };
    } else {
      output = {
        address: to,
        amount: amountBN.shiftedBy(decimals).toFixed(),
        assets: [],
      };
    }

    const CardanoApi = await sdk.getCardanoApi();
    let txPlan: Awaited<ReturnType<typeof CardanoApi.composeTxPlan>>;
    try {
      txPlan = await CardanoApi.composeTxPlan(
        transferInfo,
        dbAccount.xpub,
        // @ts-expect-error
        utxos,
        dbAccount.address,
        [output as any],
      );
    } catch (e: any) {
      const utxoValueTooSmall = 'UTXO_VALUE_TOO_SMALL';
      const insufficientBalance = 'UTXO_BALANCE_INSUFFICIENT';
      if (
        [utxoValueTooSmall, insufficientBalance].includes(e.code) ||
        [utxoValueTooSmall, insufficientBalance].includes(e.message)
      ) {
        throw new InsufficientBalance();
      }
      throw e;
    }

    const changeAddress = getChangeAddress(dbAccount);

    // @ts-expect-error
    const { fee, inputs, outputs, totalSpent, tx } = txPlan;
    const totalFeeInNative = new BigNumber(fee)
      .shiftedBy(-1 * feeMeta.decimals)
      .toFixed();

    return {
      inputs,
      outputs,
      fee,
      totalSpent,
      totalFeeInNative,
      tx,
      changeAddress,
      signOnly: false,
    };
  }

  override buildDecodedTx(params: IBuildDecodedTxParams): Promise<IDecodedTx> {
    throw new Error('Method not implemented.');
  }

  _collectUTXOsInfoByApi = memoizee(
    async (params: {
      address: string;
      path: string;
      addresses: Record<string, string>;
    }): Promise<IAdaUTXO[]> => {
      const { addresses, path, address } = params;
      const stakeAddress = addresses['2/0'];
      try {
        const { utxoList } =
          await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
            networkId: this.networkId,
            accountAddress: address,
            xpub: stakeAddress,
            withUTXOList: true,
          });
        if (!utxoList || isEmpty(utxoList)) {
          throw new OneKeyInternalError('Failed to get UTXO list.');
        }

        const pathIndex = path.split('/')[3];

        return utxoList.map((utxo) => {
          let { path: utxoPath } = utxo;
          if (utxoPath && utxoPath.length > 0) {
            const pathArray = utxoPath.split('/');
            pathArray.splice(3, 1, pathIndex);
            utxoPath = pathArray.join('/');
          }
          return {
            ...utxo,
            tx_hash: utxo.txid,
            tx_index: undefined,
            path: utxoPath,
            output_index: utxo.vout,
            amount: utxo.amount ?? [],
          };
        });
      } catch (e) {
        throw new OneKeyInternalError('Failed to get UTXO list.');
      }
    },
    {
      promise: true,
      max: 1,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 30 }),
    },
  );

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = await this.buildEncodedTx(params);
    if (encodedTx) {
      return {
        encodedTx,
        transfersInfo: params.transfersInfo,
      };
    }
    throw new OneKeyInternalError('Failed to build unsigned tx');
  }

  override updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override validateAddress(address: string): Promise<IAddressValidation> {
    if (address.length < 35) {
      return Promise.reject(new InvalidAddress());
    }
    if (validShelleyAddress(address) || validBootstrapAddress(address)) {
      return Promise.resolve({
        isValid: true,
        normalizedAddress: address,
        displayAddress: address,
      });
    }
    return Promise.reject(new InvalidAddress());
  }

  override validateXpub(xpub: string): Promise<IXpubValidation> {
    throw new Error('Method not implemented.');
  }

  override getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    const input = decodeSensitiveText({ encodedText: params.input });
    let privateKey = bufferUtils.bytesToHex(decodePrivateKeyByXprv(input));
    privateKey = encodeSensitiveText({ text: privateKey });
    return Promise.resolve({ privateKey });
  }

  override validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    const isValid = /^xprv/.test(xprvt) && xprvt.length >= 165;
    return Promise.resolve({ isValid });
  }

  override async validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }
}
