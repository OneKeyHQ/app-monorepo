/* eslint-disable spellcheck/spell-checker */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/**
 * Network Diagnostics - Core Class
 *
 * Core diagnostic class - Encapsulates all diagnostic logic
 */

import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import { NetworkInfo } from 'react-native-network-info';
import {
  clearRequests,
  getRequests,
  startNetworkLogging,
  stopNetworkLogging,
} from 'react-native-network-logger';
import Ping from 'react-native-ping';
import TcpSocket from 'react-native-tcp-socket';

import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import { ONEKEY_HEALTH_CHECK_URL } from '@onekeyhq/shared/src/config/appConfig';
import { getEndpointByServiceName } from '@onekeyhq/shared/src/config/endpointsMap';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { mergeConfig } from './config';
import {
  EDiagnosticPhase,
  ENetworkConnectivityLevel,
  EOneKeyFailureReason,
} from './types';

import type {
  IConnectivityComparison,
  IDnsResult,
  IDoctorConfig,
  IHttpProbeResult,
  IMergedConfig,
  INetInfoSnapshot,
  INetworkCheckup,
  INetworkDiagnosisConclusion,
  INetworkEnvironment,
  INetworkRequestLog,
  IPingResult,
  ITcpConnectionResult,
  ITlsHandshakeResult,
} from './types';

export class NetworkDoctor {
  private config: IMergedConfig;

  private endpoint: string | null = null;

  private client: any = null;

  private healthCheckUrl: string | null = null;

  private targetDomain: string | null = null;

  private startTime = 0;

  constructor(userConfig: IDoctorConfig) {
    this.config = mergeConfig(userConfig);

    defaultLogger.networkDoctor.log.info({
      info: '🩺 [NetworkDoctor] Initialized',
    });
  }

  /**
   * Initialize endpoint, client and health check URL from service configuration
   */
  private async initialize(): Promise<void> {
    if (this.endpoint && this.client) {
      return; // Already initialized
    }

    try {
      // Get endpoint from service configuration
      this.endpoint = await getEndpointByServiceName(
        EServiceEndpointEnum.Wallet,
      );

      // Create API client
      this.client = await appApiClient.getClient({
        endpoint: this.endpoint,
        name: EServiceEndpointEnum.Wallet,
      });

      // Build health check URL
      this.healthCheckUrl = `${this.endpoint}${ONEKEY_HEALTH_CHECK_URL}`;

      // Extract domain from endpoint URL
      const url = new URL(this.endpoint);
      this.targetDomain = url.hostname;

      defaultLogger.networkDoctor.log.info({
        info: `🩺 [NetworkDoctor] Initialized endpoint and client - endpoint: ${this.endpoint}, healthCheckUrl: ${this.healthCheckUrl}, targetDomain: ${this.targetDomain}`,
      });
    } catch (error: any) {
      defaultLogger.networkDoctor.log.error({
        info: `[NetworkDoctor] Failed to initialize endpoint and client - ${error?.message}`,
      });
      throw error;
    }
  }

  /**
   * Emit progress update to callback
   */
  private emitProgress(
    phase: EDiagnosticPhase,
    phaseIndex: number,
    message: string,
  ): void {
    const totalPhases = 8; // Total number of diagnostic phases (excluding INITIALIZING and COMPLETED)
    const percentage = Math.round((phaseIndex / totalPhases) * 100);

    if (this.config.onProgress) {
      this.config.onProgress({
        phase,
        phaseIndex,
        totalPhases,
        percentage,
        message,
      });

      defaultLogger.networkDoctor.log.info({
        info: `[Progress] ${percentage}% - ${phase}: ${message}`,
      });
    }
  }

