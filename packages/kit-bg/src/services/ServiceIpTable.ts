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
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  IP_TABLE_INITIAL_SPEED_TEST_DELAY_MS,
  IP_TABLE_PERFORMANCE_IMPROVEMENT_THRESHOLD,
  IP_TABLE_SNI_FAILURE_THRESHOLD,
  IP_TABLE_SPEED_TEST_COOLDOWN_MS,
  IP_TABLE_SPEED_TEST_DELAY_MS,
  IP_TABLE_SPEED_TEST_ITERATIONS,
  IP_TABLE_SPEED_TEST_TIMEOUT_MS,
} from '@onekeyhq/shared/src/request/constants/ipTableDefaults';
import {
  getSelectedIpForHost,
  setReportRequestFailureCallback,
  testDomainSpeed,
  testIpSpeed,
} from '@onekeyhq/shared/src/request/helpers/ipTableAdapter';
import { isSniSupported } from '@onekeyhq/shared/src/request/helpers/sniRequest';
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

/**
 * Endpoint health statistics
 */
interface IEndpointHealth {
  /** Total failure count */
  failureCount: number;
  /** Consecutive failure count (resets on success) */
  consecutiveFailures: number;
  /** Timestamp of last failure */
  lastFailureTime: number;
}

/**
 * Domain health statistics
 * Tracks both IP endpoints and direct domain connection health
 */
interface IDomainHealthStats {
  /** Health stats for each IP endpoint */
  ipEndpoints: Map<string, IEndpointHealth>;
  /** Health stats for direct domain connection */
  domainDirect: IEndpointHealth;
  /** Timestamp of last speed test */
  lastSpeedTestTime: number;
}

