/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import type {
  ICoreApiGetAddressItem,
  ISignedMessageItemPro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import type {
  AirGapUR,
  IAirGapGenerateSignRequestParams,
  IAirGapSignature,
} from '@onekeyhq/qr-wallet-sdk';
import { OneKeyRequestDeviceQR } from '@onekeyhq/qr-wallet-sdk/src/OneKeyRequestDeviceQR';
import {
  NotImplemented,
  OneKeyErrorAirGapInvalidQrCode,
} from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type {
  INetworkAccount,
  IQrWalletAirGapAccount,
} from '@onekeyhq/shared/types/account';

import localDb from '../../dbs/local/localDb';
import { UR_DEFAULT_ORIGIN } from '../../services/ServiceQrWallet/qrWalletConsts';
import { EVaultKeyringTypes } from '../types';

import { KeyringBase } from './KeyringBase';

import type { IDBWallet } from '../../dbs/local/types';
import type {
  IPrepareQrAccountsParams,
  IGetChildPathTemplatesParams as IQrWalletGetChildPathTemplatesParams,
  IGetChildPathTemplatesResult as IQrWalletGetChildPathTemplatesResult,
  IQrWalletGetVerifyAddressChainParamsQuery,
  IQrWalletGetVerifyAddressChainParamsResult,
  ISignMessageParams,
  ISignTransactionParams,
} from '../types';

export abstract class KeyringQrBase extends KeyringBase {
  override keyringType: EVaultKeyringTypes = EVaultKeyringTypes.qr;

  async generateSignRequest(
    params: IAirGapGenerateSignRequestParams,
  ): Promise<AirGapUR> {
    throw new NotImplemented();
  }

  async parseSignature(ur: AirGapUR): Promise<IAirGapSignature> {
    throw new NotImplemented();
  }

  getChildPathTemplates(
    params: IQrWalletGetChildPathTemplatesParams,
  ): IQrWalletGetChildPathTemplatesResult {
    throw new NotImplemented();
  }

  async getVerifyAddressChainParams(
    query: IQrWalletGetVerifyAddressChainParamsQuery,
  ): Promise<IQrWalletGetVerifyAddressChainParamsResult> {
    throw new NotImplemented();
  }

  async baseSignByQrcode<T extends ISignedMessageItemPro | ISignedTxPro>(
    params: ISignTransactionParams | ISignMessageParams,
    options: {
      signRequestUrBuilder: (params: {
        path: string;
        account: INetworkAccount;
        wallet: IDBWallet;
        chainId: string;
        requestId: string;
        xfp: string;
      }) => Promise<AirGapUR>;
      signedResultBuilder: (params: {
        signature: IAirGapSignature;
      }) => Promise<T>;
    },
  ): Promise<T> {
    const wallet = await localDb.getWallet({ walletId: this.walletId });
    if (!wallet.associatedDevice) {
      throw new Error('associatedDevice not found');
    }
    const device = await localDb.getDevice(wallet.associatedDevice);
    const path = await this.vault.getAccountPath();
    const account = await this.vault.getAccount();
    const chainId = await this.vault.getNetworkChainId();
    const requestId = generateUUID();

    const { airGapAccount } = await this.findAirGapAccountByPath({
      path,
      wallet,
      index: checkIsDefined(account.pathIndex),
    });
    const xfp = airGapAccount?.xfp || wallet.xfp;
    if (!xfp) {
      throw new Error('xfp not found');
    }
    const signRequestUr = await options.signRequestUrBuilder({
      requestId,
      path,
      xfp,
      chainId,
      account,
      wallet,
    });

    const { responseUr: signatureUr } =
      await this.backgroundApi.serviceQrWallet.startTwoWayAirGapScanUr({
        requestUr: signRequestUr,
      });

    let sig: IAirGapSignature | undefined;
    try {
      sig = await this.parseSignature(checkIsDefined(signatureUr));
    } catch (error) {
      console.error(error);
      throw new OneKeyErrorAirGapInvalidQrCode();
    }

    if (sig.requestId !== requestId) {
      console.error(new Error('Signature requestId not match'));
      throw new OneKeyErrorAirGapInvalidQrCode();
    }

    // TODO do not check origin, device give origin is not reliable
    // if (sig.origin !== device.name) {
    //   console.error(new Error('Signature origin not match'));
    //   throw new OneKeyErrorAirGapInvalidQrCode();
    // }

    return options.signedResultBuilder({ signature: sig });
  }

  async findAirGapAccountByPath({
    path: fullPath,
    wallet,
    index,
  }: {
    path: string;
    wallet: IDBWallet;
    index: number;
  }): Promise<{
    airGapAccount: IQrWalletAirGapAccount | undefined;
    fullPath: string;
    childPathTemplate: string | undefined;
  }> {
    let childPathTemplate: string | undefined;
    const settings = await this.getVaultSettings();
    // settings.accountDeriveInfo;
    const airGapAccount = wallet?.airGapAccountsInfo?.accounts?.find(
      (eachAirGapAccount: IQrWalletAirGapAccount) => {
        // airGapAccount.path may be fullPath already
        if (eachAirGapAccount.path === fullPath) {
          return true;
        }
        const { childPathTemplates } = this.getChildPathTemplates({
          airGapAccount: eachAirGapAccount,
          index,
        });
        for (const childPathTpl of childPathTemplates) {
          const template = [eachAirGapAccount.path, childPathTpl]
            .filter(Boolean)
            .join('/');
          const fullPathGenerated = accountUtils.buildPathFromTemplate({
            template,
            index,
          });
          const r = fullPathGenerated === fullPath;
          if (r) {
            childPathTemplate = childPathTpl;
            return true;
          }
        }
        return false;
      },
    );
    return { airGapAccount, fullPath, childPathTemplate };
  }

  async findQrWalletAirGapAccount(
    params: IPrepareQrAccountsParams,
    {
      index,
      wallet,
    }: {
      index: number;
      wallet: IDBWallet;
    },
  ) {
    const fullPath = accountUtils.buildPathFromTemplate({
      template: params.deriveInfo.template,
      index,
    });
    // const items =
    //   await this.backgroundApi.serviceNetwork.getDeriveInfoItemsOfNetwork({
    //     networkId: this.networkId,
    //   });
    return this.findAirGapAccountByPath({
      wallet,
      index,
      path: fullPath,
    });
  }

  async verifyQrWalletAddressByTwoWayScan(
    params: IPrepareQrAccountsParams,
    {
      indexes,
    }: {
      indexes: number[];
    },
  ): Promise<ICoreApiGetAddressItem[]> {
    const ret: ICoreApiGetAddressItem[] = [];
    const chain =
      await this.backgroundApi.serviceQrWallet.getDeviceChainNameByNetworkId({
        networkId: this.networkId,
      });

    const wallet = await this.backgroundApi.serviceAccount.getWallet({
      walletId: this.walletId,
    });

    const fullPath = accountUtils.buildPathFromTemplate({
      template: params.deriveInfo.template,
      index: indexes[0],
    });

    const requestQR = new OneKeyRequestDeviceQR({
      requestId: generateUUID(),
      xfp: wallet.xfp || '',
      // deviceId: byDevice?.deviceId || '',
      origin: UR_DEFAULT_ORIGIN,

      //
      method: 'verifyAddress',
      params: [
        {
          chain,
          address: '',
          path: fullPath, // fullPath
          ...(await this.getVerifyAddressChainParams({
            fullPath,
          })),
        },
      ],
    });

    console.log('verifyAddressByTwoWayScan', requestQR);

    const requestUr = requestQR.toUR();
    const { raw } =
      await this.backgroundApi.serviceQrWallet.startTwoWayAirGapScanUr({
        requestUr,
        allowPlainTextResponse: true,
      });
    ret.push({
      address: raw || '',
      publicKey: '',
      path: fullPath,
      xpub: '',
      relPath: accountUtils.buildUtxoAddressRelPath(),
      addresses: {},
    });
    return ret;
  }
}
