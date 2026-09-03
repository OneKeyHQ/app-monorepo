import { EFirmwareType } from '@onekeyfe/hd-shared';
import { uniq } from 'lodash';

import type {
  AirGapUR,
  IAirGapMultiAccounts,
  IAirGapUrJson,
} from '@onekeyhq/qr-wallet-sdk';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { BTC_FIRST_TAPROOT_PATH } from '@onekeyhq/shared/src/consts/chainConsts';
import { IMPL_EVM, IMPL_TRON } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  OneKeyErrorAirGapInvalidQrCode,
  OneKeyErrorScanQrCodeCancel,
  OneKeyLocalError,
  SecureQRCodeDialogCancel,
} from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { resolveQrWalletDeviceType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IQrWalletDevice } from '@onekeyhq/shared/types/device';

import { vaultFactory } from '../../vaults/factory';
import { buildDefaultAddAccountNetworksForQrWallet } from '../ServiceAccount/defaultNetworkAccountsConfig';
import ServiceBase from '../ServiceBase';

import { UR_DEFAULT_ORIGIN } from './qrWalletConsts';

import type { IDBDevice, IDBWalletId } from '../../dbs/local/types';
import type { KeyringQrBase } from '../../vaults/base/KeyringQrBase';
import type {
  IAnimationValue,
  IQRCodeHandlerParseResult,
} from '../ServiceScanQRCode/utils/parseQRCode/type';

type IQrWalletSdk = typeof import('@onekeyhq/qr-wallet-sdk');
type IOneKeyRequestDeviceQRModule =
  typeof import('@onekeyhq/qr-wallet-sdk/src/OneKeyRequestDeviceQR');

let qrWalletSdkPromise: Promise<IQrWalletSdk> | undefined;
let oneKeyRequestDeviceQRPromise:
  | Promise<IOneKeyRequestDeviceQRModule>
  | undefined;

function loadQrWalletSdk() {
  qrWalletSdkPromise ??= import('@onekeyhq/qr-wallet-sdk').catch((error) => {
    qrWalletSdkPromise = undefined;
    throw error;
  });
  return qrWalletSdkPromise;
}

function loadOneKeyRequestDeviceQR() {
  oneKeyRequestDeviceQRPromise ??=
    import('@onekeyhq/qr-wallet-sdk/src/OneKeyRequestDeviceQR').catch(
      (error) => {
        oneKeyRequestDeviceQRPromise = undefined;
        throw error;
      },
    );
  return oneKeyRequestDeviceQRPromise;
}

@backgroundClass()
class ServiceQrWallet extends ServiceBase {
  /**
   * The live stage-driven two-way scan (OK-59934 §4.6): its servicePromise
   * id, held here so the card's exits — a completed scan, the person
   * closing the stage — can answer the pending call without the id ever
   * leaving bg. One at a time: a newer request supersedes the pending one
   * (the legacy container's last-writer-wins).
   */
  private stageAirGapSession:
    | { promiseId: number; sessionId: number }
    | undefined;

  private stageAirGapSessionSeq = 0;

  private async rejectStageAirGapSession(error: unknown) {
    const session = this.stageAirGapSession;
    if (!session) {
      return;
    }
    this.stageAirGapSession = undefined;
    await this.backgroundApi.servicePromise.rejectCallback({
      id: session.promiseId,
      error,
    });
  }

  /**
   * The completed scan, submitted by the stage's embedded camera — the
   * legacy scan page's resolve, in stage form. The result is the same
   * parse shape the legacy flow resolved with (`data.fullData` for a
   * collected UR, `raw` for a plain-text response).
   *
   * `sessionId` restores the legacy pipeline's per-request promiseId
   * binding: a frame that finished parsing after its session was
   * superseded (or cancelled) must land as a no-op, never as the NEXT
   * request's answer — a wrong signature in the worst case.
   */
  @backgroundMethod()
  async submitStageAirGapScanResult({
    result,
    sessionId,
  }: {
    result: IQRCodeHandlerParseResult<IAnimationValue>;
    sessionId: number | undefined;
  }) {
    const session = this.stageAirGapSession;
    if (
      !session ||
      sessionId === undefined ||
      session.sessionId !== sessionId
    ) {
      return;
    }
    this.stageAirGapSession = undefined;
    // The wait paints before the flow resumes, so the card the person
    // answered never lingers behind the decode — but the paint is
    // cosmetic and the resolve is the contract. A stage write can reject
    // (the native jotai bridge, or bridgeExtBg, not ready yet), and the
    // session is already gone by here: letting that rejection skip the
    // resolve would leave the signing call hanging until the callback
    // expiry with nothing left that could answer it.
    try {
      await this.backgroundApi.serviceHardwareUI.deviceStageBurst.qrNoteScanCompleted();
    } catch (error) {
      defaultLogger.hardware.sdkLog.log(
        'stage-air-gap-scan-completed-paint',
        error instanceof Error ? error.message : 'Unknown stage error',
      );
    }
    await this.backgroundApi.servicePromise.resolveCallback({
      id: session.promiseId,
      data: result,
    });
  }

