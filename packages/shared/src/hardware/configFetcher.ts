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

const CONFIG_FETCH_TIMEOUT_MS = 7000;
const CONFIG_FETCH_MAX_SNI_CANDIDATES = 3;
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
  // Stable config can predate a newly introduced device manifest. The SDK
  // already treats missing device data as empty, so normalize that one
  // forward-compatible field before applying the strict schema guard.
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

export async function createConfigFetcher(): Promise<
  ((url: string) => Promise<RemoteConfigResponse | null>) | undefined
> {
  // Only create configFetcher for platforms that support IP Table
  // Otherwise return undefined to let SDK use its default fetching logic
  try {
    const { isSupportIpTablePlatform } = await import('../utils/ipTableUtils');
    if (!isSupportIpTablePlatform()) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  return async (url: string) => {
    const startedAt = Date.now();
    const parsedUrl = new URL(url);
    const rootDomain = parsedUrl.hostname.split('.').slice(-2).join('.');
    const configKey =
      (await getMappedDomainForIpLookup(rootDomain)) ?? rootDomain;
    const plainAxios = axios.create();
    const domainRequestSequence = nextIpTableRequestSequence();
    try {
      const response = await plainAxios.get<unknown>(url, {
        timeout: CONFIG_FETCH_TIMEOUT_MS,
      });
      reportIpTableRequestSuccess({
        domain: configKey,
        requestType: 'domain',
        target: parsedUrl.hostname,
        requestSequence: domainRequestSequence,
      });
      const config = parseFirmwareRemoteConfig(response.data);
      defaultLogger.ipTable.request.info({
        info: `[HardwareSDK] firmware_config_fetch route=domain outcome=${
          config ? 'success' : 'invalid_schema'
        } durationMs=${Date.now() - startedAt}`,
      });
      return config;
    } catch (error) {
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
    try {
      if ((await isProxyActiveForUrl(url)) === true) {
        return null;
      }
    } catch {
      return null;
    }

    const candidates = await getConfigSniCandidates({
      hostname: parsedUrl.hostname,
      configKey,
    });
    for (const [candidateIndex, ip] of candidates.entries()) {
      const requestSequence = nextIpTableRequestSequence();
      try {
        const response = await sniRequest({
          ip,
          hostname: parsedUrl.hostname,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          method: 'GET',
          headers: {},
          body: null,
          timeout: CONFIG_FETCH_TIMEOUT_MS,
        });
        if (
          !response ||
          response.statusCode < 200 ||
          response.statusCode >= 300
        ) {
          if (response) {
            reportIpTableRequestSuccess({
              domain: configKey,
              requestType: 'ip',
              target: ip,
              requestSequence,
            });
          }
          return null;
        }
        reportIpTableRequestSuccess({
          domain: configKey,
          requestType: 'ip',
          target: ip,
          requestSequence,
        });
        const config = parseFirmwareRemoteConfig(
          response.body ?? response.data,
        );
        if (!config) {
          return null;
        }
        defaultLogger.ipTable.request.info({
          info: `[HardwareSDK] firmware_config_fetch route=sni outcome=success candidateIndex=${candidateIndex} durationMs=${
            Date.now() - startedAt
          }`,
        });
        return config;
      } catch (error) {
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
  };
}
