/* eslint-disable @typescript-eslint/no-unused-vars */
import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import type {
  IEncodedTxAlgo,
  IEncodedTxGroupAlgo,
} from '@onekeyhq/core/src/chains/algo/types';
import {
  decodeSensitiveText,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
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
import sdkAlgo from './sdkAlgo';
import ClientAlgo from './sdkAlgo/ClientAlog';
import { encodeTransaction } from './utils';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  ITransferInfo,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';

export default class Vault extends VaultBase {
  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  _getSuggestedParams = memoizee(
    async () => {
      const client = await this.getClient();
      return client.getSuggestedParams();
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  _getClientCache = memoizee(
    async () =>
      new ClientAlgo({
        networkId: this.networkId,
        backgroundApi: this.backgroundApi,
      }),
    {
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  async getClient() {
    return this._getClientCache();
  }

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId } = params;

    const address = account.address || '';

    const { normalizedAddress, displayAddress, isValid } =
      await this.validateAddress(address);
    return {
      networkId,
      normalizedAddress,
      displayAddress,
      address: displayAddress,
      baseAddress: normalizedAddress,
      isValid,
      allowEmptyAddress: false,
    };
  }

  override buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxAlgo | IEncodedTxGroupAlgo> {
    const { transfersInfo } = params;

    if (transfersInfo && !isEmpty(transfersInfo)) {
      if (transfersInfo.length === 1) {
        return this._buildEncodedTxFromTransfer({
          transferInfo: transfersInfo[0],
        });
      }
      throw new OneKeyInternalError('Batch transfers not supported');
    }

    throw new OneKeyInternalError();
  }

  async _buildEncodedTxFromTransfer(params: { transferInfo: ITransferInfo }) {
    const { transferInfo } = params;
    const tx = await this._buildAlgoTxFromTransferInfo(transferInfo);
    return encodeTransaction(tx);
  }

  async _buildAlgoTxFromTransferInfo(transferInfo: ITransferInfo) {
    if (!transferInfo.to) {
      throw new Error('Invalid transferInfo.to params');
    }
    const { from, to, amount, tokenInfo } = transferInfo;

    if (!tokenInfo) {
      throw new Error(
        'buildEncodedTx ERROR: transferInfo.tokenInfo is missing',
      );
    }

    const suggestedParams = await this._getSuggestedParams();
    if (tokenInfo.isNative) {
      return sdkAlgo.makePaymentTxnWithSuggestedParamsFromObject({
        amount: BigInt(
          new BigNumber(amount).shiftedBy(tokenInfo.decimals).toFixed(),
        ),
        from,
        to,
        suggestedParams,
      });
    }

    return sdkAlgo.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: BigInt(
        new BigNumber(amount).shiftedBy(tokenInfo.decimals).toFixed(),
      ),
      assetIndex: parseInt(tokenInfo.address),
      from,
      to,
      suggestedParams,
    });
  }

  override buildDecodedTx(params: IBuildDecodedTxParams): Promise<IDecodedTx> {
    throw new Error('Method not implemented.');
  }

  override buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    throw new Error('Method not implemented.');
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
    if (sdkAlgo.isValidAddress(address)) {
      return Promise.resolve({
        isValid: true,
        displayAddress: address,
        normalizedAddress: address,
      });
    }
    return Promise.resolve({
      isValid: false,
      displayAddress: '',
      normalizedAddress: '',
    });
  }

  override validateXpub(xpub: string): Promise<IXpubValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    const input = decodeSensitiveText({ encodedText: params.input });
    let privateKey = Buffer.from(sdkAlgo.seedFromMnemonic(input)).toString(
      'hex',
    );
    privateKey = encodeSensitiveText({ text: privateKey });
    return Promise.resolve({
      privateKey,
    });
  }

  override validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    try {
      const seed = sdkAlgo.seedFromMnemonic(privateKey);
      if (seed) {
        return Promise.resolve({
          isValid: true,
        });
      }
    } catch {
      // pass
    }

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