@backgroundClass()
class ServiceIpTable extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  // Domain health tracker: Map<"domain", IDomainHealthStats>
  // Tracks failures for both IP endpoints and direct domain connections
  private domainHealthMap = new Map<string, IDomainHealthStats>();

  /**
   * Check if IP Table is enabled considering all conditions:
   * 1. Platform support
   * 2. runtime.enabled
   * 3. devSettings conditions (disableIpTableInProd)
   * @returns true if IP Table should be active, false otherwise
   */
  private async isIpTableEnabled(): Promise<boolean> {
    // 1. Check platform support
    if (!isSupportIpTablePlatform()) {
      return false;
    }

    // 2. Check runtime.enabled
    const configWithRuntime = await this.getConfig();
    if (configWithRuntime.runtime?.enabled === false) {
      return false;
    }

    // 3. Check devSettings (align with ipTableAdapter.ts shouldUseIpTable logic)
    try {
      const devSettings = await devSettingsPersistAtom.get();

      // Prod environment override - if explicitly disabled, respect it
      if (devSettings.settings?.disableIpTableInProd) {
        return false;
      }

      return true;
    } catch (error) {
      defaultLogger.ipTable.request.warn({
        info: `[IpTable] Failed to check devSettings, defaulting to enabled: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      });
      return true;
    }
  }

  /**
   * Get or initialize domain health stats
   */
  private getDomainHealth(domain: string): IDomainHealthStats {
    let stats = this.domainHealthMap.get(domain);
    if (!stats) {
      stats = {
        ipEndpoints: new Map(),
        domainDirect: {
          failureCount: 0,
          consecutiveFailures: 0,
          lastFailureTime: 0,
        },
        lastSpeedTestTime: 0,
      };
      this.domainHealthMap.set(domain, stats);
    }
    return stats;
  }

  /**
   * Get or initialize endpoint health
   */
  private getEndpointHealth(
    stats: IDomainHealthStats,
    requestType: 'ip' | 'domain',
    target: string,
  ): IEndpointHealth {
    if (requestType === 'domain') {
      return stats.domainDirect;
    }

    let endpointHealth = stats.ipEndpoints.get(target);
    if (!endpointHealth) {
      endpointHealth = {
        failureCount: 0,
        consecutiveFailures: 0,
        lastFailureTime: 0,
      };
      stats.ipEndpoints.set(target, endpointHealth);
    }
    return endpointHealth;
  }

  /**
   * Check if speed test should be triggered based on health stats
   * Returns true only when current endpoint is failing AND cooldown period has passed
   */
  private async shouldTriggerSpeedTest(
    domain: string,
    stats: IDomainHealthStats,
  ): Promise<boolean> {
    const now = Date.now();
    const timeSinceLastTest = now - stats.lastSpeedTestTime;

    // Check cooldown period (5 minutes)
    if (timeSinceLastTest < IP_TABLE_SPEED_TEST_COOLDOWN_MS) {
      return false;
    }

    // Get current selection to determine which endpoint is active
    const configWithRuntime = await this.getConfig();
    const currentSelection = configWithRuntime.runtime?.selections?.[domain];

    // Check if current active endpoint is failing
    if (currentSelection === undefined) {
      // No selection yet, don't trigger
      return false;
    }

    if (currentSelection === '') {
      // Using domain directly
      return (
        stats.domainDirect.consecutiveFailures >= IP_TABLE_SNI_FAILURE_THRESHOLD
      );
    }

    // Using specific IP
    const ipHealth = stats.ipEndpoints.get(currentSelection);
    return (
      (ipHealth?.consecutiveFailures ?? 0) >= IP_TABLE_SNI_FAILURE_THRESHOLD
    );
  }

  @backgroundMethod()
  async getConfig(): Promise<IIpTableConfigWithRuntime> {
    return this.backgroundApi.simpleDb.ipTable.getConfig();
  }

  private async getConnectionInfo(): Promise<{
    type: 'ip' | 'domain';
    ip?: string;
    domain: string;
    sniSupported: boolean;
  }> {
    // Determine domain based on devSettings
    const { enabled: devSettingEnabled, settings } =
      await devSettingsPersistAtom.get();
    const domain =
      devSettingEnabled && settings?.enableTestEndpoint
        ? ONEKEY_TEST_API_HOST
        : ONEKEY_API_HOST;

    const sniSupported = isSniSupported();

    // 1. Check platform support
    if (!sniSupported) {
      return {
        type: 'domain',
        domain,
        sniSupported: false,
      };
    }

    // 2. Check if IP Table is enabled (includes runtime.enabled and devSettings check)
    const ipTableEnabled = await this.isIpTableEnabled();
    if (!ipTableEnabled) {
      return {
        type: 'domain',
        domain,
        sniSupported: true,
      };
    }

    // 3. Get selected IP for this domain (use wallet.{domain} as hostname)
    const hostname = `wallet.${domain}`;
    const selectedIp = await getSelectedIpForHost(hostname);

    if (selectedIp) {
      return {
        type: 'ip',
        ip: selectedIp,
        domain,
        sniSupported: true,
      };
    }

    return {
      type: 'domain',
      domain,
      sniSupported: true,
    };
  }

  @backgroundMethod()
  async isUsingIpConnection(): Promise<boolean> {
    const connectionInfo = await this.getConnectionInfo();
    return connectionInfo.type === 'ip';
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
      defaultLogger.ipTable.request.info({
        info: `[IpTable] Fetching remote config from: ${IP_TABLE_CDN_URL}`,
      });

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
        defaultLogger.ipTable.request.error({
          info: '[IpTable] CDN returned empty config',
        });
        return null;
      }

      defaultLogger.ipTable.request.info({
        info: `[IpTable] Remote config fetched successfully, version: ${remoteConfig.version}`,
      });
      return remoteConfig;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          defaultLogger.ipTable.request.error({
            info: `[IpTable] CDN fetch timeout after ${IP_TABLE_CDN_FETCH_TIMEOUT_MS} ms`,
          });
        } else {
          defaultLogger.ipTable.request.error({
            info: `[IpTable] CDN fetch failed: ${
              error.response?.status || error.message
            }`,
          });
        }
      } else {
        defaultLogger.ipTable.request.error({
          info: `[IpTable] CDN fetch error: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        });
      }
      return null;
    }
  }

  @backgroundMethod()
  async fetchAndMergeRemoteConfig(): Promise<boolean> {
    try {
      const remoteConfig = await this.fetchRemoteConfig();

      if (!remoteConfig) {
        defaultLogger.ipTable.request.info({
          info: '[IpTable] Skipping CDN config update: fetch failed',
        });
        return false;
      }

      const isValidSignature = verifyIpTableConfigSignature(remoteConfig);

      if (!isValidSignature) {
        defaultLogger.ipTable.request.error({
          info: '[IpTable] Skipping CDN config update: signature verification failed',
        });
        return false;
      }

      defaultLogger.ipTable.request.info({
        info: '[IpTable] Remote config signature verified successfully',
      });

      const currentConfig = await this.getConfig();
      const localConfig = currentConfig.config;

      const mergedConfig = mergeIpTableConfigs(localConfig, remoteConfig);

      defaultLogger.ipTable.request.info({
        info: `[IpTable] Merged config has ${
          Object.keys(mergedConfig.domains).length
        } domains`,
      });

      await this.saveConfig(mergedConfig);

      defaultLogger.ipTable.request.info({
        info: '[IpTable] CDN config updated successfully',
      });
      return true;
    } catch (error) {
      defaultLogger.ipTable.request.error({
        info: `[IpTable] Error in fetchAndMergeRemoteConfig: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      });
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
   * Clean up health statistics after speed test
   * Removes health data for IPs that are no longer selected (memory optimization)
   * Keeps health data for the currently selected endpoint for continued monitoring
   */
  private async cleanupHealthStatsAfterSpeedTest(
    domain: string,
  ): Promise<void> {
    const stats = this.getDomainHealth(domain);
    const configWithRuntime = await this.getConfig();
    const currentSelection = configWithRuntime.runtime?.selections?.[domain];

    // If using domain directly, clean up all IP health stats
    if (!currentSelection || currentSelection === '') {
      if (stats.ipEndpoints.size > 0) {
        defaultLogger.ipTable.request.info({
          info: `[IpTable] Cleanup: Removing health stats for ${stats.ipEndpoints.size} unused IPs (using domain)`,
        });
        stats.ipEndpoints.clear();
      }
      return;
    }

    // If using specific IP, keep only that IP's health stats
    const currentIp = currentSelection;
    const ipsToRemove: string[] = [];

    stats.ipEndpoints.forEach((_health, ip) => {
      if (ip !== currentIp) {
        ipsToRemove.push(ip);
      }
    });

    if (ipsToRemove.length > 0) {
      defaultLogger.ipTable.request.info({
        info: `[IpTable] Cleanup: Removing health stats for ${ipsToRemove.length} unused IPs (keeping ${currentIp})`,
      });
      ipsToRemove.forEach((ip) => {
        stats.ipEndpoints.delete(ip);
      });
    }
  }

  /**
   * Select best endpoint for a domain
   * Compares domain direct connection vs all IPs with SNI
   * Prefers domain if IP is not significantly faster (30% threshold)
   */
  @backgroundMethod()
  async selectBestEndpointForDomain(domain: string): Promise<void> {
    // Check if IP Table is enabled
    if (!(await this.isIpTableEnabled())) {
      defaultLogger.ipTable.request.info({
        info: `[IpTable] Speed test skipped for ${domain}: IP Table is disabled`,
      });
      return;
    }

    defaultLogger.ipTable.request.info({
      info: `[IpTable] Starting speed test for domain: ${domain}`,
    });

    const configWithRuntime = await this.getConfig();
    const domainConfig = configWithRuntime.config.domains[domain];

    if (!domainConfig || !domainConfig.endpoints.length) {
      defaultLogger.ipTable.request.info({
        info: `[IpTable] No endpoints configured for domain: ${domain}`,
      });
      return;
    }

    try {
      // 1. Test domain directly
      defaultLogger.ipTable.request.info({
        info: `[IpTable] Testing domain: ${domain}`,
      });
      const domainLatency = await this.testMultipleTimes(() =>
        testDomainSpeed(
          domain,
          ONEKEY_HEALTH_CHECK_URL,
          IP_TABLE_SPEED_TEST_TIMEOUT_MS,
        ),
      );

      defaultLogger.ipTable.request.info({
        info: `[IpTable] Domain test result: ${domain} -> ${domainLatency}ms`,
      });

      // 2. Test all IPs with SNI
      const ipResults = new Map<string, number>();

      for (const endpoint of domainConfig.endpoints) {
        defaultLogger.ipTable.request.info({
          info: `[IpTable] Testing IP: ${endpoint.ip} for ${domain}`,
        });

        const ipLatency = await this.testMultipleTimes(() =>
          testIpSpeed(
            endpoint.ip,
            domain,
            ONEKEY_HEALTH_CHECK_URL,
            IP_TABLE_SPEED_TEST_TIMEOUT_MS,
          ),
        );

        ipResults.set(endpoint.ip, ipLatency);

        defaultLogger.ipTable.request.info({
          info: `[IpTable] IP test result: ${endpoint.ip} -> ${ipLatency}ms`,
        });
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
          defaultLogger.ipTable.request.info({
            info: `[IpTable] Domain failed, using IP: ${domain} -> ${bestIp}`,
          });
          await this.backgroundApi.simpleDb.ipTable.updateSelection(
            domain,
            bestIp,
          );
        } else {
          // All tests failed
          defaultLogger.ipTable.request.info({
            info: `[IpTable] All tests failed for ${domain}`,
          });
        }
        return;
      }

      if (bestIpLatency === Infinity) {
        // All IP tests failed, use domain
        defaultLogger.ipTable.request.info({
          info: `[IpTable] All IP tests failed, using domain: ${domain}`,
        });
        await this.backgroundApi.simpleDb.ipTable.updateSelection(domain, '');
        return;
      }

      // Check if forceIpTableStrict mode is enabled
      const { enabled: devSettingEnabled, settings } =
        await devSettingsPersistAtom.get();
      const forceIpTableStrict =
        devSettingEnabled && settings?.forceIpTableStrict;
      // In strict mode, always use IP if available (regardless of domain speed)
      if (forceIpTableStrict) {
        defaultLogger.ipTable.request.info({
          info: `[IpTable] [STRICT MODE] Using best IP: ${domain} -> ${bestIp} (${bestIpLatency}ms)`,
        });
        await this.backgroundApi.simpleDb.ipTable.updateSelection(
          domain,
          bestIp,
        );
        return;
      }

      // Normal mode: use threshold-based decision
      // Calculate performance improvement
      const improvement = (domainLatency - bestIpLatency) / domainLatency;

      if (improvement > IP_TABLE_PERFORMANCE_IMPROVEMENT_THRESHOLD) {
        // IP is significantly faster (>30%), use IP
        defaultLogger.ipTable.request.info({
          info: `[IpTable] IP is ${(improvement * 100).toFixed(
            1,
          )}% faster, using IP: ${domain} -> ${bestIp}`,
        });
        await this.backgroundApi.simpleDb.ipTable.updateSelection(
          domain,
          bestIp,
        );
      } else {
        // Domain is competitive, prefer domain for stability
        defaultLogger.ipTable.request.info({
          info: `[IpTable] Domain is competitive (IP only ${(
            improvement * 100
          ).toFixed(1)}% faster), using domain: ${domain}`,
        });
        await this.backgroundApi.simpleDb.ipTable.updateSelection(domain, '');
      }

      // Clean up health stats for unused endpoints after speed test
      await this.cleanupHealthStatsAfterSpeedTest(domain);
    } catch (error) {
      defaultLogger.ipTable.request.error({
        info: `[IpTable] Speed test failed for domain ${domain}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      });
    }
  }

  /**
   * Run full speed test for all domains
   * Tests all configured domains and updates selections
   */
  @backgroundMethod()
  async runFullSpeedTest(): Promise<void> {
    // Check if IP Table is enabled
    if (!(await this.isIpTableEnabled())) {
      defaultLogger.ipTable.request.info({
        info: '[IpTable] Full speed test skipped: IP Table is disabled',
      });
      return;
    }

    defaultLogger.ipTable.request.info({
      info: '[IpTable] Starting full speed test',
    });
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
    defaultLogger.ipTable.request.info({
      info: '[IpTable] Full speed test completed',
    });
  }

  /**
   * Report request failure (IP or domain)
   * Tracks failures with separate statistics and triggers speed test when appropriate
   */
  @backgroundMethod()
  async reportRequestFailure(
    domain: string,
    requestType: 'ip' | 'domain',
    target: string,
  ): Promise<void> {
    // Check if IP Table is enabled
    if (!(await this.isIpTableEnabled())) {
      return;
    }

    const now = Date.now();

    // Get or initialize domain health stats
    const stats = this.getDomainHealth(domain);

    // Get or initialize endpoint health
    const endpointHealth = this.getEndpointHealth(stats, requestType, target);

    // Update failure statistics
    endpointHealth.failureCount += 1;
    endpointHealth.consecutiveFailures += 1;
    endpointHealth.lastFailureTime = now;

    defaultLogger.ipTable.request.warn({
      info: `[IpTable] ${requestType === 'ip' ? 'IP' : 'Domain'} failure #${
        endpointHealth.failureCount
      } (consecutive: ${
        endpointHealth.consecutiveFailures
      }) for ${domain} (${target})`,
    });

    // Check if speed test should be triggered
    const shouldTrigger = await this.shouldTriggerSpeedTest(domain, stats);

    if (!shouldTrigger) {
      // Log reason for not triggering
      const timeSinceLastTest = now - stats.lastSpeedTestTime;
      if (timeSinceLastTest < IP_TABLE_SPEED_TEST_COOLDOWN_MS) {
        const remainingCooldown = Math.ceil(
          (IP_TABLE_SPEED_TEST_COOLDOWN_MS - timeSinceLastTest) / 1000,
        );
        defaultLogger.ipTable.request.info({
          info: `[IpTable] Speed test not triggered: cooldown period (${remainingCooldown}s remaining)`,
        });
      } else {
        defaultLogger.ipTable.request.info({
          info: `[IpTable] Speed test not triggered: current endpoint not failing or threshold not reached`,
        });
      }
      return;
    }

    defaultLogger.ipTable.request.error({
      info: `[IpTable] Current endpoint failure threshold reached for ${domain}, triggering speed test`,
    });

    // Update last speed test timestamp
    stats.lastSpeedTestTime = now;

    // Reset all consecutive failure counters for this domain (they'll be recounted after speed test)
    stats.domainDirect.consecutiveFailures = 0;
    stats.ipEndpoints.forEach((health) => {
      health.consecutiveFailures = 0;
    });

    // Trigger speed test to find and switch to better endpoint
    void this.selectBestEndpointForDomain(domain);
  }

  private scheduleSpeedTest(reason: string): void {
    defaultLogger.ipTable.request.info({
      info: `[IpTable] ${reason}, scheduling speed test in ${
        IP_TABLE_INITIAL_SPEED_TEST_DELAY_MS / 1000
      } s`,
    });
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
    if (!(await this.isIpTableEnabled())) {
      return;
    }
    defaultLogger.ipTable.request.info({
      info: '[IpTable] Initializing service',
    });

    // Register request failure callback (handles both IP and domain failures)
    setReportRequestFailureCallback(({ domain, requestType, target }) => {
      void this.reportRequestFailure(domain, requestType, target);
    });

    // Try to refresh CDN config if needed
    const shouldRefresh = await this.shouldRefreshConfig();
    let needSpeedTest = false;

    if (shouldRefresh) {
      defaultLogger.ipTable.request.info({
        info: '[IpTable] CDN config refresh needed, fetching remote config',
      });
      const configUpdated = await this.fetchAndMergeRemoteConfig();

      needSpeedTest = true;
      if (configUpdated) {
        defaultLogger.ipTable.request.info({
          info: '[IpTable] CDN config updated successfully',
        });
      } else {
        defaultLogger.ipTable.request.info({
          info: '[IpTable] CDN config update failed, using local/builtin config',
        });
      }
    } else {
      defaultLogger.ipTable.request.info({
        info: '[IpTable] CDN config is up to date',
      });
      needSpeedTest = !(await this.hasRuntimeSelections());
    }

    // Execute speed test if needed
    if (needSpeedTest) {
      this.scheduleSpeedTest(
        shouldRefresh ? 'CDN config refreshed' : 'No runtime data',
      );
    }

    defaultLogger.ipTable.request.info({
      info: '[IpTable] Service initialized',
    });
  }
}

export default ServiceIpTable;
