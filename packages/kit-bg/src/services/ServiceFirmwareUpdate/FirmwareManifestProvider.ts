import axios from 'axios';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isSniFailClosedError } from '@onekeyhq/shared/src/request/helpers/sniFailClosedError';
import {
  isProxyActiveForUrl,
  isSniSupported,
  sniRequest,
} from '@onekeyhq/shared/src/request/helpers/sniRequest';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';
import requestHelper from '@onekeyhq/shared/src/request/requestHelper';
import type {
  IIpTableConfigWithRuntime,
  ISniRequestConfig,
  ISniResponse,
} from '@onekeyhq/shared/src/request/types/ipTable';
import { getOrderedIpTableCandidates } from '@onekeyhq/shared/src/utils/ipTableUtils';
import { parseStrictJson } from '@onekeyhq/shared/src/utils/strictJsonUtils';

import {
  type IFirmwareManifestCacheRecord,
  type SimpleDbEntityFirmwareManifestCache,
  firmwareManifestCache,
} from '../../dbs/simple/entity/SimpleDbEntityFirmwareManifestCache';

import {
  trustedFirmwareCatalogMetadata,
  trustedFirmwareCatalogSnapshotJsonByKey,
} from './catalog/trustedFirmwareCatalog.generated';

import type {
  IFirmwareManifestCoreSdk,
  IFirmwareManifestLoadResult,
  IFirmwareManifestSelection,
  IFirmwareManifestSnapshot,
} from './firmwareUpdateCoordinatorTypes';

export const FIRMWARE_MANIFEST_MAX_BODY_BYTES = 1024 * 1024;
export const FIRMWARE_MANIFEST_TOTAL_TIMEOUT_MS = 10_000;
export const FIRMWARE_MANIFEST_CANDIDATE_TIMEOUT_MS = 3000;

const RETRYABLE_STATUS_CODES = new Set([500, 502, 503, 504]);
const JSON_CONTENT_TYPE_PATTERN = /^application\/(?:[^;]+\+)?json(?:\s*;|$)/i;

type ITrustedFirmwareCatalogIndexEntry =
  (typeof trustedFirmwareCatalogMetadata.snapshotIndex)[number];

export type EFirmwareManifestProviderErrorCode =
  | 'CATALOG_ENTRY_MISSING'
  | 'CATALOG_ROLLBACK'
  | 'CATALOG_SNAPSHOT_INVALID'
  | 'REMOTE_MANIFEST_INVALID';

export type IFirmwareManifestProviderError = OneKeyLocalError & {
  firmwareManifestCode: EFirmwareManifestProviderErrorCode;
};

export type IFirmwareManifestTextResponse = {
  statusCode: number;
  headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  body: string;
  finalUrl?: string;
};

