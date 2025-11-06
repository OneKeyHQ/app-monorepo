import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { DEFAULT_IP_TABLE_CONFIG } from '@onekeyhq/shared/src/request/constants/ipTableDefaults';
import type {
  IIpTableConfigWithRuntime,
  IIpTableRemoteConfig,
  IIpTableRuntime,
} from '@onekeyhq/shared/src/request/types/ipTable';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

/**
 * IP Table SimpleDB storage structure
 * Stores CDN config and runtime state
 * If config is null, ServiceIpTable will use builtin config
 */
export interface ISimpleDbIpTableData {
  // IP Table configuration (from CDN or builtin)
  config?: IIpTableRemoteConfig | null;

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
      version: 1,
    }));
  }

  /**
   * Get IP Table configuration with runtime state
   * Returns config and runtime as separate fields
   */
  @backgroundMethod()
  async getConfig(): Promise<IIpTableConfigWithRuntime> {
    const data = await this.getRawData();

    return {
      config: data?.config ?? DEFAULT_IP_TABLE_CONFIG,
      runtime: data?.runtime,
    };
  }

  @backgroundMethod()
  async saveConfig(config: IIpTableRemoteConfig): Promise<void> {
    await this.setRawData((data) => ({
      ...data,
      config,
      runtime: {
        ...(data?.runtime ?? {
          enabled: true,
          lastUpdated: Date.now(),
          lastRegionCheck: 0,
          selections: {},
        }),
        lastUpdated: Date.now(),
      },
    }));
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
        config: data?.config ?? null,
        currentRegion: data?.currentRegion ?? 'AUTO',
        runtime: {
          ...runtime,
          selections: {
            ...runtime.selections,
            [domain]: ip,
          },
        },
        version: data?.version ?? 1,
      };
    });
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

    // No config yet, should fetch
    if (!data?.config) {
      return true;
    }

    const now = Date.now();
    const lastUpdated = data.runtime?.lastUpdated ?? 0;
    const ttlMs = data.config.ttl_sec * 1000;

    // Check if config has expired
    return now - lastUpdated > ttlMs;
  }

  @backgroundMethod()
  async clearAll(): Promise<void> {
    await this.setRawData({
      config: null,
      currentRegion: 'AUTO',
      runtime: {
        enabled: true,
        lastUpdated: 0,
        lastRegionCheck: 0,
        selections: {},
      },
      version: 1,
    });
  }
}
