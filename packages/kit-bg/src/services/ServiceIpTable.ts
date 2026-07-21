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
  IP_TABLE_DOMAIN_FAILOVER_THRESHOLD,
  IP_TABLE_INITIAL_SPEED_TEST_DELAY_MS,
  IP_TABLE_PERFORMANCE_IMPROVEMENT_THRESHOLD,
  IP_TABLE_SNI_FAILURE_THRESHOLD,
  IP_TABLE_SPEED_TEST_COOLDOWN_MS,
  IP_TABLE_SPEED_TEST_DELAY_MS,
  IP_TABLE_SPEED_TEST_ITERATIONS,
  IP_TABLE_SPEED_TEST_TIMEOUT_MS,
} from '@onekeyhq/shared/src/request/constants/ipTableDefaults';
import {
  createAxiosWithIpTable,
  getSelectedIpForHost,
  setReportRequestFailureCallback,
  setReportRequestSuccessCallback,
  testDomainSpeed,
  testIpSpeed,
} from '@onekeyhq/shared/src/request/helpers/ipTableAdapter';
import { decideEndpoint } from '@onekeyhq/shared/src/request/helpers/ipTableEndpointDecision';
import {
  applyOutcome,
  nextIpTableRequestSequence,
} from '@onekeyhq/shared/src/request/helpers/ipTableOutcomeLedger';
import {
  isProxyActiveForUrl,
  isSniSupported,
  sniRequest,
} from '@onekeyhq/shared/src/request/helpers/sniRequest';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';
import type {
  IIpTableConfigWithRuntime,
  IIpTableRemoteConfig,
} from '@onekeyhq/shared/src/request/types/ipTable';
import {
  computeIpTableConfigHash,
  isIpTableConfigRegression,
  isSupportIpTablePlatform,
  isValidIpTableRemoteConfigShape,
  verifyIpTableConfigSignatureDetailed,
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
  /** Runtime-local request sequence of the latest successful request */
  latestSuccessSequence: number;
  /** Failure request sequences newer than latestSuccessSequence */
  failureSequences: Set<number>;
}

/**
 * Domain health statistics
 * Tracks both IP endpoints and direct domain connection health
 */