  /**
   * The stage was dismissed over an air-gap step: reject the pending call
   * with the same cancel the legacy surfaces used — the toast's cancel on
   * showQr, the scan page's on scanQr — so every downstream contract
   * (silent-cancel toast policy, batch-flow termination) keeps holding.
   */
  @backgroundMethod()
  async cancelStageAirGapScan({ scanning }: { scanning?: boolean } = {}) {
    await this.rejectStageAirGapSession(
      scanning
        ? new OneKeyErrorScanQrCodeCancel()
        : new SecureQRCodeDialogCancel(),
    );
  }

  async startTwoWayAirGapScanUr({
    requestUr,
    appQrCodeModalTitle,
    allowPlainTextResponse,
  }: {
    requestUr: AirGapUR;
    appQrCodeModalTitle?: string;
    allowPlainTextResponse?: boolean;
  }): Promise<{
    raw?: string;
    responseUr?: AirGapUR;
  }> {
    const { airGapUrUtils } = await loadQrWalletSdk();
    // **** 1. Device scan App Qrcode
    const valueUr = airGapUrUtils.urToJson({ ur: requestUr });
    const { deviceStageBurst } = this.backgroundApi.serviceHardwareUI;
    // The firmware-update workflow silences the stage; production rode
    // the legacy toast through that window, so this does too — the gate
    // is the stage's, never the flow's.
    const stageEnabled = await deviceStageBurst.isEnabled();

    // **** 2. app scan device Qrcode
    let appScanDeviceResult: IQRCodeHandlerParseResult<IAnimationValue>;
    if (stageEnabled) {
      // A newer request supersedes a pending one — the legacy container
      // closed the standing toast and rejected its promise the same way.
      await this.rejectStageAirGapSession(new SecureQRCodeDialogCancel());
      let promiseId = 0;
      const scanPromise = new Promise<
        IQRCodeHandlerParseResult<IAnimationValue>
      >((resolve, reject) => {
        promiseId = this.backgroundApi.servicePromise.createCallback({
          resolve,
          reject,
        });
      });
      this.stageAirGapSessionSeq += 1;
      const sessionId = this.stageAirGapSessionSeq;
      this.stageAirGapSession = { promiseId, sessionId };
      // Depth-joins the wrapper's burst where one is active (sign, verify
      // address); brackets the flows that have no wrapper (add address).
      await deviceStageBurst.begin({});
      let stageError: unknown;
      try {
        await deviceStageBurst.qrShowCode({ valueUr, sessionId });
        appScanDeviceResult = await scanPromise;
      } catch (error) {
        stageError = error;
        throw error;
      } finally {
        if (this.stageAirGapSession?.promiseId === promiseId) {
          this.stageAirGapSession = undefined;
        }
        await deviceStageBurst.end({ error: stageError });
      }
    } else {
      appScanDeviceResult = await new Promise<
        IQRCodeHandlerParseResult<IAnimationValue>
      >((resolve, reject) => {
        const promiseId = this.backgroundApi.servicePromise.createCallback({
          resolve,
          reject,
        });
        appEventBus.emit(EAppEventBusNames.ShowAirGapQrcode, {
          valueUr,
          promiseId,
          title: appQrCodeModalTitle,
        });
      });
    }

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
    const { airGapUrUtils } = await loadQrWalletSdk();
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

    if (impl === IMPL_TRON) {
      return 'TRON';
    }

    return network.symbol.toUpperCase();
  }

