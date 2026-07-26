// verifyMessage is imported dynamically to avoid pulling @ethersproject/wallet
// (and its heavy transitive deps) into the common startup bundle.
import stringify from 'fast-json-stable-stringify';
import isIP from 'validator/lib/isIP';

import { defaultLogger } from '../logger/logger';
import platformEnv from '../platformEnv';
import {
  CDN_SIGNER_ADDRESS,
  DEFAULT_IP_TABLE_CONFIG,
} from '../request/constants/ipTableDefaults';

import type {
  IFirmwareUpdateRolloutConfig,
  IFirmwareUpdateRolloutRule,
  IIpTableConfigWithRuntime,
  IIpTableEffectiveConfig,
  IIpTableRemoteConfig,
  IIpTableSignatureVerifyResult,
} from '../request/types/ipTable';

export const IP_TABLE_CONFIG_MIN_TTL_SEC = 60;
export const IP_TABLE_CONFIG_MAX_TTL_SEC = 7 * 24 * 60 * 60;
export const IP_TABLE_CONFIG_MAX_FUTURE_SKEW_MS = 10 * 60 * 1000;

const FIRMWARE_ROLLOUT_RULE_KEYS = new Set([
  'enabled',
  'killSwitch',
  'percentageBps',
  'allowDeviceTypes',
  'allowPlatforms',
  'minAppVersion',
]);
const FIRMWARE_ROLLOUT_CONFIG_KEYS = new Set([
  'schemaVersion',
  'policyVersion',
  'salt',
  'expiresAt',
  'p0Classic1sV2',
  'coordinatorExternalOnly',
]);
const FIRMWARE_ROLLOUT_PLATFORMS = new Set(['ios', 'android', 'desktop']);
const DOMAIN_NAME_PATTERN =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;

export function isSupportIpTablePlatform() {
  return platformEnv.isNative || platformEnv.isDesktop;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnlyKeys = (
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
) => Object.keys(value).every((key) => allowedKeys.has(key));

const isValidStringArray = (
  value: unknown,
  validator: (entry: string) => boolean,
): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.length <= 128 &&
  value.every(
    (entry) =>
      typeof entry === 'string' &&
      entry.length > 0 &&
      entry.length <= 128 &&
      validator(entry),
  ) &&
  new Set(value).size === value.length;

export function isValidFirmwareUpdateRolloutRule(
  value: unknown,
): value is IFirmwareUpdateRolloutRule {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, FIRMWARE_ROLLOUT_RULE_KEYS) ||
    typeof value.enabled !== 'boolean' ||
    typeof value.killSwitch !== 'boolean' ||
    !Number.isSafeInteger(value.percentageBps) ||
    (value.percentageBps as number) < 0 ||
    (value.percentageBps as number) > 10_000
  ) {
    return false;
  }

  if (
    value.allowDeviceTypes !== undefined &&
    !isValidStringArray(value.allowDeviceTypes, () => true)
  ) {
    return false;
  }

  if (
    value.allowPlatforms !== undefined &&
    !isValidStringArray(value.allowPlatforms, (entry) =>
      FIRMWARE_ROLLOUT_PLATFORMS.has(entry),
    )
  ) {
    return false;
  }

  return (
    value.minAppVersion === undefined ||
    (typeof value.minAppVersion === 'string' &&
      value.minAppVersion.length > 0 &&
      value.minAppVersion.length <= 64)
  );
}

export function isValidFirmwareUpdateRolloutConfig(
  value: unknown,
): value is IFirmwareUpdateRolloutConfig {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, FIRMWARE_ROLLOUT_CONFIG_KEYS) ||
    value.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.policyVersion) ||
    (value.policyVersion as number) < 0 ||
    typeof value.salt !== 'string' ||
    value.salt.length === 0 ||
    value.salt.length > 128 ||
    !Number.isSafeInteger(value.expiresAt) ||
    (value.expiresAt as number) <= 0
  ) {
    return false;
  }

  return (
    (value.p0Classic1sV2 === undefined ||
      isValidFirmwareUpdateRolloutRule(value.p0Classic1sV2)) &&
    (value.coordinatorExternalOnly === undefined ||
      isValidFirmwareUpdateRolloutRule(value.coordinatorExternalOnly))
  );
}

/**
 * Fields covered by the CDN signature. Extra metadata fields the pipeline may
 * add later must NOT break verification, so we canonicalize an explicit
 * allowlist instead of spreading "everything except signature".
 */
