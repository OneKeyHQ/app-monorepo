import bs58check from 'bs58check';

import {
  checkBtcAddressIsUsed,
  getBtcForkNetwork,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { decrypt } from '@onekeyhq/core/src/secret';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';

import { KeyringHdBase } from '../../base/KeyringHdBase';

import type { IDBAccount, IDBUtxoAccount } from '../../../dbs/local/types';
import type {
  IExportAccountSecretKeysParams,
  IExportAccountSecretKeysResult,
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.btc.hd;

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    return this.baseGetPrivateKeys(params);
  }

  override async exportAccountSecretKeys(
    params: IExportAccountSecretKeysParams,
  ): Promise<IExportAccountSecretKeysResult> {
    const { password } = params;
    const result: IExportAccountSecretKeysResult = {};
    const account = await this.vault.getAccount();
    const networkInfo = await this.getCoreApiNetworkInfo();
    const network = getBtcForkNetwork(networkInfo.networkChainCode);

    if (params.xprvt) {
      const { deriveInfo } =
        await this.backgroundApi.serviceNetwork.getDeriveTypeByTemplate({
          networkId: this.networkId,
          template: account.template,
        });
      const addressEncoding = deriveInfo?.addressEncoding;
      if (!addressEncoding) {
        throw new Error('addressEncoding not found');
      }
      const versionBytesInfo =
        (network.segwitVersionBytes || {})[addressEncoding] || network.bip32;
      const xprvVersionBytes = versionBytesInfo?.private;
      if (!xprvVersionBytes) {
        throw new Error('xprvVersionBytes not found');
      }

      const privateKeysMap = await this.getPrivateKeys({
        password,
        // relPaths: ['0/0'],
      });
      const [encryptedPrivateKey] = Object.values(privateKeysMap);
      result.xprvt = bs58check.encode(
        Buffer.from(bs58check.decode((account as IDBUtxoAccount).xpub))
          .fill(
            Buffer.from(xprvVersionBytes.toString(16).padStart(8, '0'), 'hex'),
            0,
            4,
          )
          .fill(
            Buffer.concat([
              Buffer.from([0]),
              decrypt(password, encryptedPrivateKey),
            ]),
            45,
            78,
          ),
      );
    }

    return result;
  }

  override async prepareAccounts(
    params: IPrepareHdAccountsParams,
  ): Promise<IDBAccount[]> {
    const sdkBtc = await import('@onekeyhq/core/src/chains/btc/sdkBtc');
    sdkBtc.initBitcoinEcc();

    return this.basePrepareAccountsHdUtxo(params, {
      checkIsAccountUsed: checkBtcAddressIsUsed,
    });
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    return this.baseSignTransactionBtc(params);
  }

  override async signMessage(params: ISignMessageParams): Promise<string[]> {
    return this.baseSignMessageBtc(params);
  }
}