export type IFirmwareManifestProviderDependencies = {
  now: () => number;
  loadCoreSdk: () => Promise<IFirmwareManifestCoreSdk>;
  getIpTableConfig: () => Promise<IIpTableConfigWithRuntime | null>;
  isSniSupported: () => boolean;
  isProxyActiveForUrl: (url: string) => Promise<boolean | null>;
  sniRequest: (config: ISniRequestConfig) => Promise<ISniResponse | null>;
  domainRequest: (
    url: string,
    options: {
      headers: Record<string, string>;
      timeoutMs: number;
      maxBodyBytes: number;
    },
  ) => Promise<IFirmwareManifestTextResponse>;
  getRequestHeaders: () => Promise<Record<string, string>>;
  cache: SimpleDbEntityFirmwareManifestCache;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getAxiosFinalUrl = (request: unknown): string | undefined => {
  if (
    isRecord(request) &&
    typeof request.responseURL === 'string' &&
    request.responseURL
  ) {
    return request.responseURL;
  }
  return undefined;
};

const normalizeResponseHeaders = (
  headers: Readonly<Record<string, unknown>>,
): Record<string, string | readonly string[] | undefined> => {
  const normalized: Record<string, string | readonly string[] | undefined> = {};
  Object.entries(headers).forEach(([name, value]) => {
    if (Array.isArray(value)) {
      normalized[name] = value.filter(
        (item): item is string => typeof item === 'string',
      );
    } else if (typeof value === 'string') {
      normalized[name] = value;
    } else {
      normalized[name] = String(value ?? '');
    }
  });
  return normalized;
};

const defaultDomainRequest: IFirmwareManifestProviderDependencies['domainRequest'] =
  async (url, { headers, timeoutMs, maxBodyBytes }) => {
    const response = await axios.get<string>(url, {
      headers,
      timeout: timeoutMs,
      responseType: 'text',
      transformResponse: [(data: unknown) => data],
      maxContentLength: maxBodyBytes,
      maxBodyLength: maxBodyBytes,
      maxRedirects: 0,
      validateStatus: () => true,
    });
    return {
      statusCode: response.status,
      headers: normalizeResponseHeaders(response.headers),
      body: typeof response.data === 'string' ? response.data : '',
      ...(getAxiosFinalUrl(response.request)
        ? { finalUrl: getAxiosFinalUrl(response.request) }
        : {}),
    };
  };

const DEFAULT_DEPENDENCIES: IFirmwareManifestProviderDependencies = {
  now: () => Date.now(),
  loadCoreSdk: CoreSDKLoader,
  getIpTableConfig: () => requestHelper.getFirmwareManifestIpTableConfig(),
  isSniSupported,
  isProxyActiveForUrl,
  sniRequest,
  domainRequest: defaultDomainRequest,
  getRequestHeaders,
  cache: firmwareManifestCache,
};

const createProviderError = (
  code: EFirmwareManifestProviderErrorCode,
  message: string,
): IFirmwareManifestProviderError =>
  Object.assign(new OneKeyLocalError(message), {
    firmwareManifestCode: code,
  });

const isFirmwareManifestProviderError = (
  error: unknown,
): error is IFirmwareManifestProviderError =>
  error instanceof OneKeyLocalError &&
  'firmwareManifestCode' in error &&
  typeof error.firmwareManifestCode === 'string';

const fail = (
  code: EFirmwareManifestProviderErrorCode,
  message: string,
): never => {
  throw createProviderError(code, message);
};

const getSelectionKey = (selection: IFirmwareManifestSelection) =>
  [
    selection.channel,
    selection.deviceModel,
    selection.firmwareField,
    selection.firmwareType,
  ].join(':');

const getHeader = (
  headers: IFirmwareManifestTextResponse['headers'],
  name: string,
): string | undefined => {
  const match = Object.entries(headers).find(
    ([headerName]) => headerName.toLowerCase() === name.toLowerCase(),
  )?.[1];
  if (Array.isArray(match)) {
    return match.join(', ');
  }
  return typeof match === 'string' ? match : undefined;
};

const validateTextResponse = ({
  response,
  requestedUrl,
}: {
  response: IFirmwareManifestTextResponse;
  requestedUrl: string;
}): 'retry' | string => {
  if (RETRYABLE_STATUS_CODES.has(response.statusCode)) {
    return 'retry';
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    return fail(
      'REMOTE_MANIFEST_INVALID',
      `Firmware manifest returned HTTP ${response.statusCode}`,
    );
  }
  if (
    response.finalUrl &&
    new URL(response.finalUrl).hostname !== new URL(requestedUrl).hostname
  ) {
    return fail(
      'REMOTE_MANIFEST_INVALID',
      'Firmware manifest redirected across hosts',
    );
  }
  const contentType = getHeader(response.headers, 'content-type');
  if (!contentType || !JSON_CONTENT_TYPE_PATTERN.test(contentType)) {
    return fail(
      'REMOTE_MANIFEST_INVALID',
      'Firmware manifest response is not JSON',
    );
  }
  const bodyBytes = new TextEncoder().encode(response.body).byteLength;
  if (bodyBytes === 0 || bodyBytes > FIRMWARE_MANIFEST_MAX_BODY_BYTES) {
    return fail(
      'REMOTE_MANIFEST_INVALID',
      'Firmware manifest response body size is invalid',
    );
  }
  return response.body;
};

const validateReleaseVersions = (rawSelection: readonly unknown[]) => {
  const versions = new Set<string>();
  rawSelection.forEach((release, index) => {
    if (!isRecord(release) || !Array.isArray(release.version)) {
      return fail(
        'REMOTE_MANIFEST_INVALID',
        `Firmware manifest release ${index} has an invalid schema`,
      );
    }
    const version = release.version;
    if (
      version.length !== 3 ||
      version.some(
        (part) =>
          !Number.isSafeInteger(part) ||
          Number(part) < 0 ||
          Number(part) > 0xff_ff,
      )
    ) {
      return fail(
        'REMOTE_MANIFEST_INVALID',
        `Firmware manifest release ${index} has an invalid version`,
      );
    }
    const versionKey = version.join('.');
    if (versions.has(versionKey)) {
      return fail(
        'REMOTE_MANIFEST_INVALID',
        `Firmware manifest contains duplicate version ${versionKey}`,
      );
    }
    versions.add(versionKey);
  });
};

const parseRemoteSelection = ({
  body,
  selection,
}: {
  body: string;
  selection: IFirmwareManifestSelection;
}): readonly unknown[] => {
  const manifest = parseStrictJson(body, (message) =>
    fail('REMOTE_MANIFEST_INVALID', message),
  );
  if (!isRecord(manifest)) {
    return fail(
      'REMOTE_MANIFEST_INVALID',
      'Firmware manifest root must be an object',
    );
  }
  const device = manifest[selection.deviceModel];
  if (!isRecord(device)) {
    return fail(
      'REMOTE_MANIFEST_INVALID',
      'Firmware manifest device selection is missing',
    );
  }
  const rawSelection = device[selection.firmwareField];
  if (!Array.isArray(rawSelection) || rawSelection.length === 0) {
    return fail(
      'REMOTE_MANIFEST_INVALID',
      'Firmware manifest release selection is empty',
    );
  }
  validateReleaseVersions(rawSelection);
  return rawSelection;
};

const assertBackgroundRuntime = () => {
  if (
    !platformEnv.isJest &&
    (platformEnv.isExtensionUi ||
      (platformEnv.enableNativeBackgroundThread &&
        platformEnv.isNativeMainThread))
  ) {
    throw new OneKeyLocalError(
      'FirmwareManifestProvider must run in the background runtime',
    );
  }
};

export class FirmwareManifestProvider {
  private readonly dependencies: IFirmwareManifestProviderDependencies;

  private readonly inFlightByKey = new Map<
    string,
    Promise<IFirmwareManifestLoadResult>
  >();

  constructor(
    dependencies: Partial<IFirmwareManifestProviderDependencies> = {},
  ) {
    assertBackgroundRuntime();
    this.dependencies = {
      ...DEFAULT_DEPENDENCIES,
      ...dependencies,
    };
  }

  async loadManifest(
    selection: IFirmwareManifestSelection,
  ): Promise<IFirmwareManifestLoadResult> {
    const key = getSelectionKey(selection);
    const current = this.inFlightByKey.get(key);
    if (current) return current;
    const promise = this.loadManifestInternal(selection, key).finally(() => {
      if (this.inFlightByKey.get(key) === promise) {
        this.inFlightByKey.delete(key);
      }
    });
    this.inFlightByKey.set(key, promise);
    return promise;
  }

  private async loadManifestInternal(
    selection: IFirmwareManifestSelection,
    key: string,
  ): Promise<IFirmwareManifestLoadResult> {
    const index = trustedFirmwareCatalogMetadata.snapshotIndex.find(
      (item) => item.key === key,
    );
    if (!index) {
      return fail(
        'CATALOG_ENTRY_MISSING',
        `No bundled firmware catalog entry exists for ${key}`,
      );
    }
    const rollbackState = await this.dependencies.cache.observeCatalogEpoch({
      catalogLineage: index.catalogLineage,
      channel: index.channel,
      catalogEpoch: index.catalogEpoch,
    });
    if (rollbackState === 'catalog_downgrade') {
      return fail(
        'CATALOG_ROLLBACK',
        `Firmware catalog epoch ${index.catalogEpoch} is below the locally accepted epoch`,
      );
    }

    const coreSdk = await this.dependencies.loadCoreSdk();
    const bundled = this.loadAndValidateCatalogSnapshot({
      index,
      coreSdk,
    });
    const remoteBody = await this.fetchRemoteManifest(
      index.sourceManifestUrl,
    ).catch((error: unknown) => {
      if (
        isFirmwareManifestProviderError(error) &&
        error.firmwareManifestCode === 'REMOTE_MANIFEST_INVALID'
      ) {
        return undefined;
      }
      return undefined;
    });

    if (remoteBody) {
      try {
        const rawSelection = parseRemoteSelection({
          body: remoteBody,
          selection,
        });
        const sourceSelectionDigest =
          coreSdk.sha256CanonicalFirmwareJson(rawSelection);
        if (sourceSelectionDigest !== index.sourceSelectionDigest) {
          throw createProviderError(
            'REMOTE_MANIFEST_INVALID',
            'Firmware manifest selection is not admitted by the bundled catalog',
          );
        }
        const result = this.createResult({
          index,
          snapshot: bundled.snapshot,
          source: 'verified-remote',
        });
        await this.dependencies.cache.saveLastGood({
          key,
          catalogLineage: index.catalogLineage,
          channel: index.channel,
          catalogEpoch: index.catalogEpoch,
          projectionDigest: index.projectionDigest,
          sourceSelectionDigest: index.sourceSelectionDigest,
          snapshotDigest: index.snapshotDigest,
          snapshotJson: bundled.snapshotJson,
          acceptedAt: this.dependencies.now(),
        });
        return result;
      } catch (error) {
        if (!isFirmwareManifestProviderError(error)) {
          throw error;
        }
      }
    }

    const cached = await this.loadLastGood({
      index,
      coreSdk,
    });
    if (cached) {
      return this.createResult({
        index,
        snapshot: cached,
        source: 'last-good-cache',
      });
    }
    return this.createResult({
      index,
      snapshot: bundled.snapshot,
      source: 'app-bundled-catalog',
    });
  }

  private loadAndValidateCatalogSnapshot({
    index,
    coreSdk,
    snapshotJson,
  }: {
    index: ITrustedFirmwareCatalogIndexEntry;
    coreSdk: IFirmwareManifestCoreSdk;
    snapshotJson?: string;
  }): {
    snapshot: IFirmwareManifestSnapshot;
    snapshotJson: string;
  } {
    const payload =
      snapshotJson ?? trustedFirmwareCatalogSnapshotJsonByKey[index.key];
    if (!payload) {
      return fail(
        'CATALOG_SNAPSHOT_INVALID',
        `Firmware catalog snapshot ${index.key} is missing`,
      );
    }
    const parsed = parseStrictJson(payload, (message) =>
      fail('CATALOG_SNAPSHOT_INVALID', message),
    );
    let snapshot: IFirmwareManifestSnapshot;
    try {
      snapshot = coreSdk.validateFirmwareManifestSnapshot(parsed, {
        manifestMode: 'external-only',
      });
    } catch {
      return fail(
        'CATALOG_SNAPSHOT_INVALID',
        `Firmware catalog snapshot ${index.key} failed SDK validation`,
      );
    }
    if (
      snapshot.catalogEpoch !== index.catalogEpoch ||
      snapshot.catalogEpoch !== trustedFirmwareCatalogMetadata.catalogEpoch ||
      snapshot.snapshotDigest !== index.snapshotDigest ||
      coreSdk.computeFirmwareManifestSnapshotDigest(snapshot) !==
        index.snapshotDigest
    ) {
      return fail(
        'CATALOG_SNAPSHOT_INVALID',
        `Firmware catalog snapshot ${index.key} failed integrity validation`,
      );
    }
    return {
      snapshot: coreSdk.deepFreezeFirmwareValue(snapshot),
      snapshotJson: payload,
    };
  }

  private async loadLastGood({
    index,
    coreSdk,
  }: {
    index: ITrustedFirmwareCatalogIndexEntry;
    coreSdk: IFirmwareManifestCoreSdk;
  }): Promise<IFirmwareManifestSnapshot | undefined> {
    const record = await this.dependencies.cache.getLastGood(index.key);
    if (!record || !this.isCurrentCacheRecord(record, index)) {
      return undefined;
    }
    try {
      return this.loadAndValidateCatalogSnapshot({
        index,
        coreSdk,
        snapshotJson: record.snapshotJson,
      }).snapshot;
    } catch {
      return undefined;
    }
  }

  private isCurrentCacheRecord(
    record: IFirmwareManifestCacheRecord,
    index: ITrustedFirmwareCatalogIndexEntry,
  ) {
    return (
      record.key === index.key &&
      record.catalogLineage === index.catalogLineage &&
      record.channel === index.channel &&
      record.catalogEpoch === index.catalogEpoch &&
      record.projectionDigest === index.projectionDigest &&
      record.sourceSelectionDigest === index.sourceSelectionDigest &&
      record.snapshotDigest === index.snapshotDigest
    );
  }

  private createResult({
    index,
    snapshot,
    source,
  }: {
    index: ITrustedFirmwareCatalogIndexEntry;
    snapshot: IFirmwareManifestSnapshot;
    source: IFirmwareManifestLoadResult['source'];
  }): IFirmwareManifestLoadResult {
    return Object.freeze({
      key: index.key,
      catalogEpoch: index.catalogEpoch,
      catalogLineage: index.catalogLineage,
      projectionDigest: index.projectionDigest,
      sourceSelectionDigest: index.sourceSelectionDigest,
      snapshot,
      snapshotDigest: index.snapshotDigest,
      source,
    });
  }

  private async fetchRemoteManifest(
    manifestUrl: string,
  ): Promise<string | undefined> {
    const deadlineAt =
      this.dependencies.now() + FIRMWARE_MANIFEST_TOTAL_TIMEOUT_MS;
    const url = new URL(manifestUrl);
    const headers = await this.dependencies.getRequestHeaders();
    let canUseSni = this.dependencies.isSniSupported();
    if (canUseSni) {
      try {
        canUseSni =
          (await this.dependencies.isProxyActiveForUrl(manifestUrl)) !== true;
      } catch {
        canUseSni = false;
      }
    }
    if (canUseSni) {
      let configWithRuntime: IIpTableConfigWithRuntime | null = null;
      try {
        configWithRuntime = await this.dependencies.getIpTableConfig();
      } catch {
        configWithRuntime = null;
      }
      const candidates = configWithRuntime
        ? getOrderedIpTableCandidates({
            hostname: url.hostname,
            configWithRuntime,
            exactHostOnly: true,
            maxCandidates: 3,
          })
        : [];
      for (const ip of candidates) {
        const remainingMs = deadlineAt - this.dependencies.now();
        if (remainingMs <= 0) return undefined;
        try {
          const response = await this.dependencies.sniRequest({
            requestId: `firmware-manifest:${url.hostname}`,
            ip,
            hostname: url.hostname,
            path: `${url.pathname}${url.search}`,
            headers,
            method: 'GET',
            body: null,
            timeout: Math.min(
              remainingMs,
              FIRMWARE_MANIFEST_CANDIDATE_TIMEOUT_MS,
            ),
          });
          if (response) {
            const result = validateTextResponse({
              response: {
                statusCode: response.statusCode,
                headers: {
                  ...response.headers,
                  ...response.multiValueHeaders,
                },
                body: response.body ?? response.data ?? '',
              },
              requestedUrl: manifestUrl,
            });
            if (result !== 'retry') return result;
          }
        } catch (error) {
          if (
            isFirmwareManifestProviderError(error) ||
            isSniFailClosedError(error)
          ) {
            throw error;
          }
        }
      }
    }

    const remainingMs = deadlineAt - this.dependencies.now();
    if (remainingMs <= 0) return undefined;
    try {
      const response = await this.dependencies.domainRequest(manifestUrl, {
        headers,
        timeoutMs: remainingMs,
        maxBodyBytes: FIRMWARE_MANIFEST_MAX_BODY_BYTES,
      });
      const result = validateTextResponse({
        response,
        requestedUrl: manifestUrl,
      });
      return result === 'retry' ? undefined : result;
    } catch (error) {
      if (isFirmwareManifestProviderError(error)) {
        throw error;
      }
      return undefined;
    }
  }
}
