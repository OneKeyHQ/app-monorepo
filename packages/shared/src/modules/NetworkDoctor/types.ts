/**
 * Network Doctor Library - Type Definitions
 *
 * Complete type definitions, supporting external configuration and extension
 */

// ==================== Configuration Types ====================

/**
 * Doctor Configuration
 */
export interface IDoctorConfig {
  /**
   * Timeout configuration (optional, milliseconds)
   */
  timeouts?: {
    dns?: number;
    tcp?: number;
    tls?: number;
    http?: number;
    ping?: number;
  };

  extraPingTargets?: string[];

  /**
   * Extra HTTP probe endpoints (optional)
   */
  extraHttpProbes?: Array<{
    label: string;
    url: string;
  }>;

  /**
   * Enable network logger (optional, default true)
   */
  enableNetworkLogger?: boolean;

  /**
   * Maximum network logs (optional, default 1000)
   */
  maxNetworkLogs?: number;
}

// ==================== Test Result Types ====================

export interface INetInfoSnapshot {
  type: string;
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  details?: unknown;
}

export interface INetworkEnvironment {
  ipAddress?: string | null;
  gateway?: string | null;
  subnet?: string | null;
  broadcast?: string | null;
}

export interface IDnsResult {
  hostname: string;
  ips: string[];
  error?: string;
  durationMs?: number;
}

export interface ITcpConnectionResult {
  host: string;
  port: number;
  success: boolean;
  tcpHandshakeTime?: number;
  error?: string;
  errorCode?: string;
}

export interface ITlsHandshakeResult {
  url: string;
  success: boolean;
  tlsHandshakeTime?: number;
  error?: string;
  errorCode?: string;
  errorType?: string;
  isCertificateError?: boolean;
  statusCode?: number;
}

export interface IPingResult {
  target: string;
  success: boolean;
  timeMs?: number;
  error?: string;
  code?: string | number;
}

export interface IHttpProbeResult {
  url: string;
  label?: string;
  success: boolean;
  status?: number;
  error?: string;
  dataPreview?: string;
  durationMs?: number;
}

export interface IConnectivityComparison {
  yourApi: ITcpConnectionResult;
  google: ITcpConnectionResult;
  cloudflare: ITcpConnectionResult;
  isSelectiveBlocking: boolean;
}

export interface INetworkRequestLog {
  id: string;
  method: string;
  url: string;
  status: number;
  duration: number;
  startTime: number;
  endTime?: number;
  type?: string;
  responseURL?: string;
  responseContentType?: string;
  responseSize?: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  timeout?: number;
  closeReason?: string;
  serverClose?: unknown;
  serverError?: unknown;
  messages?: string;
  hasRequestBody?: boolean;
  hasResponseBody?: boolean;
}

// ==================== Diagnostic Report Types ====================

/**
 * Diagnostic Issue Types
 */
export enum EDiagnosticIssueType {
  SELECTIVE_BLOCKING = 'SELECTIVE_BLOCKING',
  DNS_FAILURE = 'DNS_FAILURE',
  TCP_FAILURE = 'TCP_FAILURE',
  TLS_FAILURE = 'TLS_FAILURE',
  HTTP_FAILURE = 'HTTP_FAILURE',
  CERTIFICATE_ERROR = 'CERTIFICATE_ERROR',
  PING_BLOCKED = 'PING_BLOCKED',
}

/**
 * Diagnostic Issue Details
 */
export interface IDiagnosticIssue {
  type: EDiagnosticIssueType;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details?: string[];
  suggestedSolutions?: string[];
}

/**
 * Network Checkup Report (Final Output)
 */
export interface INetworkCheckup {
  /**
   * Timestamp
   */
  timestamp: string;

  /**
   * Configuration info
   */
  config: {
    targetDomain: string;
    healthCheckUrl: string;
  };

  /**
   * Diagnostic summary
   */
  summary: {
    /**
     * Whether all critical checks passed
     */
    allCriticalChecksPassed: boolean;

    /**
     * Detected issues list
     */
    issues: IDiagnosticIssue[];

    /**
     * Overall assessment
     */
    assessment: 'healthy' | 'degraded' | 'blocked';
  };

  /**
   * Detailed test results
   */
  results: {
    netInfo: INetInfoSnapshot;
    networkEnv: INetworkEnvironment;
    dns: IDnsResult;
    tcpTests: IConnectivityComparison;
    tlsTest: ITlsHandshakeResult;
    pingDomain: IPingResult;
    pingIp?: IPingResult;
    extraPings: IPingResult[];
    healthCheck: IHttpProbeResult;
    cdnTrace: IHttpProbeResult;
    publicHttpChecks: IHttpProbeResult[];
    networkLogs: INetworkRequestLog[];
  };

  /**
   * Performance metrics
   */
  metrics: {
    totalDurationMs: number;
    dnsResolutionMs?: number;
    tcpHandshakeMs?: number;
    tlsHandshakeMs?: number;
    httpRequestMs?: number;
  };
}

// ==================== Internal Types ====================

/**
 * Default Configuration
 */
export interface IDefaultConfig {
  timeouts: Required<NonNullable<IDoctorConfig['timeouts']>>;
  extraPingTargets: string[];
  extraHttpProbes: Array<{ label: string; url: string }>;
  enableNetworkLogger: boolean;
  maxNetworkLogs: number;
}