function buildCanonicalSignedPayload(
  config: Pick<
    IIpTableRemoteConfig,
    'version' | 'ttl_sec' | 'generated_at' | 'domains' | 'firmware_rollout'
  >,
): string {
  return stringify({
    version: config.version,
    ttl_sec: config.ttl_sec,
    generated_at: config.generated_at,
    domains: config.domains,
    ...(config.firmware_rollout
      ? { firmware_rollout: config.firmware_rollout }
      : {}),
  });
}

/** FNV-1a 32-bit — correlation id for logs/persistence, not a security hash. */
export function computeIpTableConfigHash(
  config: Pick<
    IIpTableRemoteConfig,
    'version' | 'ttl_sec' | 'generated_at' | 'domains' | 'firmware_rollout'
  >,
): string {
  const value = buildCanonicalSignedPayload(config);
  let hash = 0x81_1c_9d_c5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01_00_01_93) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Structural guard for CDN payloads. A misconfigured edge can return HTML or
 * a truncated body that still parses; reject it before verification so the
 * failure reason points at the delivery layer, not the signature.
 */
export function isValidIpTableRemoteConfigShape(
  data: unknown,
): data is IIpTableRemoteConfig {
  if (!isRecord(data)) {
    return false;
  }
  const config = data;
  if (!Number.isSafeInteger(config.version) || (config.version as number) < 1) {
    return false;
  }
  if (
    !Number.isSafeInteger(config.ttl_sec) ||
    (config.ttl_sec as number) < IP_TABLE_CONFIG_MIN_TTL_SEC ||
    (config.ttl_sec as number) > IP_TABLE_CONFIG_MAX_TTL_SEC
  ) {
    return false;
  }
  if (
    typeof config.generated_at !== 'string' ||
    Number.isNaN(Date.parse(config.generated_at))
  ) {
    return false;
  }
  if (typeof config.signature !== 'string') {
    return false;
  }
  if (
    !isRecord(config.domains) ||
    Object.keys(config.domains).length === 0 ||
    Object.keys(config.domains).length > 128
  ) {
    return false;
  }
  for (const [domain, domainConfig] of Object.entries(config.domains)) {
    if (
      !DOMAIN_NAME_PATTERN.test(domain) ||
      domain !== domain.toLowerCase() ||
      !isRecord(domainConfig) ||
      !hasOnlyKeys(domainConfig, new Set(['endpoints']))
    ) {
      return false;
    }
    const { endpoints } = domainConfig;
    if (
      !Array.isArray(endpoints) ||
      endpoints.length === 0 ||
      endpoints.length > 32
    ) {
      return false;
    }
    const endpointIps = new Set<string>();
    for (const endpoint of endpoints) {
      if (
        !isRecord(endpoint) ||
        !hasOnlyKeys(
          endpoint,
          new Set(['ip', 'provider', 'region', 'weight']),
        ) ||
        typeof endpoint.ip !== 'string' ||
        !isIP(endpoint.ip) ||
        endpointIps.has(endpoint.ip) ||
        typeof endpoint.provider !== 'string' ||
        endpoint.provider.length === 0 ||
        endpoint.provider.length > 64 ||
        !['CN', 'GLOBAL', 'ALL'].includes(String(endpoint.region)) ||
        !Number.isSafeInteger(endpoint.weight) ||
        (endpoint.weight as number) < 0 ||
        (endpoint.weight as number) > 10_000
      ) {
        return false;
      }
      endpointIps.add(endpoint.ip);
    }
  }
  return (
    config.firmware_rollout === undefined ||
    isValidFirmwareUpdateRolloutConfig(config.firmware_rollout)
  );
}

export type IIpTableConfigFreshnessFailure =
  | 'invalid_ttl'
  | 'invalid_generated_at'
  | 'generated_in_future'
  | 'expired';

