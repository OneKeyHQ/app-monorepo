/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import axios from 'axios';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  IP_TABLE_CDN_FETCH_TIMEOUT_MS,
  IP_TABLE_CDN_URL,
  ONEKEY_API_HOST,
  ONEKEY_HEALTH_CHECK_URL,
  ONEKEY_TEST_API_HOST,
} from '@onekeyhq/shared/src/config/appConfig';
import {
  IP_TABLE_INITIAL_SPEED_TEST_DELAY_MS,
  IP_TABLE_PERFORMANCE_IMPROVEMENT_THRESHOLD,
  IP_TABLE_SNI_FAILURE_THRESHOLD,
  IP_TABLE_SPEED_TEST_DELAY_MS,
  IP_TABLE_SPEED_TEST_ITERATIONS,
  IP_TABLE_SPEED_TEST_TIMEOUT_MS,
} from '@onekeyhq/shared/src/request/constants/ipTableDefaults';
import {
  setReportSniFailureCallback,
  testDomainSpeed,
  testIpSpeed,
} from '@onekeyhq/shared/src/request/helpers/ipTableAdapter';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';
import type {
  IIpTableConfigWithRuntime,
  IIpTableRemoteConfig,
} from '@onekeyhq/shared/src/request/types/ipTable';
import {
  isSupportIpTablePlatform,
  mergeIpTableConfigs,
  verifyIpTableConfigSignature,
} from '@onekeyhq/shared/src/utils/ipTableUtils';

