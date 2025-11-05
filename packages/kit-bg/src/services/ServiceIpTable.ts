/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IIpTableConfig } from '@onekeyhq/shared/src/request/types/ipTable';

import ServiceBase from './ServiceBase';

/**
 * IP Table Configuration Service
 *
 * Simplified design:
 * - Only manages configuration (get/set)
 * - No error tracking (use logging/analytics)
 * - No automatic IP switching (fail fast to domain)
 * - Only global enable/disable switch
 */
@backgroundClass()
class ServiceIpTable extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  /**
   * Get current IP Table configuration
   * @returns Current configuration or null if not initialized
   */
  @backgroundMethod()
  async getConfig(): Promise<IIpTableConfig | null> {
    return this.backgroundApi.simpleDb.ipTable.getConfig();
  }

  /**
   * Initialize or update IP Table configuration
   * @param config - New configuration
   */
  @backgroundMethod()
  async setConfig(config: IIpTableConfig) {
    await this.backgroundApi.simpleDb.ipTable.setConfig(config);
  }

  /**
   * Enable/disable IP Table globally
   * @param enabled - Whether to enable
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
}

export default ServiceIpTable;
