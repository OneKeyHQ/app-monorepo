// ==================== Existing IP Table Config (Backward Compatible) ====================

/**
 * IP Table configuration (legacy format for internal use)
 */
export interface IIpTableConfig {
  enabled: boolean;
  hosts: {
    [rootDomain: string]: {
      primaryIps: string[];
      fallbackIps: string[];
      enabled: boolean;
    };
  };
  currentSelections: {
    [rootDomain: string]: string; // Currently selected IP
  };
}

// ==================== CDN Remote Config ====================

/**
 * IP Table configuration distributed via CDN
 */
export interface IIpTableRemoteConfig {
  version: number;
  ttl_sec: number;
  generated_at: string;
  signature: string;

  domains: {
    [domain: string]: {
      endpoints: Array<{
        ip: string;
        provider: string;
        region: 'CN' | 'GLOBAL' | 'ALL';
        weight: number;
      }>;
    };
  };
}

/**
 * IP Table runtime state
 */
export interface IIpTableRuntime {
  enabled: boolean;
  lastUpdated: number;
  lastRegionCheck: number;
  selections: {
    [domain: string]: string; // Currently selected IP for each domain
  };
  /**
   * Best IP measured by the most recent speed test per domain, recorded even
   * when the final selection chose the domain. Used for fast failover when
   * the direct domain starts failing real traffic.
   */
  lastBestIp?: {
    [domain: string]: string;
  };
  /** Provenance of the last successfully verified CDN config */
  lastVerified?: {
    at: number;
    version: number;
    generatedAt: string;
    /** FNV-1a correlation hash of the canonical signed payload (not a security hash) */
    payloadHash: string;
  };
}

// ==================== Endpoint Decision (pure selection logic) ====================

export interface IIpTableEndpointDecisionInput {
  /** Average latency of direct-domain probe; Infinity = all probes failed */
  domainLatency: number;
  /** ip -> average latency; Infinity = that ip failed all probes */
  ipLatencies: Record<string, number>;
  /** undefined = never selected; '' = domain selected; other = selected ip */
  currentSelection: string | undefined;
  /** true when real traffic on direct domain hit the failover threshold */
  domainFailingRealTraffic: boolean;
  strictMode: boolean;
  /** e.g. 0.3 — candidate must be 30% faster to displace current endpoint */
  improvementThreshold: number;
}

export type IIpTableEndpointDecision =
  | {
      action: 'select_ip';
      ip: string;
      reason:
        | 'strict'
        | 'domain_probe_failed'
        | 'domain_failing'
        | 'faster'
        | 'sticky';
    }
  | {
      action: 'select_domain';
      reason: 'all_ip_failed' | 'competitive' | 'sticky' | 'faster';
    }
  | { action: 'no_change'; reason: 'all_failed' };

// ==================== Signature Verification (structured result) ====================

export type IIpTableSignatureVerifyFailureReason =
  | 'missing_signature'
  | 'verifier_load_failed'
  | 'malformed_signature'
  | 'signer_mismatch'
  | 'unexpected_error';

export type IIpTableSignatureVerifyResult =
  | { ok: true; recoveredAddress: string }
  | {
      ok: false;
      reason: IIpTableSignatureVerifyFailureReason;
      errorMessage?: string;
    };

/**
 * IP Table configuration with runtime state
 * Clear separation between config and runtime data
 */
export interface IIpTableConfigWithRuntime {
  config: IIpTableRemoteConfig;
  runtime: IIpTableRuntime | undefined;
}

// ==================== SNI Request & Response ====================

/**
 * SNI request configuration
 */
export interface ISniRequestConfig {
  requestId?: string;
  ip: string;
  hostname: string;
  path: string;
  headers: Record<string, string>;
  method: string;
  body: string | null;
  timeout: number;
  port?: number;
}

/**
 * SNI response
 */
export interface ISniResponse {
  data?: string;
  status?: number;
  statusText?: string;
  statusCode: number;
  headers: Record<string, string>;
  multiValueHeaders?: Record<string, string[]>;
  body: string;
}
