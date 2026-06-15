import { debounce } from 'lodash';

import {
  backgroundClass,
  backgroundMethodForDev,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import {
  currencyPersistAtom,
  settingsPersistAtom,
} from '../../states/jotai/atoms';
import { devSettingsPersistAtom } from '../../states/jotai/atoms/devSettings';
import ServiceBase from '../ServiceBase';

import {
  buildPortfolioSyncArtifacts,
  isPortfolioSyncDevEnabled,
} from './servicePortfolioSyncUtils';

import type {
  IPortfolioSyncArtifacts,
  IPortfolioSyncSettledPayload,
} from './servicePortfolioSyncUtils';

export type IPortfolioSyncStatus =
  | 'built'
  | 'disabled'
  | 'duplicate'
  | 'empty'
  | 'error'
  | 'hardware-busy'
  | 'mock-uploaded';

export type IPortfolioSyncLastResult = {
  contentHash?: string;
  deviceConnectId?: string;
  errorMessage?: string;
  mockArchiveBytesLength?: number;
  mockUpload?: {
    bytesLength: number;
    contentHash: string;
    mock: true;
  };
  portfolioJsonBytesLength?: number;
  serverSubmit?: {
    bytesLength: number;
    contentHash: string;
    todoEndpoint: true;
  };
  status: IPortfolioSyncStatus;
  tokenCount?: number;
  totalTokenCount?: number;
  updatedAt: number;
  walletId?: string;
};

type IPortfolioServerSubmitResult = NonNullable<
  IPortfolioSyncLastResult['serverSubmit']
>;

@backgroundClass()
class ServicePortfolioSync extends ServiceBase {
  private initialized = false;

  private lastContentHash: string | undefined;

  private lastArtifacts: IPortfolioSyncArtifacts | undefined;

  private lastResult: IPortfolioSyncLastResult | undefined;

  private syncDebounced = debounce(
    (eventPayload: IPortfolioSyncSettledPayload) => {
      void this.syncSettledPortfolio(eventPayload);
    },
    1000,
  );

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  init() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    appEventBus.on(
      EAppEventBusNames.AllNetworksTokenListSettled,
      this.handleAllNetworksTokenListSettled,
    );
  }

  private handleAllNetworksTokenListSettled = (
    eventPayload: IPortfolioSyncSettledPayload,
  ) => {
    this.syncDebounced(eventPayload);
  };

  private setLastResult(result: IPortfolioSyncLastResult) {
    this.lastResult = result;
  }

  private async shouldRunDevFlow(): Promise<boolean> {
    const devSettings = await devSettingsPersistAtom.get();
    return isPortfolioSyncDevEnabled({
      devSettings,
      runtimeDevEnabled: Boolean(platformEnv.isDev || platformEnv.isE2E),
    });
  }

  private async getCurrencyMapForBuild() {
    let { currencyMap } = await currencyPersistAtom.get();
    const settings = await settingsPersistAtom.get();
    if (!currencyMap[settings.currencyInfo.id]) {
      try {
        await this.backgroundApi.serviceSetting.fetchCurrencyList();
        currencyMap = (await currencyPersistAtom.get()).currencyMap;
      } catch {
        // Strict conversion will emit null values if the rate is still absent.
      }
    }
    return {
      currencyMap,
      displayCurrency: settings.currencyInfo,
    };
  }

  private buildResultBase({
    artifacts,
    eventPayload,
    serverSubmit,
    status,
    updatedAt,
  }: {
    artifacts: IPortfolioSyncArtifacts;
    eventPayload: IPortfolioSyncSettledPayload;
    serverSubmit?: IPortfolioServerSubmitResult;
    status: IPortfolioSyncStatus;
    updatedAt: number;
  }): IPortfolioSyncLastResult {
    return {
      contentHash: artifacts.contentHash,
      deviceConnectId: eventPayload.deviceConnectId,
      mockArchiveBytesLength: artifacts.mockArchiveBytes.byteLength,
      portfolioJsonBytesLength: artifacts.portfolioJsonBytes.byteLength,
      serverSubmit,
      status,
      tokenCount: artifacts.portfolio.tokens.length,
      totalTokenCount: eventPayload.tokens.length,
      updatedAt,
      walletId: eventPayload.walletId,
    };
  }

  private async submitPortfolioJsonToServer({
    artifacts,
  }: {
    artifacts: IPortfolioSyncArtifacts;
  }): Promise<IPortfolioServerSubmitResult> {
    const { contentHash, portfolioJsonBytes, portfolioJsonText } = artifacts;
    void portfolioJsonText;

    // TODO: POST `portfolioJsonBytes` as portfolio.json to the Pro 2
    // portfolio-pack API once the server endpoint is finalized. The server,
    // not the App, must validate, normalize, pack the archive/PP payload, and
    // sign it for production.
    return {
      bytesLength: portfolioJsonBytes.byteLength,
      contentHash,
      todoEndpoint: true,
    };
  }

  private async syncSettledPortfolio(
    eventPayload: IPortfolioSyncSettledPayload,
  ) {
    const updatedAt = Date.now();
    try {
      if (!(await this.shouldRunDevFlow())) {
        this.setLastResult({ status: 'disabled', updatedAt });
        return;
      }

      if (!eventPayload.tokens.length) {
        this.setLastResult({ status: 'empty', updatedAt });
        return;
      }

      const { currencyMap, displayCurrency } =
        await this.getCurrencyMapForBuild();
      const artifacts = buildPortfolioSyncArtifacts({
        currencyMap,
        displayCurrency,
        eventPayload,
        timestamp: updatedAt,
      });

      const isDuplicate = artifacts.contentHash === this.lastContentHash;
      if (isDuplicate) {
        this.setLastResult(
          this.buildResultBase({
            artifacts,
            eventPayload,
            status: 'duplicate',
            updatedAt,
          }),
        );
        return;
      }

      this.lastContentHash = artifacts.contentHash;
      this.lastArtifacts = artifacts;

      const isHardwareWallet = accountUtils.isHwWallet({
        walletId: eventPayload.walletId,
      });
      const deviceConnectId = eventPayload.deviceConnectId;

      if (isHardwareWallet && deviceConnectId) {
        const hardwareBusy =
          await this.backgroundApi.serviceHardwareUI.isHardwareChannelBusy({
            connectId: deviceConnectId,
          });
        if (hardwareBusy) {
          this.setLastResult(
            this.buildResultBase({
              artifacts,
              eventPayload,
              status: 'hardware-busy',
              updatedAt,
            }),
          );
          return;
        }
      }

      const serverSubmit = await this.submitPortfolioJsonToServer({
        artifacts,
      });

      if (isHardwareWallet && deviceConnectId) {
        const mockUpload =
          await this.backgroundApi.serviceHardware.uploadPortfolioPackageMock({
            connectId: deviceConnectId,
            contentHash: artifacts.contentHash,
            packageBytes: artifacts.mockArchiveBytes,
          });
        this.setLastResult({
          ...this.buildResultBase({
            artifacts,
            eventPayload,
            serverSubmit,
            status: 'mock-uploaded',
            updatedAt,
          }),
          mockUpload,
        });
        return;
      }

      this.setLastResult(
        this.buildResultBase({
          artifacts,
          eventPayload,
          serverSubmit,
          status: 'built',
          updatedAt,
        }),
      );
    } catch (error) {
      this.setLastResult({
        errorMessage: (error as Error)?.message,
        status: 'error',
        updatedAt,
      });
    }
  }

  @backgroundMethodForDev()
  async getLastPortfolioSyncResultForDev() {
    return this.lastResult;
  }

  @backgroundMethodForDev()
  async getLastPortfolioSyncArtifactSummaryForDev() {
    if (!this.lastArtifacts) {
      return undefined;
    }
    return {
      contentHash: this.lastArtifacts.contentHash,
      mockArchiveBytesLength: this.lastArtifacts.mockArchiveBytes.byteLength,
      portfolioJsonBytesLength:
        this.lastArtifacts.portfolioJsonBytes.byteLength,
    };
  }
}

export default ServicePortfolioSync;
