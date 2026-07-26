import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { DEFAULT_IP_TABLE_CONFIG } from '@onekeyhq/shared/src/request/constants/ipTableDefaults';
import type {
  IIpTableConfigWithRuntime,
  IIpTableEffectiveConfig,
  IIpTableRemoteConfig,
  IIpTableRuntime,
} from '@onekeyhq/shared/src/request/types/ipTable';
import {
  createEffectiveIpTableConfig,
  isIpTableConfigRegression,
  isValidIpTableRemoteConfigShape,
  pruneIpTableRuntimeSelections,
  validateIpTableConfigFreshness,
  verifyIpTableConfigSignatureDetailed,
} from '@onekeyhq/shared/src/utils/ipTableUtils';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

const STALE_SPEED_TEST_CONFIG = new Error('stale_speed_test_config');
const INVALID_SIGNED_CONFIG = new Error('invalid_signed_ip_table_config');
const REGRESSED_SIGNED_CONFIG = new Error('regressed_signed_ip_table_config');

/**
 * IP Table SimpleDB storage structure
 * Stores CDN config and runtime state
 * If config is null, ServiceIpTable will use builtin config
 */
export interface ISimpleDbIpTableData {
  /** @deprecated V1 storage field, migrated on the next verified save. */
  config?: IIpTableRemoteConfig | null;

  /** Verbatim signed CDN envelope. Never merged with bundled defaults. */
  rawConfig?: IIpTableRemoteConfig | null;

  /** Derived runtime view. Never treated as signature-covered data. */
  effectiveConfig?: IIpTableEffectiveConfig | null;

  highestAccepted?: {
    version: number;
    generatedAt: string;
  };

  // User's current region
  currentRegion?: 'CN' | 'GLOBAL' | 'AUTO';

  // Runtime state
  runtime?: IIpTableRuntime | undefined;

  // Storage version (for migration)
  version?: number;
}

export class SimpleDbEntityIpTable extends SimpleDbEntityBase<ISimpleDbIpTableData> {
  entityName = 'ipTable';

  override enableCache = false;

  @backgroundMethod()
  async getStorageData(): Promise<ISimpleDbIpTableData | null | undefined> {
    return this.getRawData();
  }

  @backgroundMethod()
  async saveStorageData(data: ISimpleDbIpTableData): Promise<void> {
    await this.setRawData(() => ({
      ...data,
      version: 2,
    }));
  }

  /**
   * Get IP Table configuration with runtime state
   * Returns config and runtime as separate fields
   */
  @backgroundMethod()
  async getConfig(): Promise<IIpTableConfigWithRuntime> {
    const data = await this.getRawData();
    const rawConfig = data?.rawConfig ?? data?.config ?? undefined;

    if (rawConfig && isValidIpTableRemoteConfigShape(rawConfig)) {
      const verifyResult =
        await verifyIpTableConfigSignatureDetailed(rawConfig);
      const freshness = validateIpTableConfigFreshness({
        config: rawConfig,
      });
      const regression = data?.highestAccepted
        ? isIpTableConfigRegression({
            remoteConfig: rawConfig,
            localConfig: {
              version: data.highestAccepted.version,
              generated_at: data.highestAccepted.generatedAt,
            },
            lastVerified: data.highestAccepted,
          }).regression
        : false;

      if (verifyResult.ok && freshness.valid && !regression) {
        return {
          config: createEffectiveIpTableConfig({
            rawConfig,
            source: 'signed-remote',
          }),
          rawSignedConfig: rawConfig,
          runtime: data?.runtime,
        };
      }
    }

    return {
      config: createEffectiveIpTableConfig({
        rawConfig: DEFAULT_IP_TABLE_CONFIG,
        source: 'bundled',
      }),
      runtime: data?.runtime,
    };
  }

  @backgroundMethod()
  async saveConfig(
    config: IIpTableRemoteConfig,
    verifiedMeta?: { payloadHash: string },
  ): Promise<void> {
    if (
      !isValidIpTableRemoteConfigShape(config) ||
      !(await verifyIpTableConfigSignatureDetailed(config)).ok ||
      !validateIpTableConfigFreshness({ config }).valid
    ) {
      throw INVALID_SIGNED_CONFIG;
    }

    const effectiveConfig = createEffectiveIpTableConfig({
      rawConfig: config,
      source: 'signed-remote',
    });

    await this.setRawData((data) => {
      if (
        data?.highestAccepted &&
        isIpTableConfigRegression({
          remoteConfig: config,
          localConfig: {
            version: data.highestAccepted.version,
            generated_at: data.highestAccepted.generatedAt,
          },
          lastVerified: data.highestAccepted,
        }).regression
      ) {
        throw REGRESSED_SIGNED_CONFIG;
      }

      const runtime = data?.runtime ?? {
        enabled: true,
        lastUpdated: Date.now(),
        lastRegionCheck: 0,
        selections: {},
      };
      const pruned = pruneIpTableRuntimeSelections({
        config: effectiveConfig,
        selections: runtime.selections,
        lastBestIp: runtime.lastBestIp,
      });
      const { config: _legacyConfig, ...currentData } = data ?? {};
      return {
        ...currentData,
        rawConfig: config,
        effectiveConfig,
        highestAccepted: {
          version: config.version,
          generatedAt: config.generated_at,
        },
        runtime: {
          ...runtime,
          selections: pruned.selections,
          lastBestIp: pruned.lastBestIp,
          lastUpdated: Date.now(),
          // Provenance of the last successfully verified config; consumed by
          // rollback protection and diagnostics.
          ...(verifiedMeta
            ? {
                lastVerified: {
                  at: Date.now(),
                  version: config.version,
                  generatedAt: config.generated_at,
                  payloadHash: verifiedMeta.payloadHash,
                },
              }
            : {}),
        },
        version: 2,
      };
    });
  }

