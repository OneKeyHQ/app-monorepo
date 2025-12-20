/**
 * Network Doctor Library - Type Definitions
 *
 * Complete type definitions, supporting external configuration and extension
 */

// ==================== Configuration Types ====================

/**
 * Diagnostic Phase
 */
export enum EDiagnosticPhase {
  INITIALIZING = 'INITIALIZING',
  BASIC_NETWORK_INFO = 'BASIC_NETWORK_INFO',
  DNS_RESOLUTION = 'DNS_RESOLUTION',
  TCP_TLS_TESTS = 'TCP_TLS_TESTS',
  PING_TESTS = 'PING_TESTS',
  HTTP_TESTS = 'HTTP_TESTS',
  NETWORK_LOGS = 'NETWORK_LOGS',
  GENERATING_REPORT = 'GENERATING_REPORT',
  COMPLETED = 'COMPLETED',
}

/**
 * Progress callback data
 */
export interface IDiagnosticProgress {
  phase: EDiagnosticPhase;
  phaseIndex: number;
  totalPhases: number;
  percentage: number;
  message: string;
}

/**
 * Progress callback function
 */
export type IProgressCallback = (progress: IDiagnosticProgress) => void;

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

  /**
   * Progress callback (optional)
   */
  onProgress?: IProgressCallback;
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
 * Network Connectivity Level (First Layer)
 */
export enum ENetworkConnectivityLevel {
  /** Network completely down - all services unreachable */
  COMPLETELY_DOWN = 'COMPLETELY_DOWN',
  /** International network restricted (typical mainland China) */
  INTERNATIONAL_RESTRICTED = 'INTERNATIONAL_RESTRICTED',
  /** OneKey selectively blocked */
  ONEKEY_BLOCKED = 'ONEKEY_BLOCKED',
  /** OneKey service error (non-blocking) */
  ONEKEY_SERVICE_ERROR = 'ONEKEY_SERVICE_ERROR',
  /** Network healthy */
  HEALTHY = 'HEALTHY',
}

/**
 * OneKey Failure Reason (Second Layer)
 */
export enum EOneKeyFailureReason {
  /** DNS resolution failed */
  DNS_RESOLUTION_FAILED = 'DNS_RESOLUTION_FAILED',
  /** TCP handshake failed */
  TCP_HANDSHAKE_FAILED = 'TCP_HANDSHAKE_FAILED',
  /** TLS handshake failed */
  TLS_HANDSHAKE_FAILED = 'TLS_HANDSHAKE_FAILED',
  /** HTTP request failed */
  HTTP_REQUEST_FAILED = 'HTTP_REQUEST_FAILED',
  /** No failure */
  NONE = 'NONE',
}

/**
 * Network Diagnosis Conclusion (Layered approach)
 */
export interface INetworkDiagnosisConclusion {
  /** First layer: Network connectivity level */
  connectivityLevel: ENetworkConnectivityLevel;

  /** Second layer: OneKey specific failure reason (only when OneKey has issues) */
  oneKeyFailureReason: EOneKeyFailureReason;

  /** Third layer: Failure layer localization */
  failureLayer: 'dns' | 'tcp' | 'tls' | 'http' | null;

  /** Human-readable diagnostic summary */
  summary: string;

  /** Suggested actions for the user */
  suggestedActions: string[];

  /** Overall assessment */
  assessment: 'healthy' | 'degraded' | 'blocked';

  /** Intermediate issues detected (for debugging, e.g., TCP false positive) */
  intermediateIssues?: string[];
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
     * Overall assessment
     */
    assessment: 'healthy' | 'degraded' | 'blocked';

    /**
     * Layered diagnostic conclusion
     */
    conclusion: INetworkDiagnosisConclusion;
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

/**
 * Merged Configuration (after mergeConfig)
 * onProgress remains optional as it's a callback
 */
export interface IMergedConfig {
  timeouts: Required<NonNullable<IDoctorConfig['timeouts']>>;
  extraPingTargets: string[];
  extraHttpProbes: Array<{ label: string; url: string }>;
  enableNetworkLogger: boolean;
  maxNetworkLogs: number;
  onProgress?: IProgressCallback;
}