  /**
   * Test Cloudflare CDN trace endpoint (fixed URL)
   */
  private async testCdnTrace(): Promise<IHttpProbeResult> {
    const startTime = Date.now();
    const timeout = this.config.timeouts.http;
    const cdnTraceUrl = 'https://wallet.onekeycn.com/cdn-cgi/trace';

    try {
      const response = await axios.get(cdnTraceUrl, {
        timeout,
      });

      const result = {
        url: cdnTraceUrl,
        label: 'cdn_trace',
        success: true,
        status: response.status,
        dataPreview:
          typeof response.data === 'string'
            ? response.data.slice(0, 500)
            : JSON.stringify(response.data).slice(0, 500),
        durationMs: Date.now() - startTime,
      };
      defaultLogger.networkDoctor.log.info({
        info: `[CDN-TRACE] ✓ Trace successful - status: ${result.status}, time: ${result.durationMs}ms, preview: ${result.dataPreview}`,
      });
      return result;
    } catch (error: any) {
      const result = {
        url: cdnTraceUrl,
        label: 'cdn_trace',
        success: false,
        status: error?.response?.status,
        error: error?.message || String(error),
        durationMs: Date.now() - startTime,
      };
      defaultLogger.networkDoctor.log.warn({
        info: `[CDN-TRACE] ✗ Trace failed - error: ${result.error}, status: ${result.status}`,
      });
      return result;
    }
  }

  /**
   * Run complete network diagnostics
   */
  async run(): Promise<INetworkCheckup> {
    this.startTime = Date.now();
    defaultLogger.networkDoctor.log.info({
      info: '🩺 ===== NETWORK DOCTOR: CHECKUP START =====',
    });

    // ========== Phase 0: Initializing ==========
    this.emitProgress(
      EDiagnosticPhase.INITIALIZING,
      0,
      'Initializing network diagnostics',
    );

    // Initialize endpoint, client and health check URL
    await this.initialize();

    if (
      !this.endpoint ||
      !this.client ||
      !this.healthCheckUrl ||
      !this.targetDomain
    ) {
      throw new OneKeyError('Failed to initialize NetworkDoctor');
    }

    // Initialize network logging
    if (this.config.enableNetworkLogger) {
      clearRequests();
      startNetworkLogging({
        maxRequests: this.config.maxNetworkLogs,
        ignoredHosts: ['localhost', '127.0.0.1'],
        ignoredPatterns: [/^HEAD /],
        forceEnable: true,
      });
    }

    try {
      // ========== Phase 1: Basic Network Info ==========
      this.emitProgress(
        EDiagnosticPhase.BASIC_NETWORK_INFO,
        1,
        'Gathering basic network information',
      );
      defaultLogger.networkDoctor.log.info({
        info: '[DR] Phase 1: Basic Network Info',
      });
      const netInfo = await this.testNetInfo();
      const networkEnv = await this.testNetworkEnv();

      // ========== Phase 2: DNS Resolution ==========
      this.emitProgress(
        EDiagnosticPhase.DNS_RESOLUTION,
        2,
        'Resolving DNS for target domain',
      );
      defaultLogger.networkDoctor.log.info({
        info: '[DR] Phase 2: DNS Resolution',
      });
      const dns = await this.testDns();

      // ========== Phase 3: TCP + TLS Tests (Parallel) ==========
      this.emitProgress(
        EDiagnosticPhase.TCP_TLS_TESTS,
        3,
        'Testing TCP connections and TLS handshake',
      );
      defaultLogger.networkDoctor.log.info({
        info: '[DR] Phase 3: TCP & TLS Tests',
      });
      const [tcpTests, tlsTest] = await Promise.all([
        this.testTcpConnectivity(dns.ips[0]),
        this.testTlsHandshake(),
      ]);

      // ========== Phase 4: Ping Tests ==========
      this.emitProgress(
        EDiagnosticPhase.PING_TESTS,
        4,
        'Running ping tests to target and reference servers',
      );
      defaultLogger.networkDoctor.log.info({
        info: '[DR] Phase 4: Ping Tests',
      });
      const pingDomain = await this.testPing(this.targetDomain ?? '');
      const pingIp =
        dns.ips.length > 0 ? await this.testPing(dns.ips[0]) : undefined;
      const extraPings = await this.testExtraPings();

      // ========== Phase 5: HTTP Tests ==========
      this.emitProgress(
        EDiagnosticPhase.HTTP_TESTS,
        5,
        'Testing HTTP endpoints and health checks',
      );
      defaultLogger.networkDoctor.log.info({
        info: '[DR] Phase 5: HTTP Tests',
      });
      const healthCheck = await this.testHealthCheck();
      const cdnTrace = await this.testCdnTrace();
      const publicHttpChecks = await this.testPublicHttpProbes();

      // ========== Phase 6: Collect Network Logs ==========
      this.emitProgress(
        EDiagnosticPhase.NETWORK_LOGS,
        6,
        'Collecting network request logs',
      );
      defaultLogger.networkDoctor.log.info({
        info: '[DR] Phase 6: Collecting Network Logs',
      });
      const networkLogs = this.collectNetworkLogs();

      // ========== Phase 7: Generate Report ==========
      this.emitProgress(
        EDiagnosticPhase.GENERATING_REPORT,
        7,
        'Analyzing results and generating diagnostic report',
      );
      const report = this.generateReport({
        netInfo,
        networkEnv,
        dns,
        tcpTests,
        tlsTest,
        pingDomain,
        pingIp,
        extraPings,
        healthCheck,
        cdnTrace,
        publicHttpChecks,
        networkLogs,
      });

      // ========== Phase 8: Completed ==========
      this.emitProgress(
        EDiagnosticPhase.COMPLETED,
        8,
        'Network diagnostics completed',
      );

      defaultLogger.networkDoctor.log.info({
        info: `🩺 ===== CHECKUP COMPLETED ===== - totalDuration: ${report.metrics.totalDurationMs}ms, assessment: ${report.summary.assessment}, connectivityLevel: ${report.summary.conclusion.connectivityLevel}`,
      });

      return report;
    } finally {
      if (this.config.enableNetworkLogger) {
        stopNetworkLogging();
      }
    }
  }

