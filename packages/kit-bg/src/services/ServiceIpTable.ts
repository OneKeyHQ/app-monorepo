/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IIpTableConfigWithRuntime,
  IIpTableRemoteConfig,
} from '@onekeyhq/shared/src/request/types/ipTable';

import ServiceBase from './ServiceBase';

/**
 * IP Table Configuration Service
 *
 * Responsibilities:
 * - Fetch CDN config and verify signature
 * - Manage IP Table configuration storage
 * - Handle region detection and config refresh
 */
@backgroundClass()
class ServiceIpTable extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  /**
   * Get current IP Table configuration with runtime state
   * Returns config merged with runtime selections
   */
  @backgroundMethod()
  async getConfig(): Promise<IIpTableConfigWithRuntime> {
    return this.backgroundApi.simpleDb.ipTable.getConfig();
  }

  /**
   * Save CDN configuration
   */
  @backgroundMethod()
  async saveConfig(config: IIpTableRemoteConfig) {
    await this.backgroundApi.simpleDb.ipTable.saveConfig(config);
  }

  /**
   * Enable/disable IP Table globally
   */
  @backgroundMethod()
  async setEnabled(enabled: boolean) {
    await this.backgroundApi.simpleDb.ipTable.setEnabled(enabled);
  }

  /**
   * Reset IP Table to empty state
   */
  @backgroundMethod()
  async reset() {
    await this.backgroundApi.simpleDb.ipTable.clearAll();
  }

  /**
   * Check if CDN config should be refreshed based on TTL
   */
  @backgroundMethod()
  async shouldRefreshConfig(): Promise<boolean> {
    return this.backgroundApi.simpleDb.ipTable.shouldRefreshConfig();
  }
}

export default ServiceIpTable;
