import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { DEFAULT_IP_TABLE_CONFIG } from '@onekeyhq/shared/src/request/constants/ipTableDefaults';
import type { IIpTableConfig } from '@onekeyhq/shared/src/request/types/ipTable';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

/**
 * IP Table SimpleDB Entity Data Structure
 * Simplified: only stores configuration, no error tracking
 */
export interface ISimpleDbIpTableData {
  // Current IP Table configuration
  config?: IIpTableConfig;

  // Last update timestamp
  lastUpdateTime?: number;

  // Configuration version (for migration)
  version?: number;
}

/**
 * SimpleDB Entity for IP Table configuration management
 *
 * Simplified design:
 * - Only stores IP Table configuration
 * - No error tracking (use logging/analytics instead)
 * - No per-host enabled flag (only global switch)
 * - Returns default configuration if no custom config is set
 */
export class SimpleDbEntityIpTable extends SimpleDbEntityBase<ISimpleDbIpTableData> {
  entityName = 'ipTable';

  override enableCache = true; // Enable cache for frequent reads

  /**
   * Get current IP Table configuration
   * Returns default configuration if no custom config is set in SimpleDB
   */
  @backgroundMethod()
  async getConfig(): Promise<IIpTableConfig | null> {
    const data = await this.getRawData();
    // Return stored config if exists, otherwise return default config
    return data?.config ?? DEFAULT_IP_TABLE_CONFIG;
  }

  /**
   * Update IP Table configuration
   * @param config - New IP Table configuration
   */
  @backgroundMethod()
  async setConfig(config: IIpTableConfig) {
    await this.setRawData({
      config,
      lastUpdateTime: Date.now(),
      version: 1,
    });
  }

  /**
   * Enable/disable IP Table globally
   * @param enabled - Whether to enable IP Table
   */
  @backgroundMethod()
  async setEnabled(enabled: boolean) {
    const data = await this.getRawData();
    const config = data?.config;

    if (!config) {
      // If no config exists, do nothing
      return;
    }

    await this.setRawData({
      ...data,
      config: {
        ...config,
        enabled,
      },
      lastUpdateTime: Date.now(),
    });
  }

  /**
   * Clear all IP Table data (reset to empty state)
   */
  @backgroundMethod()
  async clearAll() {
    await this.setRawData({
      config: undefined,
      lastUpdateTime: undefined,
      version: undefined,
    });
  }
}
