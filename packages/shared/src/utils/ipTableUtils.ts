// verifyMessage is imported dynamically to avoid pulling @ethersproject/wallet
// (and its heavy transitive deps) into the common startup bundle.
import stringify from 'fast-json-stable-stringify';

import { defaultLogger } from '../logger/logger';
import platformEnv from '../platformEnv';
import { CDN_SIGNER_ADDRESS } from '../request/constants/ipTableDefaults';

import type {
  IFirmwareUpdateRolloutConfig,
  IFirmwareUpdateRolloutRule,
  IIpTableConfigWithRuntime,
  IIpTableRemoteConfig,
  IIpTableSignatureVerifyResult,
} from '../request/types/ipTable';

const FIRMWARE_ROLLOUT_PLATFORMS = new Set(['ios', 'android', 'desktop']);

export function isSupportIpTablePlatform() {
  return platformEnv.isNative || platformEnv.isDesktop;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

function isValidFirmwareUpdateRolloutRule(
  value: unknown,
): value is IFirmwareUpdateRolloutRule {
  if (
    !isRecord(value) ||
    Object.keys(value).some(
      (key) =>
        ![
          'enabled',
          'killSwitch',
          'percentageBps',
          'allowDeviceTypes',
          'allowPlatforms',
          'minAppVersion',
        ].includes(key),
    ) ||
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
  return (
    isRecord(value) &&
    Object.keys(value).every((key) =>
      [
        'schemaVersion',
        'policyVersion',
        'salt',
        'expiresAt',
        'coordinatorExternalOnly',
      ].includes(key),
    ) &&
    value.schemaVersion === 1 &&
    Number.isSafeInteger(value.policyVersion) &&
    (value.policyVersion as number) >= 0 &&
    typeof value.salt === 'string' &&
    value.salt.length > 0 &&
    value.salt.length <= 128 &&
    Number.isSafeInteger(value.expiresAt) &&
    (value.expiresAt as number) > 0 &&
    (value.coordinatorExternalOnly === undefined ||
      isValidFirmwareUpdateRolloutRule(value.coordinatorExternalOnly))
  );
}

/**
 * Fields covered by the CDN signature. Extra metadata fields the pipeline may
 * add later must NOT break verification, so we canonicalize an explicit
 * allowlist instead of spreading "everything except signature".
 */
function buildCanonicalSignedPayload(config: IIpTableRemoteConfig): string {
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
export function computeIpTableConfigHash(config: IIpTableRemoteConfig): string {
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
  if (!data || typeof data !== 'object') {
    return false;
  }
  const config = data as Partial<IIpTableRemoteConfig>;
  if (typeof config.version !== 'number') {
    return false;
  }
  if (typeof config.ttl_sec !== 'number') {
    return false;
  }
  if (typeof config.generated_at !== 'string') {
    return false;
  }
  if (typeof config.signature !== 'string') {
    return false;
  }
  if (!config.domains || typeof config.domains !== 'object') {
    return false;
  }
  for (const domainConfig of Object.values(config.domains)) {
    if (!domainConfig || typeof domainConfig !== 'object') {
      return false;
    }
    const endpoints = (domainConfig as { endpoints?: unknown }).endpoints;
    if (!Array.isArray(endpoints)) {
      return false;
    }
    for (const endpoint of endpoints) {
      if (!endpoint || typeof endpoint !== 'object') {
        return false;
      }
      if (typeof (endpoint as { ip?: unknown }).ip !== 'string') {
        return false;
      }
    }
  }
  return (
    config.firmware_rollout === undefined ||
    isValidFirmwareUpdateRolloutConfig(config.firmware_rollout)
  );
}

export function getOrderedIpTableCandidates(options: {
  hostname: string;
  configWithRuntime: IIpTableConfigWithRuntime;
  configKey?: string;
  exactHostOnly?: boolean;
  maxCandidates?: number;
}): string[] {
  const hostname = options.hostname.toLowerCase().replace(/\.$/u, '');
  const configKey =
    options.configKey ??
    (options.exactHostOnly
      ? hostname
      : hostname.split('.').slice(-2).join('.'));
  const endpoints =
    options.configWithRuntime.config.domains[configKey]?.endpoints ?? [];
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
  localConfig: IIpTableRemoteConfig;
  lastVerified?: { version: number; generatedAt: string };
}): { regression: boolean; reason?: string } {
  const { remoteConfig, localConfig, lastVerified } = options;

  const remoteGeneratedAtMs = Date.parse(remoteConfig.generated_at);
  if (Number.isNaN(remoteGeneratedAtMs)) {
    return { regression: true, reason: 'unparseable_generated_at' };
  }

  if (remoteConfig.version < localConfig.version) {
    return { regression: true, reason: 'version_regression' };
  }

  const anchorVersion = lastVerified?.version ?? localConfig.version;
  const anchorGeneratedAtMs = Date.parse(
    lastVerified?.generatedAt ?? localConfig.generated_at,
  );
  if (
    remoteConfig.version === anchorVersion &&
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
  config: IIpTableRemoteConfig;
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
