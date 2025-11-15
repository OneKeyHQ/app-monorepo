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

import { buildHealthCheckUrl, mergeConfig } from './config';
import { EDiagnosticIssueType } from './types';

import type {
  IConnectivityComparison,
  IDiagnosticIssue,
  IDnsResult,
  IDoctorConfig,
  IHttpProbeResult,
  INetInfoSnapshot,
  INetworkCheckup,
  INetworkEnvironment,
  INetworkRequestLog,
  IPingResult,
  ITcpConnectionResult,
  ITlsHandshakeResult,
} from './types';

export class NetworkDoctor {
  private config: Required<IDoctorConfig>;

  private healthCheckUrl: string;

  private startTime = 0;

  constructor(userConfig: IDoctorConfig) {
    this.config = mergeConfig(userConfig);
    this.healthCheckUrl = buildHealthCheckUrl(
      this.config.targetDomain,
      this.config.healthCheckPath,
    );

    console.log('🩺 [NetworkDoctor] Initialized', {
      targetDomain: this.config.targetDomain,
      healthCheckUrl: this.healthCheckUrl,
    });
  }

  /**
   * Run complete network diagnostics
   */
  async run(): Promise<INetworkCheckup> {
    this.startTime = Date.now();
    console.log('🩺 ===== NETWORK DOCTOR: CHECKUP START =====');

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
      console.log('[DR] Phase 1: Basic Network Info');
      const netInfo = await this.testNetInfo();
      const networkEnv = await this.testNetworkEnv();

      // ========== Phase 2: DNS Resolution ==========
      console.log('[DR] Phase 2: DNS Resolution');
      const dns = await this.testDns();

      // ========== Phase 3: TCP + TLS Tests (Parallel) ==========
      console.log('[DR] Phase 3: TCP & TLS Tests');
      const [tcpTests, tlsTest] = await Promise.all([
        this.testTcpConnectivity(dns.ips[0]),
        this.testTlsHandshake(),
      ]);

      // ========== Phase 4: Ping Tests ==========
      console.log('[DR] Phase 4: Ping Tests');
      const pingDomain = await this.testPing(this.config.targetDomain);
      const pingIp =
        dns.ips.length > 0 ? await this.testPing(dns.ips[0]) : undefined;
      const extraPings = await this.testExtraPings();

      // ========== Phase 5: HTTP Tests ==========
      console.log('[DR] Phase 5: HTTP Tests');
      const healthCheck = await this.testHealthCheck();
      const publicHttpChecks = await this.testPublicHttpProbes();

      // ========== Phase 6: Collect Network Logs ==========
      console.log('Phase 6: Collecting Network Logs');
      const networkLogs = this.collectNetworkLogs();

      // ========== Generate Report ==========
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
        publicHttpChecks,
        networkLogs,
      });

      console.log('🩺 ===== CHECKUP COMPLETED =====', {
        totalDuration: report.metrics.totalDurationMs,
        assessment: report.summary.assessment,
        issuesCount: report.summary.issues.length,
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
    console.log('[NetInfo]', snapshot);
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
      console.log('[NetworkEnv]', env);
      return env;
    } catch (error: any) {
      console.error(
        '[NetworkEnv] Failed to get network environment',
        error?.message,
      );
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
    try {
      const { getIpAddressesForHostname } = await import(
        'react-native-dns-lookup'
      );
      const ips = await getIpAddressesForHostname(this.config.targetDomain);

      const result = {
        hostname: this.config.targetDomain,
        ips: Array.from(ips),
        durationMs: Date.now() - startTime,
      };
      console.log('[DNS] Resolved', result);
      return result;
    } catch (error: any) {
      const result = {
        hostname: this.config.targetDomain,
        ips: [],
        error: error?.message || String(error),
        durationMs: Date.now() - startTime,
      };
      console.error('[DNS] Failed', result);
      return result;
    }
  }

  private async testTcpConnection(
    host: string,
    port: number,
    timeout: number,
  ): Promise<ITcpConnectionResult> {
    console.log(`[TCP] Testing connection to ${host}:${port}...`);

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
        console.warn(`[TCP] ⏱ Forced timeout for ${host}:${port}`, {
          timeout: timeout + 1000,
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
          console.log(`[TCP] ✓ Connected to ${host}:${port}`, {
            time: result.tcpHandshakeTime,
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
        console.error(`[TCP] ✗ Failed to connect ${host}:${port}`, {
          error: result.error,
          code: result.errorCode,
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
        console.warn(`[TCP] ⏱ Timeout connecting to ${host}:${port}`, {
          timeout,
        });
        resolve(result);
      });
    });
  }

  private async testTcpConnectivity(
    apiIp?: string,
  ): Promise<IConnectivityComparison> {
    const targetHost = apiIp || this.config.targetDomain;
    const timeout = this.config.timeouts.tcp || 10_000;

    console.log(
      `[TCP] Starting connectivity comparison (target: ${targetHost})`,
    );

    const [yourApi, google, cloudflare] = await Promise.all([
      this.testTcpConnection(targetHost, 443, timeout),
      this.testTcpConnection('www.google.com', 443, timeout),
      this.testTcpConnection('1.1.1.1', 443, timeout),
    ]);

    console.log('[TCP] All connectivity tests completed');

    const isSelectiveBlocking =
      !yourApi.success && (google.success || cloudflare.success);

    const result = {
      yourApi: {
        ...yourApi,
        host: this.config.targetDomain,
      },
      google,
      cloudflare,
      isSelectiveBlocking,
    };

    if (isSelectiveBlocking) {
      console.warn(
        '[TCP] 🚨 Selective blocking detected! Your API blocked but others work',
      );
    }

    return result;
  }

  private async testTlsHandshake(): Promise<ITlsHandshakeResult> {
    const startTime = Date.now();
    const timeout = this.config.timeouts.tls;

    try {
      const response = await axios.get(this.healthCheckUrl, {
        timeout,
      });

      const result = {
        url: this.healthCheckUrl,
        success: true,
        tlsHandshakeTime: Date.now() - startTime,
        statusCode: response.status,
      };
      console.log(`[TLS] ✓ Handshake successful`, {
        time: result.tlsHandshakeTime,
        status: result.statusCode,
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
        url: this.healthCheckUrl,
        success: false,
        tlsHandshakeTime: Date.now() - startTime,
        error: error.message || String(error),
        errorCode: error?.code,
        errorType,
        isCertificateError,
      };

      if (isCertificateError) {
        console.warn(`[TLS] ⚠️ Certificate error`, {
          error: result.error,
          type: errorType,
        });
      } else {
        console.error(`[TLS] ✗ Handshake failed`, {
          error: result.error,
          type: errorType,
          code: result.errorCode,
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
      console.log(`[PING] ✓ ${target}`, { time: timeMs });
      return result;
    } catch (error: any) {
      const result = {
        target,
        success: false,
        error: error?.message || String(error),
        code: error?.code ?? error?.nativeErrorCode ?? error?.status,
      };
      console.warn(`[PING] ✗ ${target}`, { error: result.error });
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

    try {
      const response = await axios.get(this.healthCheckUrl, {
        timeout,
      });

      const preview =
        typeof response.data === 'string'
          ? response.data.slice(0, 200)
          : JSON.stringify(response.data).slice(0, 200);

      const result = {
        url: this.healthCheckUrl,
        success: true,
        status: response.status,
        dataPreview: preview,
        durationMs: Date.now() - startTime,
      };
      console.log(`[HTTP] ✓ Health check passed`, {
        status: result.status,
        time: result.durationMs,
      });
      return result;
    } catch (error: any) {
      const result = {
        url: this.healthCheckUrl,
        success: false,
        status: error?.response?.status,
        error: error?.message || String(error),
        durationMs: Date.now() - startTime,
      };
      console.error(`[HTTP] ✗ Health check failed`, {
        error: result.error,
        status: result.status,
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
        console.log(`[HTTP] ✓ ${probe.label}`, {
          status: result.status,
          time: result.durationMs,
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
        console.warn(`[HTTP] ✗ ${probe.label}`, { error: result.error });
        results.push(result);
      }
    }

    return results;
  }

  private collectNetworkLogs(): INetworkRequestLog[] {
    if (!this.config.enableNetworkLogger) {
      console.log('[NetworkLogger] Disabled, skipping log collection');
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

      console.log(`[NetworkLogger] Collected ${logs.length} network requests`);

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

        console.log(
          `[NetworkLogger][${index + 1}/${logs.length}] ${statusIcon} ${
            log.method
          } ${log.url} [${statusText}] [${durationText}]`,
          log,
        );
      });

      return logs;
    } catch (error) {
      console.error('[NetworkLogger] Failed to collect network logs', error);
      return [];
    }
  }

  // ==================== Report Generation ====================

  private generateReport(results: any): INetworkCheckup {
    const issues = this.analyzeIssues(results);
    const assessment = this.determineAssessment(issues, results);

    return {
      timestamp: new Date().toISOString(),
      config: {
        targetDomain: this.config.targetDomain,
        healthCheckUrl: this.healthCheckUrl,
      },
      summary: {
        allCriticalChecksPassed:
          issues.filter((i) => i.severity === 'critical').length === 0,
        issues,
        assessment,
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

  private analyzeIssues(results: any): IDiagnosticIssue[] {
    const issues: IDiagnosticIssue[] = [];

    // Cross-validation: real blocking
    const isRealBlocking =
      results.tcpTests.isSelectiveBlocking &&
      !results.tlsTest.success &&
      !results.healthCheck.success;

    if (isRealBlocking) {
      issues.push({
        type: EDiagnosticIssueType.SELECTIVE_BLOCKING,
        severity: 'critical',
        message:
          'Selective blocking detected - Your API is blocked but other services work',
        details: [
          'Your API TCP connection failed',
          'Google and Cloudflare are accessible',
          'TLS and HTTP requests failed',
        ],
        suggestedSolutions: [
          'Use domain fronting',
          'Enable ECH (Encrypted Client Hello)',
          'Try a different domain or subdomain',
        ],
      });
    } else if (
      results.tcpTests.isSelectiveBlocking &&
      results.tlsTest.success
    ) {
      issues.push({
        type: EDiagnosticIssueType.TCP_FAILURE,
        severity: 'info',
        message: 'TCP test failed but TLS/HTTP succeeded - false positive',
        details: [
          'This is likely a react-native-tcp-socket bug',
          'Your network is WORKING',
        ],
      });
    }

    // DNS issues
    if (results.dns.error) {
      issues.push({
        type: EDiagnosticIssueType.DNS_FAILURE,
        severity: 'critical',
        message: `DNS resolution failed: ${results.dns.error}`,
      });
    }

    // TLS certificate issues
    if (
      results.tlsTest &&
      !results.tlsTest.success &&
      results.tlsTest.isCertificateError
    ) {
      issues.push({
        type: EDiagnosticIssueType.CERTIFICATE_ERROR,
        severity: 'warning',
        message: 'TLS certificate error (non-critical)',
        details: [
          'This may indicate a test/staging environment',
          'If TCP connection succeeded, this is NOT a blocking issue',
        ],
      });
    }

    // Ping blocked (normal)
    if (!results.pingDomain.success && results.healthCheck.success) {
      issues.push({
        type: EDiagnosticIssueType.PING_BLOCKED,
        severity: 'info',
        message: 'Ping blocked but HTTPS works - this is normal',
        details: [
          'Many CDNs (like CloudFlare) block ICMP ping for DDoS protection',
        ],
      });
    }

    return issues;
  }

  private determineAssessment(
    issues: IDiagnosticIssue[],
    results: any,
  ): 'healthy' | 'degraded' | 'blocked' {
    const hasCritical = issues.some((i) => i.severity === 'critical');
    const hasWarning = issues.some((i) => i.severity === 'warning');

    if (hasCritical) return 'blocked';
    if (hasWarning) return 'degraded';
    return 'healthy';
  }
}
