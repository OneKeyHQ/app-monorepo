import { uniq } from 'lodash';

import type {
  AirGapUR,
  IAirGapMultiAccounts,
  IAirGapUrJson,
} from '@onekeyhq/qr-wallet-sdk';
import {
  EAirGapURType,
  airGapUrUtils,
  getAirGapSdk,
} from '@onekeyhq/qr-wallet-sdk';
import { OneKeyRequestDeviceQR } from '@onekeyhq/qr-wallet-sdk/src/OneKeyRequestDeviceQR';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyErrorAirGapInvalidQrCode } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IQrWalletDevice } from '@onekeyhq/shared/types/device';

import { buildDefaultAddAccountNetworksForQrWallet } from '../ServiceAccount/defaultNetworkAccountsConfig';
import ServiceBase from '../ServiceBase';

import { UR_DEFAULT_ORIGIN } from './qrWalletConsts';

import type { IDBDevice, IDBWalletId } from '../../dbs/local/types';
import type {
  IAnimationValue,
  IQRCodeHandlerParseResult,
} from '../ServiceScanQRCode/utils/parseQRCode/type';

@backgroundClass()
class ServiceQrWallet extends ServiceBase {
  async startTwoWayAirGapScanUr({
    requestUr,
    allowPlainTextResponse,
  }: {
    requestUr: AirGapUR;
    allowPlainTextResponse?: boolean;
  }): Promise<{
    raw?: string;
    responseUr?: AirGapUR;
  }> {
    // **** 2. app scan device Qrcode
    const appScanDeviceResult = await new Promise<
      IQRCodeHandlerParseResult<IAnimationValue>
    >((resolve, reject) => {
      const promiseId = this.backgroundApi.servicePromise.createCallback({
        resolve,
        reject,
      });
      // **** 1. Device scan App Qrcode
      appEventBus.emit(EAppEventBusNames.ShowAirGapQrcode, {
        drawType: 'animated',
        valueUr: airGapUrUtils.urToJson({ ur: requestUr }),
        promiseId,
      });
    });

    let responseUr: AirGapUR | undefined;
    let raw: string | undefined;
    try {
      raw = appScanDeviceResult.data.fullData || appScanDeviceResult.raw || '';
      responseUr = await airGapUrUtils.qrcodeToUr(raw);
    } catch (error) {
      console.error(error);
    }

    if (!responseUr && !allowPlainTextResponse) {
      throw new OneKeyErrorAirGapInvalidQrCode();
    }
    return { raw, responseUr };
  }

  @backgroundMethod()
  async startTwoWayAirGapScan(appUr: IAirGapUrJson): Promise<IAirGapUrJson> {
    const deviceScanAppUr: AirGapUR = airGapUrUtils.jsonToUr({
      ur: appUr,
    });
    const { responseUr: appScanDeviceUr } = await this.startTwoWayAirGapScanUr({
      requestUr: deviceScanAppUr,
    });
    return airGapUrUtils.urToJson({
      ur: checkIsDefined(appScanDeviceUr),
    });
  }

