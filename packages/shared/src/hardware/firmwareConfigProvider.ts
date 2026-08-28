import axios from 'axios';

import { defaultLogger } from '../logger/logger';
import { DEFAULT_IP_TABLE_CONFIG } from '../request/constants/ipTableDefaults';
import {
  getMappedDomainForIpLookup,
  isIpTableTransportError,
  reportIpTableRequestFailure,
  reportIpTableRequestSuccess,
} from '../request/helpers/ipTableAdapter';
import { nextIpTableRequestSequence } from '../request/helpers/ipTableRequestOutcome';
import {
  isProxyActiveForUrl,
  isSniSupported,
  sniRequest,
} from '../request/helpers/sniRequest';
import requestHelper from '../request/requestHelper';
import { getOrderedIpTableCandidates } from '../utils/ipTableUtils';

import type { RemoteConfigResponse } from '@onekeyfe/hd-core';

// Leave time for SNI fallback within the shared deadline.
const CONFIG_FETCH_TIMEOUT_MS = 15_000;
const CONFIG_FETCH_TOTAL_TIMEOUT_MS = 30_000;
const CONFIG_FETCH_MAX_SNI_CANDIDATES = 3;
const STABLE_CONFIG_URL = 'https://data.onekey.so/config.json';
const PRE_RELEASE_CONFIG_URL = 'https://data.onekey.so/pre-config.json';
const EMPTY_DEVICE_CONFIG: RemoteConfigResponse['pro2'] = {
  firmware: [],
  ble: [],
};
const FIRMWARE_DEVICE_CONFIG_KEYS = [
  'classic',
  'classic1s',
  'classicpure',
  'mini',
  'touch',
  'pro',
  'pro2',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isFirmwareRemoteConfig(
  value: unknown,
): value is RemoteConfigResponse {
  return (
    isRecord(value) &&
    isRecord(value.bridge) &&
    FIRMWARE_DEVICE_CONFIG_KEYS.every((key) => isRecord(value[key]))
  );
}

function parseFirmwareRemoteConfig(
  value: unknown,
): RemoteConfigResponse | null {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  const normalized =
    isRecord(parsed) && parsed.pro2 === undefined
      ? { ...parsed, pro2: EMPTY_DEVICE_CONFIG }
      : parsed;
  return isFirmwareRemoteConfig(normalized) ? normalized : null;
}

async function getConfigSniCandidates(options: {
  hostname: string;
  configKey: string;
}): Promise<string[]> {
  const { hostname, configKey } = options;
  let activeConfig = null;
  try {
    activeConfig = await requestHelper.getIpTableConfig();
  } catch {
    activeConfig = null;
  }
  const activeEndpoints =
    activeConfig?.config.domains[configKey]?.endpoints ?? [];
  const endorsedIps = new Set(activeEndpoints.map((endpoint) => endpoint.ip));
  const preferredCandidates = [
    activeConfig?.runtime?.selections?.[configKey],
    activeConfig?.runtime?.lastBestIp?.[configKey],
  ].filter(
    (candidate): candidate is string =>
      typeof candidate === 'string' &&
      candidate.length > 0 &&
      endorsedIps.has(candidate),
  );
  const builtinCandidates = getOrderedIpTableCandidates({
    hostname,
    configKey,
    configWithRuntime: {
      config: DEFAULT_IP_TABLE_CONFIG,
      runtime: undefined,
    },
  });
  return [...new Set([...preferredCandidates, ...builtinCandidates])].slice(
    0,
    CONFIG_FETCH_MAX_SNI_CANDIDATES,
  );
}

async function fetchFirmwareConfigWithinDeadline({
  preRelease,
  startedAt,
  signal,
}: {
  preRelease: boolean;
  startedAt: number;
  signal: AbortSignal;
}): Promise<RemoteConfigResponse | null> {
  const deadlineAt = startedAt + CONFIG_FETCH_TOTAL_TIMEOUT_MS;
  const isExpired = () => signal.aborted || Date.now() >= deadlineAt;

  try {
    const { isSupportIpTablePlatform } = await import('../utils/ipTableUtils');
    if (!isSupportIpTablePlatform()) {
      return null;
    }
  } catch {
    return null;
  }

  const configUrl = preRelease ? PRE_RELEASE_CONFIG_URL : STABLE_CONFIG_URL;
  const parsedUrl = new URL(`${configUrl}?noCache=${Date.now().toString()}`);
  const rootDomain = parsedUrl.hostname.split('.').slice(-2).join('.');
  const configKey =
    (await getMappedDomainForIpLookup(rootDomain)) ?? rootDomain;
  if (isExpired()) {
    return null;
  }
  const plainAxios = axios.create();
  const domainRequestSequence = nextIpTableRequestSequence();
  try {
    const response = await plainAxios.get<unknown>(parsedUrl.toString(), {
      timeout: Math.min(CONFIG_FETCH_TIMEOUT_MS, deadlineAt - Date.now()),
      signal,
    });
    if (isExpired()) {
      return null;
    }
    reportIpTableRequestSuccess({
      domain: configKey,
      requestType: 'domain',
      target: parsedUrl.hostname,
      requestSequence: domainRequestSequence,
    });
    const config = parseFirmwareRemoteConfig(response.data);
    defaultLogger.ipTable.request.info({
      info: `[FirmwareManifest] config_fetch route=domain outcome=${
        config ? 'success' : 'invalid_schema'
      } durationMs=${Date.now() - startedAt}`,
    });
    return config;
  } catch (error) {
    if (isExpired()) {
      return null;
    }
    if (
      error &&
      typeof error === 'object' &&
      'response' in error &&
      error.response
    ) {
      reportIpTableRequestSuccess({
        domain: configKey,
        requestType: 'domain',
        target: parsedUrl.hostname,
        requestSequence: domainRequestSequence,
      });
    }
    if (!isIpTableTransportError(error)) {
      return null;
    }
    reportIpTableRequestFailure({
      domain: configKey,
      requestType: 'domain',
      target: parsedUrl.hostname,
      error: error instanceof Error ? error.message : 'Network error',
      requestSequence: domainRequestSequence,
    });
  }

  if (!isSniSupported()) {
    return null;
  }

  let sniCandidateLimit = CONFIG_FETCH_MAX_SNI_CANDIDATES;
  try {
    const proxyActive = await isProxyActiveForUrl(parsedUrl.toString());
    if (proxyActive === true) {
      sniCandidateLimit = 1;
    }
  } catch {
    // Firmware config keeps one direct fallback when proxy routing is unknown.
    sniCandidateLimit = 1;
  }
  if (isExpired()) {
    return null;
  }

  const candidates = (
    await getConfigSniCandidates({
      hostname: parsedUrl.hostname,
      configKey,
    })
  ).slice(0, sniCandidateLimit);
  for (const [candidateIndex, ip] of candidates.entries()) {
    if (isExpired()) {
      return null;
    }
    const requestSequence = nextIpTableRequestSequence();
    try {
      const response = await sniRequest({
        ip,
        hostname: parsedUrl.hostname,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: 'GET',
        headers: {},
        body: null,
        timeout: Math.min(CONFIG_FETCH_TIMEOUT_MS, deadlineAt - Date.now()),
      });
      if (isExpired()) {
        return null;
      }
      if (response) {
        reportIpTableRequestSuccess({
          domain: configKey,
          requestType: 'ip',
          target: ip,
          requestSequence,
        });
      }
      if (response && response.statusCode >= 200 && response.statusCode < 300) {
        const config = parseFirmwareRemoteConfig(
          response.body ?? response.data,
        );
        if (config) {
          defaultLogger.ipTable.request.info({
            info: `[FirmwareManifest] config_fetch route=sni outcome=success candidateIndex=${candidateIndex} durationMs=${
              Date.now() - startedAt
            }`,
          });
          return config;
        }
      }
    } catch (error) {
      if (isExpired()) {
        return null;
      }
      if (!isIpTableTransportError(error)) {
        return null;
      }
      reportIpTableRequestFailure({
        domain: configKey,
        requestType: 'ip',
        target: ip,
        error: error instanceof Error ? error.message : 'Network error',
        requestSequence,
      });
    }
  }
  return null;
}

export async function fetchFirmwareConfig({
  preRelease,
}: {
  preRelease: boolean;
}): Promise<RemoteConfigResponse | null> {
  const startedAt = Date.now();
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      defaultLogger.ipTable.request.info({
        info: `[FirmwareManifest] config_fetch outcome=total_timeout durationMs=${
          Date.now() - startedAt
        }`,
      });
      resolve(null);
    }, CONFIG_FETCH_TOTAL_TIMEOUT_MS);
  });

  try {
    // Bound preflight and native calls too; late results cannot start retries
    // or publish a successful snapshot after the caller has timed out.
    return await Promise.race([
      fetchFirmwareConfigWithinDeadline({
        preRelease,
        startedAt,
        signal: controller.signal,
      }),
      timeout,
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}