export function validateIpTableConfigFreshness(options: {
  config: Pick<IIpTableRemoteConfig, 'ttl_sec' | 'generated_at'>;
  now?: number;
}):
  | { valid: true; generatedAtMs: number; expiresAtMs: number }
  | { valid: false; reason: IIpTableConfigFreshnessFailure } {
  const { config, now = Date.now() } = options;
  if (
    !Number.isSafeInteger(config.ttl_sec) ||
    config.ttl_sec < IP_TABLE_CONFIG_MIN_TTL_SEC ||
    config.ttl_sec > IP_TABLE_CONFIG_MAX_TTL_SEC
  ) {
    return { valid: false, reason: 'invalid_ttl' };
  }
  const generatedAtMs = Date.parse(config.generated_at);
  if (Number.isNaN(generatedAtMs)) {
    return { valid: false, reason: 'invalid_generated_at' };
  }
  if (generatedAtMs > now + IP_TABLE_CONFIG_MAX_FUTURE_SKEW_MS) {
    return { valid: false, reason: 'generated_in_future' };
  }
  const expiresAtMs = generatedAtMs + config.ttl_sec * 1000;
  if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs < now) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true, generatedAtMs, expiresAtMs };
}

export function createEffectiveIpTableConfig(options: {
  rawConfig?: IIpTableRemoteConfig;
  source: IIpTableEffectiveConfig['source'];
}): IIpTableEffectiveConfig {
  const rawConfig = options.rawConfig ?? DEFAULT_IP_TABLE_CONFIG;
  return {
    version: rawConfig.version,
    ttl_sec: rawConfig.ttl_sec,
    generated_at: rawConfig.generated_at,
    domains:
      options.source === 'signed-remote'
        ? {
            ...DEFAULT_IP_TABLE_CONFIG.domains,
            ...rawConfig.domains,
          }
        : rawConfig.domains,
    ...(rawConfig.firmware_rollout
      ? { firmware_rollout: rawConfig.firmware_rollout }
      : {}),
    source: options.source,
    sourcePayloadHash: computeIpTableConfigHash(rawConfig),
  };
}

export function getOrderedIpTableCandidates(options: {
  hostname: string;
  configWithRuntime: IIpTableConfigWithRuntime;
  exactHostOnly?: boolean;
  maxCandidates?: number;
}): string[] {
  const hostname = options.hostname.toLowerCase().replace(/\.$/u, '');
  const configKey = options.exactHostOnly
    ? hostname
    : hostname.split('.').slice(-2).join('.');
  const endpoints =
    options.configWithRuntime.config.domains[configKey]?.endpoints ?? [];
  if (endpoints.length === 0) {
    return [];
  }

  const endorsedIps = new Set(endpoints.map((endpoint) => endpoint.ip));
  const candidates = [
    options.configWithRuntime.runtime?.selections?.[configKey],
    options.configWithRuntime.runtime?.lastBestIp?.[configKey],
    ...endpoints
      .toSorted((left, right) => right.weight - left.weight)
      .map((endpoint) => endpoint.ip),
  ].filter(
    (ip): ip is string =>
      typeof ip === 'string' && ip.length > 0 && endorsedIps.has(ip),
  );

  return [...new Set(candidates)].slice(
    0,
    options.maxCandidates ?? candidates.length,
  );
}

function logVerifyEvent(
  level: 'info' | 'error',
  fields: Record<string, unknown>,
): void {
  const info = `[IpTableUtils] ${Object.entries({
    event: 'iptable_config_verify',
    ...fields,
  })
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ')}`;
  if (level === 'error') {
    defaultLogger.ipTable.request.error({ info });
  } else {
    defaultLogger.ipTable.request.info({ info });
  }
}

/**
 * Verify the CDN config signature with a structured result that separates
 * the failure stages. `verifier_load_failed` means the crypto verifier could
 * not even be loaded in this runtime (e.g. a split-bundle segment refused for
 * the background runtime — the 2026-07-16 incident); it is a packaging
 * problem, NOT an invalid signature, and must never be reported as one.
 */