  /**
   * Update IP selection for a domain
   */
  @backgroundMethod()
  async updateSelection(domain: string, ip: string): Promise<void> {
    await this.setRawData((data) => {
      const runtime = data?.runtime ?? {
        enabled: true,
        lastUpdated: 0,
        lastRegionCheck: 0,
        selections: {},
      };

      return {
        ...data,
        currentRegion: data?.currentRegion ?? 'AUTO',
        runtime: {
          ...runtime,
          selections: {
            ...runtime.selections,
            [domain]: ip,
          },
        },
        version: data?.version ?? 2,
      };
    });
  }

  /**
   * Record the best IP measured by the latest speed test, independent of the
   * final selection. Consumed by fast failover when the domain starts failing.
   */
  @backgroundMethod()
  async updateLastBestIp(domain: string, ip: string): Promise<void> {
    await this.setRawData((data) => {
      const runtime = data?.runtime ?? {
        enabled: true,
        lastUpdated: 0,
        lastRegionCheck: 0,
        selections: {},
      };

      return {
        ...data,
        currentRegion: data?.currentRegion ?? 'AUTO',
        runtime: {
          ...runtime,
          lastBestIp: {
            ...runtime.lastBestIp,
            [domain]: ip,
          },
        },
        version: data?.version ?? 2,
      };
    });
  }

  /**
   * Atomically validate a speed-test result against the currently persisted
   * signed config and commit its runtime state. Sharing setRawData's mutex
   * with saveConfig prevents a config replacement/prune from landing between
   * validation and the last-best/selection writes.
   */
  @backgroundMethod()
  async commitSpeedTestResult(options: {
    domain: string;
    expectedConfigHash: string;
    measuredEndpointIps: string[];
    lastBestIp?: string;
    /** undefined keeps the current selection; empty string selects domain */
    selection?: string;
  }): Promise<'applied' | 'stale_config'> {
    try {
      await this.setRawData((data) => {
        const persistedRawConfig = data?.rawConfig ?? data?.config ?? undefined;
        const currentConfig =
          data?.effectiveConfig ??
          createEffectiveIpTableConfig({
            rawConfig: persistedRawConfig ?? DEFAULT_IP_TABLE_CONFIG,
            source: persistedRawConfig ? 'signed-remote' : 'bundled',
          });
        const currentEndpoints = new Set(
          currentConfig.domains[options.domain]?.endpoints.map(
            (endpoint) => endpoint.ip,
          ) ?? [],
        );
        const candidateIps = new Set(options.measuredEndpointIps);
        if (options.lastBestIp) {
          candidateIps.add(options.lastBestIp);
        }
        if (options.selection) {
          candidateIps.add(options.selection);
        }
        if (
          currentConfig.sourcePayloadHash !== options.expectedConfigHash ||
          [...candidateIps].some((ip) => !currentEndpoints.has(ip))
        ) {
          throw STALE_SPEED_TEST_CONFIG;
        }

        const runtime = data?.runtime ?? {
          enabled: true,
          lastUpdated: 0,
          lastRegionCheck: 0,
          selections: {},
        };
        return {
          ...data,
          currentRegion: data?.currentRegion ?? 'AUTO',
          runtime: {
            ...runtime,
            ...(options.lastBestIp
              ? {
                  lastBestIp: {
                    ...runtime.lastBestIp,
                    [options.domain]: options.lastBestIp,
                  },
                }
              : {}),
            ...(options.selection !== undefined
              ? {
                  selections: {
                    ...runtime.selections,
                    [options.domain]: options.selection,
                  },
                }
              : {}),
          },
          version: data?.version ?? 2,
        };
      });
      return 'applied';
    } catch (error) {
      if (error === STALE_SPEED_TEST_CONFIG) {
        return 'stale_config';
      }
      throw error;
    }
  }

  @backgroundMethod()
  async setEnabled(enabled: boolean): Promise<void> {
    await this.setRawData((data) => ({
      ...data,
      runtime: {
        ...(data?.runtime ?? {
          enabled,
          lastUpdated: 0,
          lastRegionCheck: 0,
          selections: {},
        }),
        enabled,
      },
    }));
  }

  @backgroundMethod()
  async shouldRefreshConfig(): Promise<boolean> {
    const data = await this.getRawData();
    const rawConfig = data?.rawConfig ?? data?.config ?? undefined;

    if (!rawConfig || !isValidIpTableRemoteConfigShape(rawConfig)) {
      return true;
    }

    return !validateIpTableConfigFreshness({ config: rawConfig }).valid;
  }

  @backgroundMethod()
  async clearAll(): Promise<void> {
    await this.setRawData((data) => ({
      rawConfig: null,
      effectiveConfig: null,
      highestAccepted: data?.highestAccepted,
      currentRegion: 'AUTO',
      runtime: {
        enabled: true,
        lastUpdated: 0,
        lastRegionCheck: 0,
        selections: {},
      },
      version: 2,
    }));
  }
}
