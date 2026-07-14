import { debounce } from 'lodash';

import {
  backgroundClass,
  backgroundMethodForDev,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import {
  currencyPersistAtom,
  settingsPersistAtom,
} from '../../../states/jotai/atoms';
import { devSettingsPersistAtom } from '../../../states/jotai/atoms/devSettings';
import ServiceBase from '../../ServiceBase';

import {
  buildPortfolioSyncArtifacts,
  getPortfolioSyncCooldownRemainingMs,
  isPortfolioSyncDevEnabled,
} from './serviceHardwarePortfolioSyncUtils';

import type {
  IPortfolioSyncArtifacts,
  IPortfolioSyncSettledPayload,
} from './serviceHardwarePortfolioSyncUtils';

export type IPortfolioSyncStatus =
  | 'built'
  | 'cooldown'
  | 'disabled'
  | 'duplicate'
  | 'error'
  | 'hardware-busy'
  | 'uploaded';

export type IPortfolioSyncLastResult = {
  contentHash?: string;
  cooldownRemainingMs?: number;
  deviceConnectId?: string;
  errorMessage?: string;
  mockArchiveBytesLength?: number;
  upload?: { portfolioUpdated: boolean };
  portfolioJsonBytesLength?: number;
  serverSubmit?: {
    bytesLength: number;
    contentHash: string;
    serverPackageBase64Length: number;
    serverPackageBytesLength: number;
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
class ServiceHardwarePortfolioSync extends ServiceBase {
  private initialized = false;

  // Per-target dedup hash for a snapshot whose async submit/upload is still in
  // flight. Runtime-only: a stuck reservation must not survive a restart. The
  // durable last-synced hash + cooldown timestamp live in simpleDb
  // (hardwarePortfolioSync), keyed per device so multiple simultaneously
  // connected devices keep independent dedup/cooldown state.
  private inFlightContentHashByTargetKey = new Map<string, string>();

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

  private get portfolioSyncDb() {
    return this.backgroundApi.simpleDb.hardwarePortfolioSync;
  }

  // Sync target identity: the hardware device connectId when available,
  // otherwise the walletId. Dedup/cooldown state is scoped per target so
  // multiple simultaneously-connected devices each keep independent state.
  private getSyncTargetKey(eventPayload: IPortfolioSyncSettledPayload): string {
    return eventPayload.deviceConnectId || eventPayload.walletId || '';
  }

  private async commitProcessedArtifacts({
    artifacts,
    targetKey,
    transferAt,
  }: {
    artifacts: IPortfolioSyncArtifacts;
    targetKey: string;
    transferAt?: number;
  }) {
    // Persist the dedup hash (and optional transfer timestamp) only after the
    // snapshot has actually been submitted/uploaded. Committing earlier means a
    // hardware-busy skip (or a future failed server submit) would permanently
    // dedupe — and thereby silently drop — the same unchanged snapshot until the
    // portfolio changes. Persist BEFORE clearing the in-flight reservation so a
    // concurrent invocation in the gap still sees this target as taken.
    this.lastArtifacts = artifacts;
    await this.portfolioSyncDb.updateTargetState(targetKey, {
      lastContentHash: artifacts.contentHash,
      ...(transferAt !== undefined ? { lastTransferAt: transferAt } : {}),
    });
    this.inFlightContentHashByTargetKey.delete(targetKey);
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

  private async getHardwareCooldownRemainingMs({
    targetKey,
    now,
  }: {
    targetKey: string;
    now: number;
  }) {
    const state = await this.portfolioSyncDb.getTargetState(targetKey);
    return getPortfolioSyncCooldownRemainingMs({
      lastTransferAt: state?.lastTransferAt,
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
  }): Promise<{
    serverPackageBytes: ArrayBuffer;
    serverSubmit: IPortfolioServerSubmitResult;
  }> {
    const { contentHash, portfolio, portfolioJsonBytes } = artifacts;

    debugPortfolioSyncLog('server-submit-ready', {
      bytesLength: portfolioJsonBytes.byteLength,
      contentHash,
      tokenCount: artifacts.portfolio.tokens.length,
      totalTokenCount: artifacts.portfolio.tokenCount,
    });

    // The App only submits portfolio.json. The server validates, normalizes,
    // recomputes iconName from its own token icon allowlist, packs and signs
    // the production portfolio package, and returns it as base64.
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const resp = await client.post<{
      data: { packageBase64: string };
    }>('/wallet/v1/hardware/portfolio/pack', portfolio);

    const packageBase64 = resp.data?.data?.packageBase64;
    if (!packageBase64) {
      throw new OneKeyLocalError(
        'Portfolio pack response missing packageBase64',
      );
    }
    const serverPackageBuffer = bufferUtils.toBuffer(packageBase64, 'base64');
    // Copy into a standalone ArrayBuffer (Buffer.buffer is a shared pool slice).
    const serverPackageBytes = new ArrayBuffer(serverPackageBuffer.byteLength);
    new Uint8Array(serverPackageBytes).set(serverPackageBuffer);

    debugPortfolioSyncLog('server-submit-packed', {
      bytesLength: portfolioJsonBytes.byteLength,
      contentHash,
      serverPackageBase64Length: packageBase64.length,
      serverPackageBytesLength: serverPackageBytes.byteLength,
    });

    return {
      serverPackageBytes,
      serverSubmit: {
        bytesLength: portfolioJsonBytes.byteLength,
        contentHash,
        serverPackageBase64Length: packageBase64.length,
        serverPackageBytesLength: serverPackageBytes.byteLength,
      },
    };
  }

  private async syncSettledPortfolio(
    eventPayload: IPortfolioSyncSettledPayload,
  ) {
    const updatedAt = Date.now();
    const targetKey = this.getSyncTargetKey(eventPayload);
    try {
      if (!(await this.shouldRunDevFlow())) {
        debugPortfolioSyncLog('skip-disabled');
        this.setLastResult({ status: 'disabled', updatedAt });
        return;
      }

      const isHardwareWallet = accountUtils.isHwWallet({
        walletId: eventPayload.walletId,
      });
      const deviceConnectId = eventPayload.deviceConnectId;

      if (isHardwareWallet && deviceConnectId) {
        const cooldownRemainingMs = await this.getHardwareCooldownRemainingMs({
          targetKey,
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
        'server-submit-portfolio-json',
        artifacts.portfolioJsonText,
      );
      debugPortfolioSyncRawLog(
        'mock-sdk-portfolio-json',
        artifacts.mockPortfolioJsonText,
      );

      // Read the persisted last-synced hash for this target (await) BEFORE the
      // synchronous check-and-reserve below. The in-flight read + duplicate
      // check + reserve run with NO await between them, so two concurrent
      // invocations for the same target either see it already reserved (and are
      // deduped) or one reserves first — never both upload the same snapshot.
      // The hardware path further down awaits isHardwareChannelBusy, which is
      // exactly why the reservation must be taken here, not after that await.
      const persistedTargetState =
        await this.portfolioSyncDb.getTargetState(targetKey);
      const isDuplicate =
        artifacts.contentHash === persistedTargetState?.lastContentHash ||
        artifacts.contentHash ===
          this.inFlightContentHashByTargetKey.get(targetKey);
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

      this.inFlightContentHashByTargetKey.set(targetKey, artifacts.contentHash);

      if (isHardwareWallet && deviceConnectId) {
        const hardwareBusy =
          await this.backgroundApi.serviceHardwareUI.isHardwareChannelBusy({
            connectId: deviceConnectId,
          });
        if (hardwareBusy) {
          // Release the reservation and do not persist dedup state: this
          // snapshot was never uploaded, so an identical settled event must be
          // allowed to retry once the hardware channel frees up.
          this.inFlightContentHashByTargetKey.delete(targetKey);
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

      const { serverPackageBytes, serverSubmit } =
        await this.submitPortfolioJsonToServer({
          artifacts,
        });

      if (isHardwareWallet && deviceConnectId) {
        const upload =
          await this.backgroundApi.serviceHardware.uploadPortfolioPackage({
            connectId: deviceConnectId,
            packageBytes: serverPackageBytes,
          });
        this.setLastResult({
          ...this.buildResultBase({
            artifacts,
            eventPayload,
            serverSubmit,
            status: 'uploaded',
            updatedAt,
          }),
          upload,
        });
        debugPortfolioSyncLog('uploaded', {
          bytesLength: serverPackageBytes.byteLength,
          contentHash: artifacts.contentHash,
        });
        await this.commitProcessedArtifacts({
          artifacts,
          targetKey,
          transferAt: Date.now(),
        });
        return;
      }

      await this.commitProcessedArtifacts({ artifacts, targetKey });
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
      // Release the in-flight reservation so the same snapshot can be retried.
      this.inFlightContentHashByTargetKey.delete(targetKey);
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

export default ServiceHardwarePortfolioSync;
