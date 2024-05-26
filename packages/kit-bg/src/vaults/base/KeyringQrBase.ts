/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import type {
  ISignedMessageItemPro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import type {
  AirGapUR,
  IAirGapAccount,
  IAirGapGenerateSignRequestParams,
  IAirGapSignature,
} from '@onekeyhq/qr-wallet-sdk';
import { airGapUrUtils } from '@onekeyhq/qr-wallet-sdk';
import {
  NotImplemented,
  OneKeyErrorAirGapInvalidQrCode,
} from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type {
  INetworkAccount,
  IQrWalletAirGapAccount,
} from '@onekeyhq/shared/types/account';

import localDb from '../../dbs/local/localDb';
import { EVaultKeyringTypes } from '../types';

import { KeyringBase } from './KeyringBase';

import type { IDBWallet } from '../../dbs/local/types';
import type {
  IAnimationValue,
  IQRCodeHandlerParseResult,
} from '../../services/ServiceScanQRCode/utils/parseQRCode/type';
import type {
  IPrepareHardwareAccountsParams,
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

  buildAirGapAccountChildPathTemplate(params: {
    airGapAccount: IAirGapAccount;
  }): string {
    throw new NotImplemented();
  }

  async startTwoWayQrcodeScan(deviceScanApp: AirGapUR): Promise<AirGapUR> {
    // **** 2. app scan device Qrcode
    const appScanDeviceResult = await new Promise<
      IQRCodeHandlerParseResult<IAnimationValue>
    >((resolve, reject) => {
      const promiseId = this.backgroundApi.servicePromise.createCallback({
        resolve,
        reject,
      });
      // **** 1. Device scan App Qrcode
      appEventBus.emit(EAppEventBusNames.ShowQrcode, {
        drawType: 'animated',
        valueUr: airGapUrUtils.urToJson({ ur: deviceScanApp }),
        promiseId,
      });
    });

    let appScanDeviceUr: AirGapUR | undefined;

    try {
      const qrcode =
        appScanDeviceResult.data.fullData || appScanDeviceResult.raw || '';
      appScanDeviceUr = await airGapUrUtils.qrcodeToUr(qrcode);
    } catch (error) {
      console.error(error);
    }

    if (!appScanDeviceUr) {
      throw new OneKeyErrorAirGapInvalidQrCode();
    }
    return appScanDeviceUr;
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

    const signatureUr = await this.startTwoWayQrcodeScan(signRequestUr);

    let sig: IAirGapSignature | undefined;
    try {
      sig = await this.parseSignature(signatureUr);
    } catch (error) {
      console.error(error);
      throw new OneKeyErrorAirGapInvalidQrCode();
    }

    if (sig.requestId !== requestId) {
      console.error(new Error('Signature requestId not match'));
      throw new OneKeyErrorAirGapInvalidQrCode();
    }
    if (sig.origin !== device.name) {
      console.error(new Error('Signature origin not match'));
      throw new OneKeyErrorAirGapInvalidQrCode();
    }
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
    const airGapAccount = wallet?.airGapAccountsInfo?.accounts?.find((item) => {
      if (item.path === fullPath) {
        return true;
      }
      const tpl = this.buildAirGapAccountChildPathTemplate({
        airGapAccount: item,
      });
      const template = [item.path, tpl].filter(Boolean).join('/');
      const fullPathInPubKey = accountUtils.buildPathFromTemplate({
        template,
        index,
      });
      const r = fullPathInPubKey === fullPath;
      if (r) {
        childPathTemplate = tpl;
      }
      return r;
    });
    return { airGapAccount, fullPath, childPathTemplate };
  }

  async findQrWalletAirGapAccount(
    params: IPrepareHardwareAccountsParams,
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
}