  // ==================== Test Methods ====================

  private async testNetInfo(): Promise<INetInfoSnapshot> {
    const state = await NetInfo.fetch();
    const snapshot = {
      type: state.type,
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      details: state.details,
    };
    defaultLogger.networkDoctor.log.info({
      info: `[NetInfo] type: ${snapshot.type}, isConnected: ${snapshot.isConnected}, isInternetReachable: ${snapshot.isInternetReachable}`,
    });
    return snapshot;
  }

  private async testNetworkEnv(): Promise<INetworkEnvironment> {
    try {
      const [ipAddress, gateway, subnet, broadcast] = await Promise.all([
        NetworkInfo.getIPAddress(),
        NetworkInfo.getGatewayIPAddress(),
        NetworkInfo.getSubnet(),
        NetworkInfo.getBroadcast(),
      ]);

      const env = { ipAddress, gateway, subnet, broadcast };
      defaultLogger.networkDoctor.log.info({
        info: `[NetworkEnv] ipAddress: ${ipAddress}, gateway: ${gateway}, subnet: ${subnet}, broadcast: ${broadcast}`,
      });
      return env;
    } catch (error: any) {
      defaultLogger.networkDoctor.log.error({
        info: `[NetworkEnv] Failed to get network environment - ${error?.message}`,
      });
      return {
        ipAddress: null,
        gateway: null,
        subnet: null,
        broadcast: null,
      };
    }
  }

  private async testDns(): Promise<IDnsResult> {
    const startTime = Date.now();
    const hostname = this.targetDomain ?? '';
    try {
      const { getIpAddressesForHostname } = await import(
        'react-native-dns-lookup'
      );
      const ips = await getIpAddressesForHostname(hostname);

      const result = {
        hostname,
        ips: Array.from(ips),
        durationMs: Date.now() - startTime,
      };
      defaultLogger.networkDoctor.log.info({
        info: `[DNS] Resolved - hostname: ${
          result.hostname
        }, ips: ${result.ips.join(', ')}, durationMs: ${result.durationMs}ms`,
      });
      return result;
    } catch (error: any) {
      const result = {
        hostname,
        ips: [],
        error: error?.message || String(error),
        durationMs: Date.now() - startTime,
      };
      defaultLogger.networkDoctor.log.error({
        info: `[DNS] Failed - hostname: ${result.hostname}, error: ${result.error}, durationMs: ${result.durationMs}ms`,
      });
      return result;
    }
  }