  /*
  EVM-BSC: ETH
  EVM-ETH: ETH

  Bitcoin: BTC
  Bitcoin Testnet: TBTC
  Bitcoin Signet: SBTC
  */
  async getDeviceChainNameByNetworkId({ networkId }: { networkId: string }) {
    // const ids = getNetworkIdsMap();
    // if (networkId === ids.tbtc) {
    //   // eslint-disable-next-line no-param-reassign
    //   networkId = ids.btc;
    // }
    const network = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId,
    });
    const impl = networkUtils.getNetworkImpl({ networkId });
    if (impl === IMPL_EVM) {
      return 'ETH';
    }
    return network.symbol.toUpperCase();
  }

  async buildGetMultiAccountsParams({
    networkId,
    indexedAccountId,
  }: {
    networkId: string;
    indexedAccountId: string;
  }) {
    const { serviceAccount } = this.backgroundApi;

    const items =
      await this.backgroundApi.serviceNetwork.getDeriveInfoItemsOfNetwork({
        networkId,
      });

    const indexedAccount = await serviceAccount.getIndexedAccount({
      id: indexedAccountId,
    });
    const index = indexedAccount.index;

    const paths: string[] = [];
    for (const deriveInfo of items) {
      const fullPath = accountUtils.buildPathFromTemplate({
        template: deriveInfo.item.template,
        index,
      });
      paths.push(
        accountUtils.removePathLastSegment({
          path: fullPath,
          removeCount: 2, // TODO always remove last 2 segments, only works for EVM and BTC yet
        }),
      );
    }

    const chain = await this.getDeviceChainNameByNetworkId({ networkId });

    return {
      chain,
      paths,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async prepareQrcodeWalletAddressCreate({
    walletId,
    networkId,
    indexedAccountId,
  }: // deriveType,
  {
    walletId: IDBWalletId;
    networkId: string;
    indexedAccountId: string;
    // deriveType: IAccountDeriveTypes;
  }): Promise<IAirGapUrJson> {
    const { serviceAccount } = this.backgroundApi;
    let byDevice: IDBDevice | undefined;
    if (!walletId) {
      throw new Error('prepareQrcodeWalletAddressAdd ERROR: walletId missing ');
    }
    const byWallet = await serviceAccount.getWallet({
      walletId,
    });
    if (byWallet.associatedDevice) {
      byDevice = await serviceAccount.getDevice({
        dbDeviceId: byWallet.associatedDevice,
      });
    }

    let networkIds: string[] = [];
    const allDefaultAddAccountNetworks = uniq(
      buildDefaultAddAccountNetworksForQrWallet().map((item) => item.networkId),
    );
    if (networkUtils.isAllNetwork({ networkId })) {
      networkIds = allDefaultAddAccountNetworks;
    } else {
      // networkIds = [networkId];
      // TODO always create all default networks?
      networkIds = [...allDefaultAddAccountNetworks, networkId];
    }

    const params: {
      chain: string;
      paths: string[];
    }[] = await Promise.all(
      networkIds.map((n) =>
        this.buildGetMultiAccountsParams({ networkId: n, indexedAccountId }),
      ),
    );

    const request = new OneKeyRequestDeviceQR({
      requestId: generateUUID(),
      xfp: byWallet.xfp || '',
      deviceId: byDevice?.deviceId || '',
      origin: UR_DEFAULT_ORIGIN,
      //
      method: 'getMultiAccounts',
      params,
    });

    console.log('prepareQrcodeWalletAddressCreate .>>> ', request);

    const { responseUr } = await this.startTwoWayAirGapScanUr({
      requestUr: request.toUR(),
    });

    return airGapUrUtils.urToJson({ ur: checkIsDefined(responseUr) });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //   const { wallet: walletCreated } = await createQrWallet({
    //     isOnboarding: false,
    //     byDevice,
    //     byWallet,
    //   });
  }

  // TODO build OneKeyRequestDeviceQR

  // TODO startTwoWayQrcodeScan

  // buildAirGapMultiAccounts
  @backgroundMethod()
  @toastIfError()
  async buildAirGapMultiAccounts({
    // scanResult,
    urJson,
  }: {
    // scanResult: IQRCodeHandlerParseResult<IBaseValue>;
    urJson: IAirGapUrJson;
  }) {
    const ur = airGapUrUtils.jsonToUr({ ur: urJson });
    const sdk = getAirGapSdk();
    let airGapMultiAccounts: IAirGapMultiAccounts | undefined;
    let buildBy: 'hdkey' | 'multiAccounts' = 'multiAccounts';

    if (ur.type === EAirGapURType.CryptoMultiAccounts) {
      airGapMultiAccounts = sdk.parseMultiAccounts(ur);
      buildBy = 'multiAccounts';
    } else if (ur.type === EAirGapURType.CryptoHDKey) {
      const key = sdk.parseHDKey(ur);
      const name = key.name || 'name';
      const chain = key.chain || 'chain';
      const note = key.note || 'note';
      const xfpOrUUID = key.xfp || generateUUID();
      // SingleChainAirGapDevice do NOT have deviceId, so we generate one by other fields
      const generatedDeviceId = `SingleChainAirGapDevice@${name}-${chain}-${note}-${xfpOrUUID}`;
      airGapMultiAccounts = {
        device: key.name,
        deviceId: generatedDeviceId,
        deviceVersion: '0.0.1',
        masterFingerprint: key.xfp || '',
        keys: [key],
      };
      buildBy = 'hdkey';
    } else {
      throw new Error(`Invalid UR type: ${ur.type}`);
    }
    const qrDevice: IQrWalletDevice = {
      name: airGapMultiAccounts.device || 'QR Wallet',
      deviceId: airGapMultiAccounts.deviceId || '',
      version: airGapMultiAccounts.deviceVersion || '',
      xfp: airGapMultiAccounts.masterFingerprint || '',
      buildBy,
    };

    if (qrDevice.buildBy === 'hdkey') {
      // hdkey not supported
      throw new OneKeyErrorAirGapInvalidQrCode();
    }
    return {
      qrDevice,
      airGapAccounts: airGapMultiAccounts.keys,
      airGapMultiAccounts,
    };
  }
}

export default ServiceQrWallet;
