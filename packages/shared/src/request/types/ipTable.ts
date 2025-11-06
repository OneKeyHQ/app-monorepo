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
}

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
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}