  private async testTcpConnection(
    host: string,
    port: number,
    timeout: number,
  ): Promise<ITcpConnectionResult> {
    defaultLogger.networkDoctor.log.info({
      info: `[TCP] Testing connection to ${host}:${port}...`,
    });

    return new Promise((resolve) => {
      const startTime = Date.now();
      let resolved = false;

      // Force timeout protection: prevent TCP library bug from never resolving
      const forceTimeoutHandle = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        try {
          socket.destroy();
        } catch (e) {
          // ignore socket destroy errors
        }

        const result = {
          host,
          port,
          success: false,
          error: `TCP library timeout (forced after ${
            timeout + 1000
          }ms) - likely a library bug on iOS`,
          errorCode: 'LIBRARY_TIMEOUT',
        };
        defaultLogger.networkDoctor.log.warn({
          info: `[TCP] ⏱ Forced timeout for ${host}:${port} - timeout: ${
            timeout + 1000
          }ms`,
        });
        resolve(result);
      }, timeout + 1000); // 1 second more than configured timeout

      const socket = TcpSocket.createConnection(
        { host, port, timeout } as any,
        () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(forceTimeoutHandle);
          socket.destroy();

          const result = {
            host,
            port,
            success: true,
            tcpHandshakeTime: Date.now() - startTime,
          };
          defaultLogger.networkDoctor.log.info({
            info: `[TCP] ✓ Connected to ${host}:${port} - time: ${result.tcpHandshakeTime}ms`,
          });
          resolve(result);
        },
      );