interface IDomainHealthStats {
  /** Health stats for each IP endpoint */
  ipEndpoints: Map<string, IEndpointHealth>;
  /**
   * Direct-domain health tracked per hostname (wallet./utility./...): a
   * success on one hostname must not clear another hostname's failures, and
   * different hostnames' failures must not jointly reach a threshold. Root
   * domain routing decisions aggregate over these explicitly. Mirrors the
   * adapter-side per-hostname ledger so main and bg runtimes agree.
   */
  directHosts: Map<string, IEndpointHealth>;
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
        directHosts: new Map(),
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
    // For domain requests, target is the hostname; for ip requests it is the
    // ip. Both are tracked per target so outcomes of one never contaminate
    // another's counters.
    const bucket =
      requestType === 'domain' ? stats.directHosts : stats.ipEndpoints;
    let endpointHealth = bucket.get(target);
    if (!endpointHealth) {
      endpointHealth = {
        failureCount: 0,
        consecutiveFailures: 0,
        lastFailureTime: 0,
        latestSuccessSequence: 0,
        failureSequences: new Set(),
      };
      bucket.set(target, endpointHealth);
    }
    return endpointHealth;
  }

  /** Highest consecutive direct-domain failure count across hostnames */
  private getMaxDirectConsecutiveFailures(stats: IDomainHealthStats): number {
    let max = 0;
    stats.directHosts.forEach((health) => {
      max = Math.max(max, health.consecutiveFailures);
    });
    return max;
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

    // Check if current active endpoint is failing.
    // undefined means no selection was ever made — real traffic goes direct
    // to the domain in that state, so judge by the domain's health instead of
    // never triggering (the old `return false` deadlocked selection forever
    // when the initial speed test had not completed).
    if (currentSelection === undefined || currentSelection === '') {
      // Aggregate across hostnames: any single hostname consistently failing
      // is enough to justify a probing round for the root domain.
      return (
        this.getMaxDirectConsecutiveFailures(stats) >=
        IP_TABLE_SNI_FAILURE_THRESHOLD
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

  @backgroundMethod()
  async getConnectionInfo(): Promise<{
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

      // Fetch the config through the IP-Table-capable client: the config CDN
      // (config.onekeycn.com) shares the walled root domain, so this fetch
      // needs the same fail-open protection as business traffic. No cycle:
      // endpoint selection only reads the local simpleDb/builtin table.
      const plainAxios = createAxiosWithIpTable({
        timeout: IP_TABLE_CDN_FETCH_TIMEOUT_MS,
      });

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
        return this.fetchRemoteConfigViaSniFallback();
      }

      // A misconfigured CDN edge can return HTML or a truncated body that
      // still parses; reject it here so the log points at the delivery
      // layer instead of a bogus "signature verification failed".
      if (!isValidIpTableRemoteConfigShape(remoteConfig)) {
        defaultLogger.ipTable.request.error({
          info: '[IpTable] Skipping CDN config update: invalid config shape (delivery-layer problem)',
        });
        return this.fetchRemoteConfigViaSniFallback();
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
      // The adapter's fail-open needs 3 accumulated transport failures in
      // THIS runtime, which a fresh install's single config GET can never
      // reach. The config GET is idempotent, so replaying it over SNI with
      // known candidate IPs is safe and gives first-run devices on walled
      // networks a working config path.
      return this.fetchRemoteConfigViaSniFallback();
    }
  }

  /**
   * Direct SNI fallback for the CDN config GET: selection -> last-best IP ->
   * builtin endpoints, first parseable and well-shaped response wins.
   */
  private async fetchRemoteConfigViaSniFallback(): Promise<IIpTableRemoteConfig | null> {
    try {
      if (!isSupportIpTablePlatform() || !isSniSupported()) {
        return null;
      }
      let proxyActive: boolean | null = null;
      try {
        proxyActive = await isProxyActiveForUrl(IP_TABLE_CDN_URL);
      } catch {
        return null;
      }
      if (proxyActive === true) {
        // A user proxy owns routing; do not bypass it with SNI.
        return null;
      }

      const url = new URL(IP_TABLE_CDN_URL);
      const rootDomain = url.hostname.split('.').slice(-2).join('.');
      const configWithRuntime = await this.getConfig();

      const candidates: string[] = [];
      const selectedIp = configWithRuntime.runtime?.selections?.[rootDomain];
      const lastBestIp = configWithRuntime.runtime?.lastBestIp?.[rootDomain];
      if (selectedIp) {
        candidates.push(selectedIp);
      }
      if (lastBestIp) {
        candidates.push(lastBestIp);
      }
      for (const endpoint of configWithRuntime.config.domains[rootDomain]
        ?.endpoints ?? []) {
        candidates.push(endpoint.ip);
      }
      const uniqueCandidates = [...new Set(candidates)].slice(0, 3);
      if (uniqueCandidates.length === 0) {
        return null;
      }

      const headers = await getRequestHeaders();
      for (const ip of uniqueCandidates) {
        try {
          defaultLogger.ipTable.request.info({
            info: `[IpTable] CDN fetch fallback: trying SNI candidate for ${url.hostname}`,
          });
          const response = await sniRequest({
            ip,
            hostname: url.hostname,
            path: `${url.pathname}${url.search}`,
            headers,
            method: 'GET',
            body: null,
            timeout: IP_TABLE_CDN_FETCH_TIMEOUT_MS,
          });
          const body = response?.body ?? response?.data;
          if (body) {
            const parsed: unknown =
              typeof body === 'string' ? JSON.parse(body) : body;
            if (isValidIpTableRemoteConfigShape(parsed)) {
              defaultLogger.ipTable.request.info({
                info: `[IpTable] CDN fetch fallback succeeded via SNI, version: ${parsed.version}`,
              });
              return parsed;
            }
          }
        } catch (error) {
          defaultLogger.ipTable.request.warn({
            info: `[IpTable] CDN fetch fallback candidate failed: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          });
        }
      }
      return null;
    } catch (error) {
      defaultLogger.ipTable.request.warn({
        info: `[IpTable] CDN fetch fallback error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      });
      return null;
    }
  }

  @backgroundMethod()
  async fetchAndApplyRemoteConfig(): Promise<boolean> {
    try {
      const remoteConfig = await this.fetchRemoteConfig();

      if (!remoteConfig) {
        defaultLogger.ipTable.request.info({
          info: '[IpTable] Skipping CDN config update: fetch failed',
        });
        return false;
      }

      const verifyResult =
        await verifyIpTableConfigSignatureDetailed(remoteConfig);

      if (!verifyResult.ok) {
        // Keep the failure stage in the message: `verifier_load_failed` is a
        // packaging/runtime problem (e.g. split-bundle segment refused),
        // NOT an untrusted signature — they need different owners.
        defaultLogger.ipTable.request.error({
          info: `[IpTable] Skipping CDN config update: signature verification failed, reason=${verifyResult.reason}`,
        });
        defaultLogger.ipTable.metrics.configVerifyFailed({
          reason: verifyResult.reason,
          configVersion: remoteConfig.version,
          payloadHash: computeIpTableConfigHash(remoteConfig),
        });
        return false;
      }

      defaultLogger.ipTable.request.info({
        info: '[IpTable] Remote config signature verified successfully',
      });

      const currentConfig = await this.getConfig();
      const localConfig = currentConfig.config;
      const lastVerified = currentConfig.runtime?.lastVerified;

      // Rollback protection: refuse configs older than what we already
      // verified. Falls back to the active config's own version/generated_at
      // as the anchor when no lastVerified exists yet (pre-upgrade installs).
      const regressionCheck = isIpTableConfigRegression({
        remoteConfig,
        localConfig,
        lastVerified,
      });
      if (regressionCheck.regression) {
        defaultLogger.ipTable.request.error({
          info: `[IpTable] Rejecting CDN config update: ${
            regressionCheck.reason ?? 'regression'
          } (remote v${remoteConfig.version}@${remoteConfig.generated_at}, local v${localConfig.version})`,
        });
        return false;
      }

      // Persist the signed remote envelope VERBATIM. Merging local endpoints
      // in would make the effective config diverge from what the signature
      // (and the persisted payloadHash) covers, and would make endpoints
      // irrevocable: a compromised or rotated-out IP removed from the CDN
      // config must actually disappear, including any runtime selection or
      // last-best IP that still points at it (pruned inside saveConfig).
      defaultLogger.ipTable.request.info({
        info: `[IpTable] Applying signed remote config with ${
          Object.keys(remoteConfig.domains).length
        } domains`,
      });

      await this.backgroundApi.simpleDb.ipTable.saveConfig(remoteConfig, {
        payloadHash: computeIpTableConfigHash(remoteConfig),
      });

      defaultLogger.ipTable.request.info({
        info: '[IpTable] CDN config updated successfully',
      });
      return true;
    } catch (error) {
      defaultLogger.ipTable.request.error({
        info: `[IpTable] Error in fetchAndApplyRemoteConfig: ${
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

  // Coalesce concurrent speed tests per domain (anti probe-storm): the log
  // of the 2026-07-16 incident shows ~20 concurrent rounds saturating an
  // already congested network and polluting the latency measurements.
  private speedTestInFlight = new Map<
    string,
    {
      promise: Promise<void>;
      trigger: 'domain_failure' | 'ip_failure' | 'periodic';
    }
  >();

  // Monotonic per-domain token bumped on every selection write. A speed test
  // captures it at start and must not apply a stale result if someone else
  // (e.g. fast failover) wrote a selection while it was probing.
  private selectionGeneration = new Map<string, number>();

  private bumpSelectionGeneration(domain: string): void {
    this.selectionGeneration.set(
      domain,
      (this.selectionGeneration.get(domain) ?? 0) + 1,
    );
  }

  private async applySelection(domain: string, ip: string): Promise<void> {
    this.bumpSelectionGeneration(domain);
    await this.backgroundApi.simpleDb.ipTable.updateSelection(domain, ip);
  }

  /**
   * Select best endpoint for a domain
   * Compares domain direct connection vs all IPs with SNI via the pure
   * decision policy (reachability-first + hysteresis). When triggered by
   * real-traffic domain failures, any reachable IP wins regardless of the
   * latency threshold.
   */
  // Domains that reported real-traffic domain failures while a weaker-trigger
  // speed test was in flight; a follow-up domain_failure round runs for them
  // so the reachability-first escalation is never silently coalesced away.
  private pendingDomainFailureRerun = new Set<string>();

  // A signed config can change while a probing round is in flight. Keep the
  // original trigger so the completed stale round can be discarded and one
  // fresh round can run against the newly endorsed endpoint set.
  private pendingConfigChangeRerun = new Map<
    string,
    'domain_failure' | 'ip_failure' | 'periodic'
  >();

  @backgroundMethod()
  async selectBestEndpointForDomain(
    domain: string,
    opts?: { trigger?: 'domain_failure' | 'ip_failure' | 'periodic' },
  ): Promise<void> {
    // The kill switch must disable EVERY failover behavior, including the
    // reachability-first override that `domain_failure` grants inside
    // decideEndpoint (which ignores the 30% threshold). Downgrading the
    // trigger here covers the decision override, the stale-write authority
    // and the coalescing escalation in one place.
    if (
      opts?.trigger === 'domain_failure' &&
      (await this.isFailoverDisabledByDevSettings())
    ) {
      defaultLogger.ipTable.request.info({
        info: `[IpTable] Failover disabled by dev settings: downgrading domain_failure trigger to periodic for ${domain}`,
      });
      // eslint-disable-next-line no-param-reassign
      opts = { trigger: 'periodic' };
    }
    const inflight = this.speedTestInFlight.get(domain);
    if (inflight) {
      // Do not let a stronger trigger be swallowed by a weaker in-flight
      // run: the merged run would compute with domainFailingRealTraffic set
      // to false and could keep a failing domain selected (the exact
      // 2026-07-16 incident shape). Queue one follow-up round instead.
      if (
        opts?.trigger === 'domain_failure' &&
        inflight.trigger !== 'domain_failure'
      ) {
        this.pendingDomainFailureRerun.add(domain);
        defaultLogger.ipTable.request.warn({
          info: `[IpTable] Speed test in flight for ${domain} (trigger=${inflight.trigger}); queueing domain_failure follow-up round`,
        });
      } else {
        defaultLogger.ipTable.request.info({
          info: `[IpTable] Speed test already in flight for ${domain}, coalescing`,
        });
      }
      return inflight.promise;
    }
    const trigger = opts?.trigger ?? 'periodic';
    const promise = this.selectBestEndpointForDomainInternal(
      domain,
      opts,
    ).finally(() => {
      this.speedTestInFlight.delete(domain);
      const configChangeTrigger = this.pendingConfigChangeRerun.get(domain);
      this.pendingConfigChangeRerun.delete(domain);
      if (this.pendingDomainFailureRerun.delete(domain)) {
        void this.selectBestEndpointForDomain(domain, {
          trigger: 'domain_failure',
        });
      } else if (configChangeTrigger) {
        void this.selectBestEndpointForDomain(domain, {
          trigger: configChangeTrigger,
        });
      }
    });
    this.speedTestInFlight.set(domain, { promise, trigger });
    return promise;
  }

  private async selectBestEndpointForDomainInternal(
    domain: string,
    opts?: { trigger?: 'domain_failure' | 'ip_failure' | 'periodic' },
  ): Promise<void> {
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

    const startConfigVersion = configWithRuntime.config.version;
    const startConfigHash = computeIpTableConfigHash(configWithRuntime.config);

    // A probing round can take tens of seconds; capture the selection
    // generation so a stale result cannot overwrite a fast failover that
    // happened while we were measuring.
    const startGeneration = this.selectionGeneration.get(domain) ?? 0;

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

      // 3. Decide via pure policy (reachability-first + hysteresis)
      const { enabled: devSettingEnabled, settings } =
        await devSettingsPersistAtom.get();
      const strictMode = Boolean(
        devSettingEnabled && settings?.forceIpTableStrict,
      );
      const currentSelection = configWithRuntime.runtime?.selections?.[domain];

      const ipLatencies: Record<string, number> = {};
      for (const [ip, latency] of ipResults) {
        ipLatencies[ip] = latency;
      }

      const decision = decideEndpoint({
        domainLatency,
        ipLatencies,
        currentSelection,
        domainFailingRealTraffic: opts?.trigger === 'domain_failure',
        strictMode,
        improvementThreshold: IP_TABLE_PERFORMANCE_IMPROVEMENT_THRESHOLD,
      });

      // Persist the best measured IP for fast failover, regardless of the
      // final decision — it is the candidate we switch to when the direct
      // domain starts failing real traffic.
      const bestMeasuredIp = Object.entries(ipLatencies)
        .filter(([, latency]) => latency !== Infinity)
        .toSorted((a, b) => a[1] - b[1])[0]?.[0];

      defaultLogger.ipTable.request.info({
        info: `[IpTable] Endpoint decision for ${domain}: ${decision.action} (${
          decision.reason
        }) trigger=${opts?.trigger ?? 'periodic'} domainLatency=${domainLatency}ms`,
      });

      // Compare-and-set: someone (fast failover, another round) wrote a
      // selection while this round was probing. A weaker-trigger result
      // computed from pre-write state must not clobber it; domain_failure
      // results stay authoritative because they encode live traffic reality.
      const currentGeneration = this.selectionGeneration.get(domain) ?? 0;
      if (
        currentGeneration !== startGeneration &&
        opts?.trigger !== 'domain_failure'
      ) {
        defaultLogger.ipTable.request.warn({
          info: `[IpTable] Discarding stale speed test result for ${domain}: selection changed while probing (trigger=${
            opts?.trigger ?? 'periodic'
          })`,
        });
        return;
      }

      let selection: string | undefined;
      if (decision.action === 'select_ip') {
        selection = decision.ip;
      } else if (decision.action === 'select_domain') {
        selection = '';
      }
      const commitResult =
        await this.backgroundApi.simpleDb.ipTable.commitSpeedTestResult({
          domain,
          expectedConfigHash: startConfigHash,
          measuredEndpointIps: [...ipResults.keys()],
          lastBestIp: bestMeasuredIp,
          selection,
        });
      if (commitResult === 'stale_config') {
        this.pendingConfigChangeRerun.set(domain, opts?.trigger ?? 'periodic');
        defaultLogger.ipTable.request.warn({
          info: `[IpTable] Discarding stale speed test result for ${domain}: signed config changed after probing (expected v${startConfigVersion}/${startConfigHash}); queueing fresh round`,
        });
        return;
      }

      if (decision.action === 'select_ip') {
        this.bumpSelectionGeneration(domain);
        if ((currentSelection ?? '') === '') {
          defaultLogger.ipTable.metrics.endpointSwitched({
            domain,
            from: 'domain',
            to: 'ip',
            trigger: 'speed_test',
            reason: decision.reason,
          });
        }
      } else if (decision.action === 'select_domain') {
        this.bumpSelectionGeneration(domain);
        if (currentSelection) {
          defaultLogger.ipTable.metrics.endpointSwitched({
            domain,
            from: 'ip',
            to: 'domain',
            trigger: 'speed_test',
            reason: decision.reason,
          });
        }
      }
      // no_change: keep the previous selection untouched.

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
    requestSequence?: number,
  ): Promise<void> {
    // Check if IP Table is enabled
    if (!(await this.isIpTableEnabled())) {
      return;
    }

    const now = Date.now();
    const outcomeSequence = requestSequence ?? nextIpTableRequestSequence();

    // Get or initialize domain health stats
    const stats = this.getDomainHealth(domain);

    // Get or initialize endpoint health
    const endpointHealth = this.getEndpointHealth(stats, requestType, target);

    // Outcomes arrive through async callbacks with no ordering guarantee:
    // the shared ledger orders them by a monotonic sequence allocated at
    // transport hand-off, so a failure whose request predates the newest
    // applied outcome never re-increments the counter, even within one ms.
    if (
      applyOutcome(endpointHealth, {
        ok: false,
        requestSequence: outcomeSequence,
      }) === 'stale'
    ) {
      defaultLogger.ipTable.request.info({
        info: `[IpTable] Ignoring stale ${requestType} failure for ${domain} (${target}): request predates the latest success`,
      });
      return;
    }

    // Update failure statistics (consecutiveFailures is owned by the ledger)
    endpointHealth.failureCount += 1;
    endpointHealth.lastFailureTime = now;

    defaultLogger.ipTable.request.warn({
      info: `[IpTable] ${requestType === 'ip' ? 'IP' : 'Domain'} failure #${
        endpointHealth.failureCount
      } (consecutive: ${
        endpointHealth.consecutiveFailures
      }) for ${domain} (${target})`,
    });

    // Fast failover: after a few consecutive real-request failures on the
    // direct domain, switch to the last known-good IP immediately instead of
    // waiting for the slow failure threshold + a full speed test round.
    if (
      requestType === 'domain' &&
      endpointHealth.consecutiveFailures === IP_TABLE_DOMAIN_FAILOVER_THRESHOLD
    ) {
      const configWithRuntime = await this.getConfig();
      const currentSelection = configWithRuntime.runtime?.selections?.[domain];
      const lastBestIp = configWithRuntime.runtime?.lastBestIp?.[domain];
      const failoverDisabled = await this.isFailoverDisabledByDevSettings();
      if (!failoverDisabled && (currentSelection ?? '') === '' && lastBestIp) {
        defaultLogger.ipTable.request.warn({
          info: `[IpTable] Fast failover: domain ${domain} failing real traffic, switching to last-best IP immediately`,
        });
        await this.applySelection(domain, lastBestIp);
        defaultLogger.ipTable.metrics.endpointSwitched({
          domain,
          from: 'domain',
          to: 'ip',
          trigger: 'fast_failover',
        });
      }
    }

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
    stats.directHosts.forEach((health) => {
      health.consecutiveFailures = 0;
      health.failureSequences.clear();
    });
    stats.ipEndpoints.forEach((health) => {
      health.consecutiveFailures = 0;
      health.failureSequences.clear();
    });

    // Trigger speed test to find and switch to better endpoint
    void this.selectBestEndpointForDomain(domain, {
      trigger: requestType === 'domain' ? 'domain_failure' : 'ip_failure',
    });
  }

  private async isFailoverDisabledByDevSettings(): Promise<boolean> {
    try {
      const devSettings = await devSettingsPersistAtom.get();
      // Intentionally ignores devSettings.enabled to match the adapter-side
      // check (and the existing disableIpTableInProd convention): main and
      // bg runtimes must reach the same conclusion for the same settings.
      return Boolean(devSettings.settings?.disableIpTableFailover);
    } catch {
      // Default to enabled when dev settings are unreadable.
      return false;
    }
  }

  private pendingInitialSpeedTestTimer: ReturnType<typeof setTimeout> | null =
    null;

  private scheduleSpeedTest(reason: string): void {
    if (this.pendingInitialSpeedTestTimer) {
      defaultLogger.ipTable.request.info({
        info: `[IpTable] ${reason}, speed test already scheduled, skipping`,
      });
      return;
    }
    defaultLogger.ipTable.request.info({
      info: `[IpTable] ${reason}, scheduling speed test in ${
        IP_TABLE_INITIAL_SPEED_TEST_DELAY_MS / 1000
      } s`,
    });
    this.pendingInitialSpeedTestTimer = setTimeout(() => {
      this.pendingInitialSpeedTestTimer = null;
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
    setReportRequestFailureCallback(
      ({ domain, requestType, target, requestSequence }) => {
        void this.reportRequestFailure(
          domain,
          requestType,
          target,
          requestSequence,
        );
      },
    );

    // Successes reset the consecutive-failure counters, so "consecutive"
    // means what it says. The success path MUST create the ledger entry when
    // none exists yet: a later-started success completing before an
    // early-started slow failure has to leave its ordering mark, otherwise
    // the old failure would create the entry afterwards and count against a
    // link that already proved healthy.
    setReportRequestSuccessCallback(
      ({ domain, requestType, target, requestSequence }) => {
        const stats = this.getDomainHealth(domain);
        const endpointHealth = this.getEndpointHealth(
          stats,
          requestType,
          target,
        );
        applyOutcome(endpointHealth, { ok: true, requestSequence });
      },
    );

    // Try to refresh CDN config if needed
    const shouldRefresh = await this.shouldRefreshConfig();
    let needSpeedTest = false;

    if (shouldRefresh) {
      defaultLogger.ipTable.request.info({
        info: '[IpTable] CDN config refresh needed, fetching remote config',
      });
      const configUpdated = await this.fetchAndApplyRemoteConfig();

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