  async buildGetMultiAccountsParams({
    walletId,
    networkId,
    indexedAccountId,
  }: {
    walletId: string;
    networkId: string;
    indexedAccountId: string;
  }) {
    const { serviceAccount } = this.backgroundApi;
    const chain = await this.getDeviceChainNameByNetworkId({ networkId });

    const items =
      await this.backgroundApi.serviceNetwork.getDeriveInfoItemsOfNetwork({
        networkId,
      });

    const indexedAccount = await serviceAccount.getIndexedAccount({
      id: indexedAccountId,
    });
    const index = indexedAccount.index;

    let paths: string[] = [];
    for (const deriveInfo of items) {
      const fullPath = accountUtils.buildPathFromTemplate({
        template: deriveInfo.item.template,
        index,
      });
      const normalizedPath = await this.normalizeGetMultiAccountsPath({
        walletId,
        networkId,
        path: fullPath,
      });
      paths.push(normalizedPath);
    }

    if (chain === 'BTC') {
      // for fullXfp build
      paths.push(BTC_FIRST_TAPROOT_PATH);
    }

    paths = uniq([...paths]);

    return {
      chain,
      paths,
    };
  }

  async normalizeGetMultiAccountsPath({
    walletId,
    networkId,
    path,
  }: {
    walletId: IDBWalletId;
    networkId: string;
    path: string;
  }) {
    const vault = await vaultFactory.getWalletOnlyVault({
      walletId,
      networkId,
    });

    return (vault.keyring as KeyringQrBase).normalizeGetMultiAccountsPath({
      path,
    });
  }

  @backgroundMethod()
  @toastIfError()
  async prepareQrcodeWalletAddressCreate({
    walletId,
    networkId,
    indexedAccountId,
    appQrCodeModalTitle,
  }: // deriveType,
  {
    walletId: IDBWalletId;
    networkId: string;
    indexedAccountId: string;
    appQrCodeModalTitle?: string;
    // deriveType: IAccountDeriveTypes;
  }): Promise<IAirGapUrJson> {
    const { serviceAccount } = this.backgroundApi;
    let byDevice: IDBDevice | undefined;
    if (!walletId) {
      throw new OneKeyLocalError(
        'prepareQrcodeWalletAddressAdd ERROR: walletId missing ',
      );
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
    const allDefaultAddAccountNetworks =
      await buildDefaultAddAccountNetworksForQrWallet({
        walletId: byWallet.id,
        backgroundApi: this.backgroundApi,
        includingNetworkWithGlobalDeriveType: true,
        deviceType: byDevice?.deviceType,
        firmwareType: byDevice?.featuresInfo?.$app_firmware_type,
      });
    let allDefaultAddAccountNetworksIds = allDefaultAddAccountNetworks.map(
      (item) => item.networkId,
    );
    allDefaultAddAccountNetworksIds = uniq([
      ...allDefaultAddAccountNetworksIds,
    ]);
    const firmwareType = await deviceUtils.getFirmwareType({
      features: byDevice?.featuresInfo,
    });
    const isBtcOnlyFirmware = firmwareType === EFirmwareType.BitcoinOnly;
    if (networkUtils.isAllNetwork({ networkId }) || isBtcOnlyFirmware) {
      networkIds = uniq([...allDefaultAddAccountNetworksIds]);
    } else {
      // networkIds = [networkId];
      // TODO always create all default networks?
      networkIds = uniq([...allDefaultAddAccountNetworksIds, networkId]);
    }
    networkIds = uniq([...networkIds]);

    const params: {
      chain: string;
      paths: string[];
    }[] = await Promise.all(
      networkIds.map((n) =>
        this.buildGetMultiAccountsParams({
          walletId,
          networkId: n,
          indexedAccountId,
        }),
      ),
    );

    const [{ airGapUrUtils }, { OneKeyRequestDeviceQR }] = await Promise.all([
      loadQrWalletSdk(),
      loadOneKeyRequestDeviceQR(),
    ]);
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
      appQrCodeModalTitle,
    });

    const jsonData = airGapUrUtils.urToJson({ ur: checkIsDefined(responseUr) });
    return jsonData;
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
    const { EAirGapURType, airGapUrUtils, getAirGapSdk } =
      await loadQrWalletSdk();
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
      throw new OneKeyLocalError(`Invalid UR type: ${ur.type}`);
    }
    const qrDevice: IQrWalletDevice = {
      name: airGapMultiAccounts.device || 'QR Wallet',
      deviceType: resolveQrWalletDeviceType({
        deviceName: airGapMultiAccounts.device,
      }),
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