      socket.on('error', (err: any) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(forceTimeoutHandle);

        const result = {
          host,
          port,
          success: false,
          error: err.message || String(err),
          errorCode: err?.code || err?.errno,
        };
        defaultLogger.networkDoctor.log.error({
          info: `[TCP] ✗ Failed to connect ${host}:${port} - error: ${result.error}, code: ${result.errorCode}`,
        });
        resolve(result);
      });

      socket.on('timeout', () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(forceTimeoutHandle);
        socket.destroy();

        const result = {
          host,
          port,
          success: false,
          error: `Connection timeout after ${timeout}ms`,
          errorCode: 'ETIMEDOUT',
        };
        defaultLogger.networkDoctor.log.warn({
          info: `[TCP] ⏱ Timeout connecting to ${host}:${port} - timeout: ${timeout}ms`,
        });
        resolve(result);
      });
    });
  }

  private async testTcpConnectivity(
    apiIp?: string,
  ): Promise<IConnectivityComparison> {
    const targetHost = apiIp;
    const timeout = this.config.timeouts.tcp || 10_000;

    if (!targetHost) {
      throw new OneKeyError(
        'No target host specified for TCP connectivity test',
      );
    }

    defaultLogger.networkDoctor.log.info({
      info: `[TCP] Starting connectivity comparison (target: ${targetHost})`,
    });

    const [yourApi, google, cloudflare] = await Promise.all([
      this.testTcpConnection(targetHost, 443, timeout),
      this.testTcpConnection('www.google.com', 443, timeout),
      this.testTcpConnection('1.1.1.1', 443, timeout),
    ]);

    defaultLogger.networkDoctor.log.info({
      info: '[TCP] All connectivity tests completed',
    });

    const isSelectiveBlocking =
      !yourApi.success && (google.success || cloudflare.success);

    const result = {
      yourApi: {
        ...yourApi,
        host: this.targetDomain ?? '',
      },
      google,
      cloudflare,
      isSelectiveBlocking,
    };

    if (isSelectiveBlocking) {
      defaultLogger.networkDoctor.log.warn({
        info: '[TCP] 🚨 Selective blocking detected! Your API blocked but others work',
      });
    }

    return result;
  }

  private async testTlsHandshake(): Promise<ITlsHandshakeResult> {
    const startTime = Date.now();
    const timeout = this.config.timeouts.tls;
    const url = this.healthCheckUrl ?? '';

    try {
      // Use the initialized client
      const response = await this.client.get(ONEKEY_HEALTH_CHECK_URL, {
        timeout,
      });

      const result = {
        url,
        success: true,
        tlsHandshakeTime: Date.now() - startTime,
        statusCode: response.status,
      };
      defaultLogger.networkDoctor.log.info({
        info: `[TLS] ✓ Handshake successful - time: ${result.tlsHandshakeTime}ms, status: ${result.statusCode}`,
      });
      return result;
    } catch (error: any) {
      let errorType = 'UNKNOWN';
      let isCertificateError = false;

      if (error.code === 'ECONNABORTED') errorType = 'TIMEOUT';
      else if (error.code === 'ERR_NETWORK') errorType = 'NETWORK_ERROR';
      else if (
        error.message?.includes('certificate') ||
        error.message?.includes('SSL')
      ) {
        errorType = 'CERTIFICATE_ERROR';
        isCertificateError = true;
      } else if (error.message?.includes('ETIMEDOUT'))
        errorType = 'CONNECTION_TIMEOUT';
      else if (error.message?.includes('ECONNREFUSED'))
        errorType = 'CONNECTION_REFUSED';
      else if (error.message?.includes('ECONNRESET'))
        errorType = 'CONNECTION_RESET';

      const result = {
        url,
        success: false,
        tlsHandshakeTime: Date.now() - startTime,
        error: error.message || String(error),
        errorCode: error?.code,
        errorType,
        isCertificateError,
      };

      if (isCertificateError) {
        defaultLogger.networkDoctor.log.warn({
          info: `[TLS] ⚠️ Certificate error - error: ${result.error}, type: ${errorType}`,
        });
      } else {
        defaultLogger.networkDoctor.log.error({
          info: `[TLS] ✗ Handshake failed - error: ${result.error}, type: ${errorType}, code: ${result.errorCode}`,
        });
      }

      return result;
    }
  }

  private async testPing(target: string): Promise<IPingResult> {
    const timeout = this.config.timeouts.ping;

    try {
      const timeMs = await Ping.start(target, {
        timeout,
        interval: 1000,
      } as any);
      const result = { target, success: true, timeMs };
      defaultLogger.networkDoctor.log.info({
        info: `[PING] ✓ ${target} - time: ${timeMs}ms`,
      });
      return result;
    } catch (error: any) {
      const result = {
        target,
        success: false,
        error: error?.message || String(error),
        code: error?.code ?? error?.nativeErrorCode ?? error?.status,
      };
      defaultLogger.networkDoctor.log.warn({
        info: `[PING] ✗ ${target} - error: ${result.error}`,
      });
      return result;
    }
  }

  private async testExtraPings(): Promise<IPingResult[]> {
    const results: IPingResult[] = [];
    for (const target of this.config.extraPingTargets) {
      results.push(await this.testPing(target));
    }
    return results;
  }

  private async testHealthCheck(): Promise<IHttpProbeResult> {
    const startTime = Date.now();
    const timeout = this.config.timeouts.http;
    const url = this.healthCheckUrl ?? '';

    try {
      // Use the initialized client
      const response = await this.client.get(ONEKEY_HEALTH_CHECK_URL, {
        params: {
          _: 'network_doctor_health',
          timestamp: Date.now(),
        },
        timeout,
      });

      const preview =
        typeof response.data === 'string'
          ? response.data.slice(0, 200)
          : JSON.stringify(response.data).slice(0, 200);

      const result = {
        url,
        success: true,
        status: response.status,
        dataPreview: preview,
        durationMs: Date.now() - startTime,
      };
      defaultLogger.networkDoctor.log.info({
        info: `[HTTP] ✓ Health check passed - status: ${result.status}, time: ${result.durationMs}ms`,
      });
      return result;
    } catch (error: any) {
      const result = {
        url,
        success: false,
        status: error?.response?.status,
        error: error?.message || String(error),
        durationMs: Date.now() - startTime,
      };
      defaultLogger.networkDoctor.log.error({
        info: `[HTTP] ✗ Health check failed - error: ${result.error}, status: ${result.status}`,
      });
      return result;
    }
  }

  private async testPublicHttpProbes(): Promise<IHttpProbeResult[]> {
    const results: IHttpProbeResult[] = [];
    const timeout = this.config.timeouts.http;

    for (const probe of this.config.extraHttpProbes) {
      const startTime = Date.now();
      try {
        const response = await axios.get(probe.url, { timeout });
        const preview =
          typeof response.data === 'string'
            ? response.data.slice(0, 200)
            : JSON.stringify(response.data).slice(0, 200);

        const result = {
          url: probe.url,
          label: probe.label,
          success: true,
          status: response.status,
          dataPreview: preview,
          durationMs: Date.now() - startTime,
        };
        defaultLogger.networkDoctor.log.info({
          info: `[HTTP] ✓ ${probe.label} - status: ${result.status}, time: ${result.durationMs}ms`,
        });
        results.push(result);
      } catch (error: any) {
        const result = {
          url: probe.url,
          label: probe.label,
          success: false,
          status: error?.response?.status,
          error: error?.message || String(error),
          durationMs: Date.now() - startTime,
        };
        defaultLogger.networkDoctor.log.warn({
          info: `[HTTP] ✗ ${probe.label} - error: ${result.error}`,
        });
        results.push(result);
      }
    }

    return results;
  }

  private collectNetworkLogs(): INetworkRequestLog[] {
    if (!this.config.enableNetworkLogger) {
      defaultLogger.networkDoctor.log.info({
        info: '[NetworkLogger] Disabled, skipping log collection',
      });
      return [];
    }

    try {
      const requests = getRequests();
      const logs = requests.slice(0, this.config.maxNetworkLogs).map((req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        status: req.status,
        duration: req.duration,
        startTime: req.startTime,
        endTime: req.endTime,
        type: req.type,
        responseURL: req.responseURL,
        responseContentType: req.responseContentType,
        responseSize: req.responseSize,
        requestHeaders: req.requestHeaders,
        responseHeaders: req.responseHeaders,
        timeout: req.timeout,
        closeReason: req.closeReason,
        serverClose: req.serverClose,
        serverError: req.serverError,
        messages: req.messages,
        hasRequestBody: !!req.dataSent,
        hasResponseBody: !!req.response,
      }));

      defaultLogger.networkDoctor.log.info({
        info: `[NetworkLogger] Collected ${logs.length} network requests`,
      });

      // Output detailed information for each request
      logs.forEach((log, index) => {
        const statusIcon =
          // eslint-disable-next-line no-nested-ternary
          log.status && log.status >= 200 && log.status < 300
            ? '✓'
            : log.status
            ? '✗'
            : '?';
        const statusText = log.status ? `${log.status}` : 'NO_STATUS';
        const durationText = log.duration ? `${log.duration}ms` : 'N/A';

        defaultLogger.networkDoctor.log.info({
          info: `[NetworkLogger][${index + 1}/${logs.length}] ${statusIcon} ${
            log.method
          } ${
            log.url
          } [${statusText}] [${durationText}] - Full request data: ${JSON.stringify(
            log,
          )}`,
        });
      });

      return logs;
    } catch (error) {
      defaultLogger.networkDoctor.log.error({
        info: `[NetworkLogger] Failed to collect network logs - ${String(
          error,
        )}`,
      });
      return [];
    }
  }

  // ==================== Report Generation ====================

  private generateReport(results: any): INetworkCheckup {
    // New layered diagnosis conclusion
    const conclusion = this.analyzeDiagnosisConclusion(results);

    return {
      timestamp: new Date().toISOString(),
      config: {
        targetDomain: this.targetDomain ?? '',
        healthCheckUrl: this.healthCheckUrl ?? '',
      },
      summary: {
        allCriticalChecksPassed:
          conclusion.connectivityLevel === ENetworkConnectivityLevel.HEALTHY,
        assessment: conclusion.assessment,
        conclusion,
      },
      results,
      metrics: {
        totalDurationMs: Date.now() - this.startTime,
        dnsResolutionMs: results.dns.durationMs,
        tcpHandshakeMs: results.tcpTests.yourApi.tcpHandshakeTime,
        tlsHandshakeMs: results.tlsTest.tlsHandshakeTime,
        httpRequestMs: results.healthCheck.durationMs,
      },
    };
  }

  /**
   * NEW: Layered diagnosis conclusion analysis
   * Priority: Health Check success is the ultimate truth
   */
  private analyzeDiagnosisConclusion(
    results: any,
  ): INetworkDiagnosisConclusion {
    // ===== Step 1: OneKey Health Check is the ultimate truth =====
    const isOneKeyHealthy = results.healthCheck.success;

    if (isOneKeyHealthy) {
      const intermediateIssues = this.detectIntermediateIssues(results);

      const issuesSummary =
        intermediateIssues.length > 0 ? intermediateIssues.join('; ') : 'none';
      defaultLogger.networkDoctor.log.info({
        info: `[Diagnosis] ✅ HEALTHY - Health check succeeded, intermediateIssues: ${issuesSummary}`,
      });

      return {
        connectivityLevel: ENetworkConnectivityLevel.HEALTHY,
        oneKeyFailureReason: EOneKeyFailureReason.NONE,
        failureLayer: null,
        summary: 'Network is healthy - OneKey service accessible',
        suggestedActions: [],
        assessment: 'healthy',
        intermediateIssues:
          intermediateIssues.length > 0 ? intermediateIssues : undefined,
      };
    }

    // ===== Step 2: OneKey unhealthy, determine network environment =====
    const referenceServices = {
      google: results.tcpTests.google.success,
      cloudflare: results.tcpTests.cloudflare.success,
      baidu:
        results.extraPings.find((p: any) => p.target.includes('baidu'))
          ?.success ?? false,
    };

    const refServiceStatus = `Google: ${referenceServices.google}, CF: ${referenceServices.cloudflare}, Baidu: ${referenceServices.baidu}`;
    defaultLogger.networkDoctor.log.info({
      info: `[Diagnosis] Reference services - ${refServiceStatus}`,
    });

    // 2.1 Network completely down (all reference services failed)
    if (
      !referenceServices.google &&
      !referenceServices.cloudflare &&
      !referenceServices.baidu
    ) {
      defaultLogger.networkDoctor.log.error({
        info: '[Diagnosis] 🚨 COMPLETELY_DOWN - All services unreachable',
      });

      return {
        connectivityLevel: ENetworkConnectivityLevel.COMPLETELY_DOWN,
        oneKeyFailureReason: EOneKeyFailureReason.NONE,
        failureLayer: null,
        summary: 'No network connectivity - All services unreachable',
        suggestedActions: [
          'Check WiFi/cellular connection',
          'Restart device',
          'Check airplane mode',
        ],
        assessment: 'blocked',
      };
    }

    // 2.2 International network restricted (Baidu works, Google fails)
    if (referenceServices.baidu && !referenceServices.google) {
      defaultLogger.networkDoctor.log.warn({
        info: '[Diagnosis] 🚨 INTERNATIONAL_RESTRICTED - Mainland China detected',
      });

      return {
        connectivityLevel: ENetworkConnectivityLevel.INTERNATIONAL_RESTRICTED,
        oneKeyFailureReason: EOneKeyFailureReason.NONE,
        failureLayer: null,
        summary:
          'International network restricted - Mainland China network environment detected',
        suggestedActions: [
          'Enable VPN to access international services',
          'This is typical for users in mainland China',
        ],
        assessment: 'blocked',
      };
    }

    // 2.3 Other networks normal, OneKey has selective issues
    if (referenceServices.google || referenceServices.cloudflare) {
      // ===== Step 3: Analyze OneKey specific failure layer =====
      const failureAnalysis = this.analyzeOneKeyFailureLayer(results);

      const diagnosisType = failureAnalysis.isBlocking
        ? '🚨 ONEKEY_BLOCKED'
        : '⚠️ ONEKEY_SERVICE_ERROR';
      const diagnosisDetail = `Layer: ${failureAnalysis.layer}, Reason: ${failureAnalysis.reason}`;
      defaultLogger.networkDoctor.log.warn({
        info: `[Diagnosis] ${diagnosisType} - ${diagnosisDetail}`,
      });

      return {
        connectivityLevel: failureAnalysis.isBlocking
          ? ENetworkConnectivityLevel.ONEKEY_BLOCKED
          : ENetworkConnectivityLevel.ONEKEY_SERVICE_ERROR,
        oneKeyFailureReason: failureAnalysis.reason,
        failureLayer: failureAnalysis.layer,
        summary: failureAnalysis.summary,
        suggestedActions: failureAnalysis.suggestedActions,
        assessment: failureAnalysis.isBlocking ? 'blocked' : 'degraded',
      };
    }

    // Fallback case
    defaultLogger.networkDoctor.log.error({
      info: '[Diagnosis] ⚠️ ONEKEY_SERVICE_ERROR - Unknown network condition',
    });

    return {
      connectivityLevel: ENetworkConnectivityLevel.ONEKEY_SERVICE_ERROR,
      oneKeyFailureReason: EOneKeyFailureReason.HTTP_REQUEST_FAILED,
      failureLayer: 'http',
      summary: 'OneKey service error - Unknown network condition',
      suggestedActions: ['Contact support with diagnostic report'],
      assessment: 'degraded',
    };
  }

  /**
   * Analyze OneKey specific failure layer
   * Precondition: Health Check failed && other networks normal
   */
  private analyzeOneKeyFailureLayer(results: any): {
    isBlocking: boolean;
    reason: EOneKeyFailureReason;
    layer: 'dns' | 'tcp' | 'tls' | 'http';
    summary: string;
    suggestedActions: string[];
  } {
    // DNS layer failure
    if (results.dns.error) {
      return {
        isBlocking: true,
        reason: EOneKeyFailureReason.DNS_RESOLUTION_FAILED,
        layer: 'dns',
        summary: 'DNS resolution blocked for OneKey domain',
        suggestedActions: [
          'DNS poisoning detected',
          'Try using encrypted DNS (DoH/DoT)',
          'Enable VPN',
        ],
      };
    }

    // TCP layer failure (and not a false positive)
    const isTcpRealFailure =
      !results.tcpTests.yourApi.success && !results.tlsTest.success;
    if (isTcpRealFailure) {
      return {
        isBlocking: true,
        reason: EOneKeyFailureReason.TCP_HANDSHAKE_FAILED,
        layer: 'tcp',
        summary: 'TCP connection blocked for OneKey',
        suggestedActions: [
          'Selective blocking detected',
          'Use domain fronting',
          'Enable ECH (Encrypted Client Hello)',
          'Try VPN',
        ],
      };
    }

    // TLS layer failure
    if (!results.tlsTest.success && results.tlsTest.isCertificateError) {
      return {
        isBlocking: false,
        reason: EOneKeyFailureReason.TLS_HANDSHAKE_FAILED,
        layer: 'tls',
        summary: 'TLS certificate error - Likely service configuration issue',
        suggestedActions: [
          'This may be a test/staging environment',
          'Check system date/time settings',
          'Contact support if this persists',
        ],
      };
    }

    // HTTP layer failure
    return {
      isBlocking: false,
      reason: EOneKeyFailureReason.HTTP_REQUEST_FAILED,
      layer: 'http',
      summary: 'HTTP request failed - Service may be down',
      suggestedActions: [
        'OneKey service may be temporarily unavailable',
        'Check status page',
        'Try again in a few minutes',
      ],
    };
  }

  /**
   * Detect intermediate issues (for debugging, e.g., TCP false positive)
   */
  private detectIntermediateIssues(results: any): string[] {
    const issues: string[] = [];

    // TCP false positive (TCP failed but TLS/HTTP succeeded)
    if (!results.tcpTests.yourApi.success && results.tlsTest.success) {
      issues.push(
        'TCP test failed but TLS/HTTP succeeded (react-native-tcp-socket bug)',
      );
    }

    // Ping blocked (normal behavior)
    if (!results.pingDomain.success && results.healthCheck.success) {
      issues.push('Ping blocked but HTTPS works (normal CDN behavior)');
    }

    // DNS slow but successful
    if (results.dns.durationMs > 3000 && !results.dns.error) {
      issues.push(`DNS resolution slow (${results.dns.durationMs}ms)`);
    }

    return issues;
  }
}