import { devSettingsPersistAtom } from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceIpTable extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async getConfig(): Promise<IIpTableConfigWithRuntime> {
    return this.backgroundApi.simpleDb.ipTable.getConfig();
  }

  @backgroundMethod()
  async saveConfig(config: IIpTableRemoteConfig) {
    await this.backgroundApi.simpleDb.ipTable.saveConfig(config);
  }

  @backgroundMethod()
  async setEnabled(enabled: boolean) {
    await this.backgroundApi.simpleDb.ipTable.setEnabled(enabled);
  }

  @backgroundMethod()
  async reset() {
    await this.backgroundApi.simpleDb.ipTable.clearAll();
  }

  @backgroundMethod()
  async shouldRefreshConfig(): Promise<boolean> {
    return this.backgroundApi.simpleDb.ipTable.shouldRefreshConfig();
  }

  private async fetchRemoteConfig(): Promise<IIpTableRemoteConfig | null> {
    try {
      console.log('[IpTable] Fetching remote config from:', IP_TABLE_CDN_URL);

      const plainAxios = axios.create();

      const headers = await getRequestHeaders();

      const response = await plainAxios.get<IIpTableRemoteConfig>(
        IP_TABLE_CDN_URL,
        {
          timeout: IP_TABLE_CDN_FETCH_TIMEOUT_MS,
          headers,
        },
      );

      const remoteConfig = response.data;

      if (!remoteConfig) {
        console.error('[IpTable] CDN returned empty config');
        return null;
      }

      console.log(
        '[IpTable] Remote config fetched successfully, version:',
        remoteConfig.version,
      );
      return remoteConfig;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          console.error(
            '[IpTable] CDN fetch timeout after',
            IP_TABLE_CDN_FETCH_TIMEOUT_MS,
            'ms',
          );
        } else {
          console.error(
            '[IpTable] CDN fetch failed:',
            error.response?.status || error.message,
          );
        }
      } else {
        console.error('[IpTable] CDN fetch error:', error);
      }
      return null;
    }
  }

  @backgroundMethod()
  async fetchAndMergeRemoteConfig(): Promise<boolean> {
    try {
      const remoteConfig = await this.fetchRemoteConfig();

      if (!remoteConfig) {
        console.log('[IpTable] Skipping CDN config update: fetch failed');
        return false;
      }

      const isValidSignature = verifyIpTableConfigSignature(remoteConfig);

      if (!isValidSignature) {
        console.error(
          '[IpTable] Skipping CDN config update: signature verification failed',
        );
        return false;
      }

      console.log('[IpTable] Remote config signature verified successfully');

      const currentConfig = await this.getConfig();
      const localConfig = currentConfig.config;

      const mergedConfig = mergeIpTableConfigs(localConfig, remoteConfig);

      console.log(
        '[IpTable] Merged config has',
        Object.keys(mergedConfig.domains).length,
        'domains',
      );

      await this.saveConfig(mergedConfig);

      console.log('[IpTable] CDN config updated successfully');
      return true;
    } catch (error) {
      console.error('[IpTable] Error in fetchAndMergeRemoteConfig:', error);
      return false;
    }
  }

  // ========== Speed Test Methods ==========

  /**
   * Helper: sleep for specified milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Test multiple times and calculate average latency
   * @param testFn - Function that returns latency
   * @returns Average latency, or Infinity if all tests failed
   */
  private async testMultipleTimes(
    testFn: () => Promise<number>,
  ): Promise<number> {
    const testResults: number[] = [];

    for (let i = 0; i < IP_TABLE_SPEED_TEST_ITERATIONS; i += 1) {
      const latency = await testFn();
      testResults.push(latency);

      // Delay between tests to avoid overwhelming the network
      if (i < IP_TABLE_SPEED_TEST_ITERATIONS - 1) {
        await this.sleep(IP_TABLE_SPEED_TEST_DELAY_MS);
      }
    }

    // Filter out failed tests (Infinity)
    const validResults = testResults.filter((l) => l !== Infinity);

    if (validResults.length === 0) {
      return Infinity; // All tests failed
    }

    // Calculate average latency
    const avgLatency =
      validResults.reduce((a, b) => a + b, 0) / validResults.length;

    return avgLatency;
  }

  /**
   * Select best endpoint for a domain
   * Compares domain direct connection vs all IPs with SNI
   * Prefers domain if IP is not significantly faster (30% threshold)
   */
  @backgroundMethod()
  async selectBestEndpointForDomain(domain: string): Promise<void> {
    console.log(`[IpTable] Starting speed test for domain: ${domain}`);

    const configWithRuntime = await this.getConfig();
    const domainConfig = configWithRuntime.config.domains[domain];

    if (!domainConfig || !domainConfig.endpoints.length) {
      console.log(`[IpTable] No endpoints configured for domain: ${domain}`);
      return;
    }

    try {
      // 1. Test domain directly
      console.log(`[IpTable] Testing domain: ${domain}`);
      const domainLatency = await this.testMultipleTimes(() =>
        testDomainSpeed(
          domain,
          ONEKEY_HEALTH_CHECK_URL,
          IP_TABLE_SPEED_TEST_TIMEOUT_MS,
        ),
      );

      console.log(
        `[IpTable] Domain test result: ${domain} -> ${domainLatency}ms`,
      );

      // 2. Test all IPs with SNI
      const ipResults = new Map<string, number>();

      for (const endpoint of domainConfig.endpoints) {
        console.log(`[IpTable] Testing IP: ${endpoint.ip} for ${domain}`);

        const ipLatency = await this.testMultipleTimes(() =>
          testIpSpeed(
            endpoint.ip,
            domain,
            ONEKEY_HEALTH_CHECK_URL,
            IP_TABLE_SPEED_TEST_TIMEOUT_MS,
          ),
        );

        ipResults.set(endpoint.ip, ipLatency);

        console.log(
          `[IpTable] IP test result: ${endpoint.ip} -> ${ipLatency}ms`,
        );
      }

      // 3. Find best IP
      let bestIp = '';
      let bestIpLatency = Infinity;

      for (const [ip, latency] of ipResults) {
        if (latency < bestIpLatency) {
          bestIpLatency = latency;
          bestIp = ip;
        }
      }

      // 4. Compare and decide
      if (domainLatency === Infinity) {
        // Domain test failed
        if (bestIpLatency !== Infinity) {
          // Use best IP
          console.log(
            `[IpTable] Domain failed, using IP: ${domain} -> ${bestIp}`,
          );
          await this.backgroundApi.simpleDb.ipTable.updateSelection(
            domain,
            bestIp,
          );
        } else {
          // All tests failed
          console.log(`[IpTable] All tests failed for ${domain}`);
        }
        return;
      }

      if (bestIpLatency === Infinity) {
        // All IP tests failed, use domain
        console.log(`[IpTable] All IP tests failed, using domain: ${domain}`);
        await this.backgroundApi.simpleDb.ipTable.updateSelection(domain, '');
        return;
      }

      // Calculate performance improvement
      const improvement = (domainLatency - bestIpLatency) / domainLatency;

      if (improvement > IP_TABLE_PERFORMANCE_IMPROVEMENT_THRESHOLD) {
        // IP is significantly faster (>30%), use IP
        console.log(
          `[IpTable] IP is ${(improvement * 100).toFixed(
            1,
          )}% faster, using IP: ${domain} -> ${bestIp}`,
        );
        await this.backgroundApi.simpleDb.ipTable.updateSelection(
          domain,
          bestIp,
        );
      } else {
        // Domain is competitive, prefer domain for stability
        console.log(
          `[IpTable] Domain is competitive (IP only ${(
            improvement * 100
          ).toFixed(1)}% faster), using domain: ${domain}`,
        );
        await this.backgroundApi.simpleDb.ipTable.updateSelection(domain, '');
      }
    } catch (error) {
      console.error(`[IpTable] Speed test failed for domain ${domain}:`, error);
    }
  }

  /**
   * Run full speed test for all domains
   * Tests all configured domains and updates selections
   */
  @backgroundMethod()
  async runFullSpeedTest(): Promise<void> {
    console.log('[IpTable] Starting full speed test');
    const configWithRuntime = await this.getConfig();

    const { enabled: devSettingEnabled, settings } =
      await devSettingsPersistAtom.get();
    const domain =
      devSettingEnabled && settings?.enableTestEndpoint
        ? ONEKEY_TEST_API_HOST
        : ONEKEY_API_HOST;

    if (configWithRuntime.config.domains[domain]) {
      await this.selectBestEndpointForDomain(domain);
    }
    console.log('[IpTable] Full speed test completed');
  }

  @backgroundMethod()
  async reportSniFailure(domain: string, ip: string): Promise<void> {
    console.log(`[IpTable] SNI failure reported: ${domain} (${ip})`);

    const errorCount = 0;
    // Trigger speed test if threshold reached
    if (errorCount >= IP_TABLE_SNI_FAILURE_THRESHOLD) {
      console.log(
        `[IpTable] Failure threshold reached for ${domain}, triggering speed test`,
      );
      void this.selectBestEndpointForDomain(domain);
    }
  }

  private scheduleSpeedTest(reason: string): void {
    console.log(
      `[IpTable] ${reason}, scheduling speed test in`,
      IP_TABLE_INITIAL_SPEED_TEST_DELAY_MS / 1000,
      's',
    );
    setTimeout(() => {
      void this.runFullSpeedTest();
    }, IP_TABLE_INITIAL_SPEED_TEST_DELAY_MS);
  }

  private async hasRuntimeSelections(): Promise<boolean> {
    const configWithRuntime = await this.getConfig();
    return Object.keys(configWithRuntime.runtime?.selections ?? {}).length > 0;
  }

  @backgroundMethod()
  async init(): Promise<void> {
    if (!isSupportIpTablePlatform()) {
      return;
    }
    console.log('[IpTable] Initializing service');

    // Register SNI failure callback
    setReportSniFailureCallback((domain, ip) => {
      void this.reportSniFailure(domain, ip);
    });

    // Try to refresh CDN config if needed
    const shouldRefresh = await this.shouldRefreshConfig();
    let needSpeedTest = false;

    if (shouldRefresh) {
      console.log(
        '[IpTable] CDN config refresh needed, fetching remote config',
      );
      const configUpdated = await this.fetchAndMergeRemoteConfig();

      needSpeedTest = true;
      if (configUpdated) {
        console.log('[IpTable] CDN config updated successfully');
      } else {
        console.log(
          '[IpTable] CDN config update failed, using local/builtin config',
        );
      }
    } else {
      console.log('[IpTable] CDN config is up to date');
      needSpeedTest = !(await this.hasRuntimeSelections());
    }

    // Execute speed test if needed
    if (needSpeedTest) {
      this.scheduleSpeedTest(
        shouldRefresh ? 'CDN config refreshed' : 'No runtime data',
      );
    }

    console.log('[IpTable] Service initialized');
  }
}

export default ServiceIpTable;
