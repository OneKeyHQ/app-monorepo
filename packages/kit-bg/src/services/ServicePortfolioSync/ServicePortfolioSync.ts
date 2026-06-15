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
  getPortfolioSyncCooldownRemainingMs,
  isPortfolioSyncDevEnabled,
} from './servicePortfolioSyncUtils';

import type {
  IPortfolioSyncArtifacts,
  IPortfolioSyncSettledPayload,
} from './servicePortfolioSyncUtils';

export type IPortfolioSyncStatus =
  | 'built'
  | 'cooldown'
  | 'disabled'
  | 'duplicate'
  | 'empty'
  | 'error'
  | 'hardware-busy'
  | 'mock-uploaded';

export type IPortfolioSyncLastResult = {
  contentHash?: string;
  cooldownRemainingMs?: number;
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

const LOG_PREFIX = '[PRO2-PORTFOLIO-SYNC]';

function stringifyLogValue(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({
      stringifyError: error instanceof Error ? error.message : String(error),
    });
  }
}

function debugPortfolioSyncLog(label: string, value?: unknown) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const valueText = value === undefined ? '' : ` ${stringifyLogValue(value)}`;
  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} ${label}${valueText}`);
}

function debugPortfolioSyncRawLog(label: string, value: string) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} ${label} ${value}`);
}

@backgroundClass()
class ServicePortfolioSync extends ServiceBase {
  private initialized = false;

  private lastContentHash: string | undefined;

  private lastHardwareTransferAtByConnectId = new Map<string, number>();

  private lastArtifacts: IPortfolioSyncArtifacts | undefined;

  private lastResult: IPortfolioSyncLastResult | undefined;

  private pendingCooldownPayloadByConnectId = new Map<
    string,
    IPortfolioSyncSettledPayload
  >();

  private pendingCooldownTimerByConnectId = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

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
    debugPortfolioSyncLog('listener-init');
  }

  private handleAllNetworksTokenListSettled = (
    eventPayload: IPortfolioSyncSettledPayload,
  ) => {
    debugPortfolioSyncLog('settled-event', {
      hasDeviceConnectId: Boolean(eventPayload.deviceConnectId),
      isHardwareWallet: accountUtils.isHwWallet({
        walletId: eventPayload.walletId,
      }),
      totalTokenCount: eventPayload.tokens.length,
    });
    this.syncDebounced(eventPayload);
  };

  private setLastResult(result: IPortfolioSyncLastResult) {
    this.lastResult = result;
  }

  private scheduleSyncAfterCooldown({
    deviceConnectId,
    eventPayload,
    remainingMs,
  }: {
    deviceConnectId: string;
    eventPayload: IPortfolioSyncSettledPayload;
    remainingMs: number;
  }) {
    this.pendingCooldownPayloadByConnectId.set(deviceConnectId, eventPayload);

    const existingTimer =
      this.pendingCooldownTimerByConnectId.get(deviceConnectId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.pendingCooldownTimerByConnectId.delete(deviceConnectId);
      const pendingPayload =
        this.pendingCooldownPayloadByConnectId.get(deviceConnectId);
      this.pendingCooldownPayloadByConnectId.delete(deviceConnectId);
      if (pendingPayload) {
        void this.syncSettledPortfolio(pendingPayload);
      }
    }, remainingMs);

    this.pendingCooldownTimerByConnectId.set(deviceConnectId, timer);
  }

  private getHardwareCooldownRemainingMs({
    deviceConnectId,
    now,
  }: {
    deviceConnectId: string;
    now: number;
  }) {
    return getPortfolioSyncCooldownRemainingMs({
      lastTransferAt:
        this.lastHardwareTransferAtByConnectId.get(deviceConnectId),
      now,
    });
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

    debugPortfolioSyncLog('server-submit-ready', {
      bytesLength: portfolioJsonBytes.byteLength,
      contentHash,
      tokenCount: artifacts.portfolio.tokens.length,
      totalTokenCount: artifacts.portfolio.tokenCount,
    });

    // TODO: POST `portfolioJsonBytes` as portfolio.json to the Pro 2
    // portfolio-pack API once the server endpoint is finalized. The server,
    // not the App, must validate, normalize, pack the archive/PP payload, and
    // recompute iconName from its token icon allowlist before signing it for
    // production.
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
        debugPortfolioSyncLog('skip-disabled');
        this.setLastResult({ status: 'disabled', updatedAt });
        return;
      }

      if (!eventPayload.tokens.length) {
        debugPortfolioSyncLog('skip-empty');
        this.setLastResult({ status: 'empty', updatedAt });
        return;
      }

      const isHardwareWallet = accountUtils.isHwWallet({
        walletId: eventPayload.walletId,
      });
      const deviceConnectId = eventPayload.deviceConnectId;

      if (isHardwareWallet && deviceConnectId) {
        const cooldownRemainingMs = this.getHardwareCooldownRemainingMs({
          deviceConnectId,
          now: updatedAt,
        });
        if (cooldownRemainingMs > 0) {
          this.scheduleSyncAfterCooldown({
            deviceConnectId,
            eventPayload,
            remainingMs: cooldownRemainingMs,
          });
          debugPortfolioSyncLog('skip-cooldown', {
            cooldownRemainingMs,
            deviceConnectId,
            totalTokenCount: eventPayload.tokens.length,
          });
          this.setLastResult({
            cooldownRemainingMs,
            deviceConnectId,
            status: 'cooldown',
            totalTokenCount: eventPayload.tokens.length,
            updatedAt,
            walletId: eventPayload.walletId,
          });
          return;
        }
      }

      const { currencyMap, displayCurrency } =
        await this.getCurrencyMapForBuild();
      const artifacts = buildPortfolioSyncArtifacts({
        currencyMap,
        displayCurrency,
        eventPayload,
        timestamp: updatedAt,
      });
      debugPortfolioSyncRawLog(
        'portfolio-json-built',
        artifacts.portfolioJsonText,
      );

      const isDuplicate = artifacts.contentHash === this.lastContentHash;
      if (isDuplicate) {
        debugPortfolioSyncLog('skip-duplicate', {
          contentHash: artifacts.contentHash,
          tokenCount: artifacts.portfolio.tokens.length,
          totalTokenCount: eventPayload.tokens.length,
        });
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

      if (isHardwareWallet && deviceConnectId) {
        const hardwareBusy =
          await this.backgroundApi.serviceHardwareUI.isHardwareChannelBusy({
            connectId: deviceConnectId,
          });
        if (hardwareBusy) {
          debugPortfolioSyncLog('skip-hardware-busy', {
            contentHash: artifacts.contentHash,
          });
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
        debugPortfolioSyncLog('mock-uploaded', {
          bytesLength: mockUpload.bytesLength,
          contentHash: mockUpload.contentHash,
        });
        this.lastHardwareTransferAtByConnectId.set(deviceConnectId, Date.now());
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
      debugPortfolioSyncLog('built', {
        contentHash: artifacts.contentHash,
        portfolioJsonBytesLength: artifacts.portfolioJsonBytes.byteLength,
      });
    } catch (error) {
      debugPortfolioSyncLog('error', {
        message: (error as Error)?.message,
      });
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