export async function verifyIpTableConfigSignatureDetailed(
  config: IIpTableRemoteConfig,
): Promise<IIpTableSignatureVerifyResult> {
  const payloadHash = computeIpTableConfigHash(config);

  if (!config.signature) {
    logVerifyEvent('error', {
      stage: 'precheck',
      reason: 'missing_signature',
      configVersion: config.version,
      payloadHash,
    });
    return { ok: false, reason: 'missing_signature' };
  }

  const canonicalString = buildCanonicalSignedPayload(config);

  let verifyMessage: (message: string, signature: string) => string;
  try {
    ({ verifyMessage } = await import('@ethersproject/wallet'));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logVerifyEvent('error', {
      stage: 'load_verifier',
      reason: 'verifier_load_failed',
      configVersion: config.version,
      payloadHash,
      errorMessage,
    });
    return { ok: false, reason: 'verifier_load_failed', errorMessage };
  }

  try {
    const recoveredAddress = verifyMessage(canonicalString, config.signature);
    if (recoveredAddress.toLowerCase() === CDN_SIGNER_ADDRESS.toLowerCase()) {
      logVerifyEvent('info', {
        stage: 'compare_signer',
        result: 'ok',
        configVersion: config.version,
        generatedAt: config.generated_at,
        payloadHash,
      });
      return { ok: true, recoveredAddress };
    }
    // Signer addresses are public constants; logging them is safe and is the
    // single most useful datum when diagnosing a bad CDN publish.
    logVerifyEvent('error', {
      stage: 'compare_signer',
      reason: 'signer_mismatch',
      configVersion: config.version,
      payloadHash,
      recovered: recoveredAddress,
      expected: CDN_SIGNER_ADDRESS,
    });
    return { ok: false, reason: 'signer_mismatch' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logVerifyEvent('error', {
      stage: 'recover',
      reason: 'malformed_signature',
      configVersion: config.version,
      payloadHash,
      errorMessage,
    });
    return { ok: false, reason: 'malformed_signature', errorMessage };
  }
}

export async function verifyIpTableConfigSignature(
  config: IIpTableRemoteConfig,
): Promise<boolean> {
  const result = await verifyIpTableConfigSignatureDetailed(config);
  return result.ok;
}

/**
 * Rollback protection: a valid signature is not enough — a stale but
 * legitimately signed config must not displace a newer one. When no
 * `lastVerified` anchor exists yet (installs that predate provenance
 * tracking), the currently active config's own version/generated_at serves
 * as the anchor, so the monotonic guarantee holds from the first update.
 */
export function isIpTableConfigRegression(options: {
  remoteConfig: IIpTableRemoteConfig;
  localConfig: Pick<IIpTableRemoteConfig, 'version' | 'generated_at'>;
  lastVerified?: { version: number; generatedAt: string };
}): { regression: boolean; reason?: string } {
  const { remoteConfig, localConfig, lastVerified } = options;

  const remoteGeneratedAtMs = Date.parse(remoteConfig.generated_at);
  if (Number.isNaN(remoteGeneratedAtMs)) {
    return { regression: true, reason: 'unparseable_generated_at' };
  }

  const anchorVersion = lastVerified?.version ?? localConfig.version;
  if (remoteConfig.version < anchorVersion) {
    return { regression: true, reason: 'version_regression' };
  }

  const anchorGeneratedAtMs = Date.parse(
    lastVerified?.generatedAt ?? localConfig.generated_at,
  );
  if (
    !Number.isNaN(anchorGeneratedAtMs) &&
    remoteGeneratedAtMs < anchorGeneratedAtMs
  ) {
    return { regression: true, reason: 'generated_at_regression' };
  }

  return { regression: false };
}

/**
 * Drop runtime selections and last-best IPs that the current signed config
 * no longer endorses. The persisted effective config is the signed remote
 * envelope verbatim (never an additive merge), so a revoked or compromised
 * endpoint removed from the CDN config must also stop being routable via
 * previously persisted runtime state.
 */
export function pruneIpTableRuntimeSelections(options: {
  config: Pick<IIpTableRemoteConfig, 'domains'>;
  selections?: Record<string, string>;
  lastBestIp?: Record<string, string>;
}): {
  selections: Record<string, string>;
  lastBestIp: Record<string, string>;
  prunedCount: number;
} {
  const allowedIpsByDomain = new Map<string, Set<string>>();
  for (const [domain, domainConfig] of Object.entries(options.config.domains)) {
    allowedIpsByDomain.set(
      domain,
      new Set(domainConfig.endpoints.map((endpoint) => endpoint.ip)),
    );
  }

  let prunedCount = 0;
  const selections: Record<string, string> = {};
  for (const [domain, ip] of Object.entries(options.selections ?? {})) {
    // '' is the explicit "use the domain" choice and is always allowed.
    if (ip === '' || allowedIpsByDomain.get(domain)?.has(ip)) {
      selections[domain] = ip;
    } else {
      prunedCount += 1;
    }
  }

  const lastBestIp: Record<string, string> = {};
  for (const [domain, ip] of Object.entries(options.lastBestIp ?? {})) {
    if (allowedIpsByDomain.get(domain)?.has(ip)) {
      lastBestIp[domain] = ip;
    } else {
      prunedCount += 1;
    }
  }

  return { selections, lastBestIp, prunedCount };
}
