/* cspell:ignore EOCD eocd noto */

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';

import { parseStrictJson } from '@onekeyhq/shared/src/utils/strictJsonUtils';

const CATALOG_SCHEMA_VERSION = 1 as const;
const MANIFEST_SCHEMA_VERSION = 1 as const;
const DEFAULT_MAX_MANIFEST_BYTES = 1024 * 1024;
const DEFAULT_MAX_ARTIFACT_BYTES = 256 * 1024 * 1024;
const DEFAULT_MAX_ARCHIVE_ENTRIES = 4096;
const DEFAULT_MAX_ARCHIVE_ENTRY_BYTES = 128 * 1024 * 1024;
const DEFAULT_MAX_ARCHIVE_TOTAL_BYTES = 512 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 120_000;
const ZIP_EOCD_SIGNATURE = 0x06_05_4b_50;
const ZIP_CENTRAL_SIGNATURE = 0x02_01_4b_50;
const ZIP_LOCAL_SIGNATURE = 0x04_03_4b_50;
const ZIP_UTF8_FLAG = 1 << 11;
const ZIP_ENCRYPTED_FLAG = 1;
const WINDOWS_DRIVE_PREFIX = /^[a-z]:/i;
const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export const TRUSTED_FIRMWARE_CATALOG_LINEAGE =
  'onekey-app-firmware-catalog-v1';

export const DEFAULT_TRUSTED_FIRMWARE_MANIFEST_SOURCES = Object.freeze([
  {
    channel: 'stable',
    manifestUrl: 'https://data.onekey.so/config.json',
  },
  {
    channel: 'pre-release',
    manifestUrl: 'https://data.onekey.so/pre-config.json',
  },
] as const);

const DEVICE_MODELS = Object.freeze([
  'classic',
  'classic1s',
  'classicpure',
  'mini',
  'touch',
  'pro',
  'pro2',
] as const);

const FIRMWARE_FIELDS = Object.freeze([
  'firmware',
  'firmware-v1',
  'firmware-v2',
  'firmware-v8',
  'firmware-btc-v8',
  'ble',
] as const);

const PRO2_COMPONENT_TARGETS = Object.freeze({
  bootloader: 'bootloader',
  applicationP1: 'p1',
  applicationP2: 'p2',
  coprocessor: 'coprocessor',
  se01: 'se01',
  se02: 'se02',
  se03: 'se03',
  se04: 'se04',
} as const);

const PRO2_RESOURCE_BUNDLE_PATHS = Object.freeze({
  images: 'vol0:/bundles/images/images.okpkg',
  animation: 'vol0:/bundles/images/animation.okpkg',
  wallpaper: 'vol0:/bundles/images/wallpaper.okpkg',
  translations: 'vol0:/bundles/translations/translations.okpkg',
  fonts_roobert: 'vol0:/bundles/font/roobert.okpkg',
  fonts_noto: 'vol0:/bundles/font/noto.okpkg',
} as const);

type IFirmwareChannel = 'stable' | 'pre-release';
type IFirmwareDeviceModel = (typeof DEVICE_MODELS)[number];
type IFirmwareField = (typeof FIRMWARE_FIELDS)[number];
type IFirmwareType = 'universal' | 'bitcoinonly';
type IFirmwareTarget =
  | 'firmware'
  | 'ble'
  | 'bootloader'
  | 'resource'
  | 'p1'
  | 'p2'
  | 'coprocessor'
  | 'se01'
  | 'se02'
  | 'se03'
  | 'se04';
type IFirmwareArtifactRole =
  | 'firmware'
  | 'ble'
  | 'bootloader'
  | 'resource-bundle'
  | 'component'
  | 'archive-entry';
type IFirmwareJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly IFirmwareJsonValue[]
  | { readonly [key: string]: IFirmwareJsonValue };

export type ITrustedFirmwareManifestSource = {
  channel: IFirmwareChannel;
  manifestUrl: string;
};

type IFirmwareArtifactRequirement = {
  artifactId: string;
  role: IFirmwareArtifactRole;
  sourceUrls: readonly string[];
  expectedSize: number;
  expectedSha256: string;
  integrity: 'catalog-trusted';
  container:
    | { kind: 'raw' }
    | { kind: 'archive'; format: 'zip' }
    | {
        kind: 'archive-entry';
        parentArtifactId: string;
        entryId: string;
      };
  target: IFirmwareTarget;
  targetVersion?: string;
  devicePathRule:
    | { kind: 'none' }
    | { kind: 'sdk-generated'; logicalName: string };
  dependsOn: readonly string[];
};

type IFirmwareManifestRelease = {
  releaseId: string;
  deviceModel: string;
  firmwareType: string;
  channel: IFirmwareChannel;
  version: string;
  required: boolean;
  artifactIds: readonly string[];
};

type IFirmwareManifestSnapshot = {
  schemaVersion: typeof MANIFEST_SCHEMA_VERSION;
  snapshotDigest: string;
  catalogEpoch: number;
  source: 'app-bundled-catalog';
  remoteConfigProjection: IFirmwareJsonValue;
  artifactCatalog: readonly IFirmwareArtifactRequirement[];
  releases: readonly IFirmwareManifestRelease[];
};

type IArtifactCandidate = {
  candidateId: string;
  sourceUrl: string;
  role: Exclude<IFirmwareArtifactRole, 'archive-entry'>;
  target: IFirmwareTarget;
  targetVersion?: string;
  container: 'raw' | 'archive';
  logicalName?: string;
  usage: 'release' | 'standalone-full-resource';
};

type IProjectedRelease = {
  required: boolean;
  version: string;
  artifacts: readonly IArtifactCandidate[];
  installOrder?: readonly string[];
};

type IManifestSelection = {
  channel: IFirmwareChannel;
  sourceManifestUrl: string;
  sourceSelectionDigest: string;
  deviceModel: IFirmwareDeviceModel;
  firmwareField: IFirmwareField;
  firmwareType: IFirmwareType;
  releases: readonly IProjectedRelease[];
};

type IArchiveEntryInspection = {
  entryId: string;
  logicalName: string;
  expectedSize: number;
  expectedSha256: string;
};

type IArtifactInspection = {
  expectedSize: number;
  expectedSha256: string;
  entries: readonly IArchiveEntryInspection[];
};

export type ITrustedFirmwareCatalogSnapshot = {
  key: string;
  catalogEpoch: number;
  catalogLineage: string;
  channel: IFirmwareChannel;
  deviceModel: IFirmwareDeviceModel;
  firmwareField: IFirmwareField;
  firmwareType: IFirmwareType;
  sourceManifestUrl: string;
  sourceSelectionDigest: string;
  projectionDigest: string;
  snapshot: IFirmwareManifestSnapshot;
};

export type ITrustedFirmwareCatalog = {
  schemaVersion: typeof CATALOG_SCHEMA_VERSION;
  catalogLineage: string;
  catalogEpoch: number;
  generatedAt: string;
  sources: readonly ITrustedFirmwareManifestSource[];
  snapshots: readonly ITrustedFirmwareCatalogSnapshot[];
  catalogDigest: string;
};

export type ITrustedFirmwareCatalogFetchResponse = {
  status: number;
  headers: Readonly<Record<string, string | undefined>>;
  body: Uint8Array;
  finalUrl?: string;
};

export type ITrustedFirmwareCatalogFetcher = (
  url: string,
  options: {
    accept: 'application/json' | 'application/octet-stream';
    maxBytes: number;
    timeoutMs: number;
  },
) => Promise<ITrustedFirmwareCatalogFetchResponse>;

export type IGenerateTrustedFirmwareCatalogOptions = {
  catalogEpoch: number;
  generatedAt: string;
  sources?: readonly ITrustedFirmwareManifestSource[];
  fetcher?: ITrustedFirmwareCatalogFetcher;
  artifactConcurrency?: number;
  timeoutMs?: number;
  maxManifestBytes?: number;
  maxArtifactBytes?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const fail = (message: string): never => {
  throw new Error(`Trusted firmware catalog: ${message}`);
};

const assertSafePositiveInteger = (value: number, label: string) => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail(`${label} must be a positive safe integer`);
  }
  return value;
};

const assertHttpsUrl = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    return fail(`${label} must be a non-empty HTTPS URL`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return fail(`${label} is not a valid URL`);
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    (parsed.port && parsed.port !== '443') ||
    parsed.hostname !== parsed.hostname.toLowerCase() ||
    parsed.hostname.endsWith('.')
  ) {
    return fail(`${label} is not an allowed HTTPS URL`);
  }
  return parsed.toString();
};

const sanitizeId = (value: string) =>
  value.replace(/[^a-z0-9._-]/gi, '-').toLowerCase();

const parseVersion = (value: unknown, label: string): string => {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some(
      (part) =>
        !Number.isSafeInteger(part) ||
        Number(part) < 0 ||
        Number(part) > 0xff_ff,
    )
  ) {
    return fail(`${label} must be a three-part numeric version`);
  }
  return value.join('.');
};

const getFirmwareType = (firmwareField: IFirmwareField): IFirmwareType =>
  firmwareField === 'firmware-btc-v8' ? 'bitcoinonly' : 'universal';

const getPrimaryUrl = (
  release: Record<string, unknown>,
  firmwareField: IFirmwareField,
  label: string,
) =>
  assertHttpsUrl(
    firmwareField === 'ble' ? (release.webUpdate ?? release.url) : release.url,
    `${label}.${firmwareField === 'ble' ? 'webUpdate' : 'url'}`,
  );

const getOptionalUrl = (
  release: Record<string, unknown>,
  key: string,
  label: string,
) => {
  const value = release[key];
  if (value === undefined || value === '') {
    return undefined;
  }
  return assertHttpsUrl(value, `${label}.${key}`);
};

const encodeUnicodeEscape = (codeUnit: number) =>
  `\\u${codeUnit.toString(16).padStart(4, '0')}`;

const encodeCanonicalString = (value: string) => {
  let encoded = '"';
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit === 0x22) encoded += '\\"';
    else if (codeUnit === 0x5c) encoded += '\\\\';
    else if (codeUnit === 0x08) encoded += '\\b';
    else if (codeUnit === 0x09) encoded += '\\t';
    else if (codeUnit === 0x0a) encoded += '\\n';
    else if (codeUnit === 0x0c) encoded += '\\f';
    else if (codeUnit === 0x0d) encoded += '\\r';
    else if (codeUnit <= 0x1f || codeUnit === 0x20_28 || codeUnit === 0x20_29) {
      encoded += encodeUnicodeEscape(codeUnit);
    } else if (codeUnit >= 0xd8_00 && codeUnit <= 0xdb_ff) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (nextCodeUnit >= 0xdc_00 && nextCodeUnit <= 0xdf_ff) {
        encoded += value[index];
        encoded += value[index + 1];
        index += 1;
      } else {
        encoded += encodeUnicodeEscape(codeUnit);
      }
    } else if (codeUnit >= 0xdc_00 && codeUnit <= 0xdf_ff) {
      encoded += encodeUnicodeEscape(codeUnit);
    } else {
      encoded += value[index];
    }
  }
  return `${encoded}"`;
};

const canonicalize = (value: unknown, seen: Set<object>): string => {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return encodeCanonicalString(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return fail('canonical JSON accepts only finite numbers');
    }
    return Object.is(value, -0) ? '0' : String(value);
  }
  if (typeof value !== 'object') {
    return fail(`canonical JSON does not support ${typeof value}`);
  }
  if (seen.has(value)) return fail('canonical JSON does not support cycles');
  seen.add(value);
  let encoded: string;
  if (Array.isArray(value)) {
    encoded = `[${value.map((item) => canonicalize(item, seen)).join(',')}]`;
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return fail('canonical JSON accepts only plain objects');
    }
    encoded = `{${Object.keys(value)
      .toSorted()
      .map(
        (key) =>
          `${encodeCanonicalString(key)}:${canonicalize(
            (value as Record<string, unknown>)[key],
            seen,
          )}`,
      )
      .join(',')}}`;
  }
  seen.delete(value);
  return encoded;
};

export const canonicalizeTrustedFirmwareJson = (value: unknown): string =>
  canonicalize(value, new Set());

export const sha256TrustedFirmwareJson = (value: unknown): string =>
  createHash('sha256')
    .update(canonicalizeTrustedFirmwareJson(value), 'utf8')
    .digest('hex');

const sha256Bytes = (value: Uint8Array) =>
  createHash('sha256').update(value).digest('hex');

export const parseStrictFirmwareJson = (value: string): unknown =>
  parseStrictJson(value, fail);

const validateArchiveEntryId = (value: string): string => {
  if (
    value.length === 0 ||
    value.length > 1024 ||
    value !== value.normalize('NFC') ||
    Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
    }) ||
    value.startsWith('/') ||
    value.startsWith('\\') ||
    WINDOWS_DRIVE_PREFIX.test(value) ||
    value.includes('\\') ||
    value.includes(':')
  ) {
    return fail(`archive entry ${value} has an unsafe path`);
  }
  const components = value.split('/');
  components.forEach((component) => {
    if (
      component.length === 0 ||
      component === '.' ||
      component === '..' ||
      component.endsWith('.') ||
      component.endsWith(' ') ||
      WINDOWS_RESERVED_NAME.test(component)
    ) {
      fail(`archive entry ${value} has an unsafe path component`);
    }
  });
  return value;
};

const crc32Table = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) !== 0 ? 0xed_b8_83_20 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

const crc32 = (bytes: Uint8Array) => {
  let value = 0xff_ff_ff_ff;
  bytes.forEach((byte) => {
    value = crc32Table[(value ^ byte) & 0xff] ^ (value >>> 8);
  });
  return (value ^ 0xff_ff_ff_ff) >>> 0;
};

export const inspectFirmwareZip = (
  bytes: Uint8Array,
): readonly IArchiveEntryInspection[] => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const searchStart = Math.max(0, bytes.byteLength - 65_557);
  let eocdOffset = -1;
  for (let offset = bytes.byteLength - 22; offset >= searchStart; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_EOCD_SIGNATURE) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) return fail('ZIP has no end-of-central-directory record');
  const diskNumber = view.getUint16(eocdOffset + 4, true);
  const centralDisk = view.getUint16(eocdOffset + 6, true);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralSize = view.getUint32(eocdOffset + 12, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);
  if (
    diskNumber !== 0 ||
    centralDisk !== 0 ||
    entryCount === 0xff_ff ||
    centralSize === 0xff_ff_ff_ff ||
    centralOffset === 0xff_ff_ff_ff
  ) {
    return fail('ZIP multi-disk and ZIP64 archives are not supported');
  }
  if (
    entryCount > DEFAULT_MAX_ARCHIVE_ENTRIES ||
    centralOffset + centralSize > eocdOffset
  ) {
    return fail('ZIP central directory is out of bounds');
  }

  const decoder = new TextDecoder('utf-8', { fatal: true });
  const entries: IArchiveEntryInspection[] = [];
  const logicalNames = new Set<string>();
  const entryIds = new Set<string>();
  let totalBytes = 0;
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.byteLength) return fail('ZIP entry is truncated');
    if (view.getUint32(offset, true) !== ZIP_CENTRAL_SIGNATURE) {
      return fail('ZIP central directory signature is invalid');
    }
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const expectedCrc32 = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const externalAttributes = view.getUint32(offset + 38, true);
    const localOffset = view.getUint32(offset + 42, true);
    const nextOffset =
      offset + 46 + fileNameLength + extraLength + commentLength;
    if (nextOffset > bytes.byteLength) return fail('ZIP filename is truncated');
    if ((flags & ZIP_ENCRYPTED_FLAG) !== 0) {
      return fail('ZIP contains an encrypted entry');
    }
    if (method !== 0 && method !== 8) {
      return fail(`ZIP uses unsupported compression method ${method}`);
    }
    if ((externalAttributes >>> 16) >> 12 === 0x0a) {
      return fail('ZIP contains a symlink');
    }
    const fileNameBytes = bytes.subarray(
      offset + 46,
      offset + 46 + fileNameLength,
    );
    let entryId: string;
    try {
      entryId =
        (flags & ZIP_UTF8_FLAG) !== 0
          ? decoder.decode(fileNameBytes)
          : Buffer.from(fileNameBytes).toString('utf8');
    } catch {
      return fail('ZIP filename is not valid UTF-8');
    }
    offset = nextOffset;
    if (!entryId.endsWith('/') && !entryId.includes('__MACOSX')) {
      entryId = validateArchiveEntryId(entryId);
      const entryKey = entryId.normalize('NFC').toLowerCase();
      if (entryIds.has(entryKey)) {
        return fail(`ZIP has duplicate entry ${entryId}`);
      }
      entryIds.add(entryKey);
      const logicalName = basename(entryId);
      const logicalKey = logicalName.normalize('NFC').toLowerCase();
      if (logicalNames.has(logicalKey)) {
        return fail(`ZIP has colliding logical name ${logicalName}`);
      }
      logicalNames.add(logicalKey);
      if (
        uncompressedSize <= 0 ||
        uncompressedSize > DEFAULT_MAX_ARCHIVE_ENTRY_BYTES ||
        localOffset + 30 > bytes.byteLength ||
        view.getUint32(localOffset, true) !== ZIP_LOCAL_SIGNATURE
      ) {
        return fail(`ZIP entry ${entryId} has invalid metadata`);
      }
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      if (dataOffset + compressedSize > bytes.byteLength) {
        return fail(`ZIP entry ${entryId} data is truncated`);
      }
      const compressed = bytes.subarray(
        dataOffset,
        dataOffset + compressedSize,
      );
      const decoded =
        method === 0
          ? Buffer.from(compressed)
          : inflateRawSync(compressed, {
              maxOutputLength: DEFAULT_MAX_ARCHIVE_ENTRY_BYTES,
            });
      if (
        decoded.byteLength !== uncompressedSize ||
        crc32(decoded) !== expectedCrc32
      ) {
        return fail(`ZIP entry ${entryId} failed size or CRC validation`);
      }
      totalBytes += decoded.byteLength;
      if (totalBytes > DEFAULT_MAX_ARCHIVE_TOTAL_BYTES) {
        return fail('ZIP decoded size exceeds the catalog limit');
      }
      entries.push({
        entryId,
        logicalName,
        expectedSize: decoded.byteLength,
        expectedSha256: sha256Bytes(decoded),
      });
    }
  }
  if (offset !== centralOffset + centralSize) {
    return fail('ZIP central directory length does not match');
  }
  return entries;
};

const createDefaultFetcher = (): ITrustedFirmwareCatalogFetcher => {
  const fetchOnce = async (
    inputUrl: string,
    options: Parameters<ITrustedFirmwareCatalogFetcher>[1],
    redirectCount = 0,
  ): Promise<ITrustedFirmwareCatalogFetchResponse> => {
    const response = await fetch(inputUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Accept: options.accept,
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirectCount >= 3) {
        return fail(`redirect policy rejected ${inputUrl}`);
      }
      const nextUrl = new URL(location, inputUrl);
      const currentUrl = new URL(inputUrl);
      if (
        nextUrl.protocol !== 'https:' ||
        nextUrl.hostname !== currentUrl.hostname ||
        nextUrl.port !== currentUrl.port
      ) {
        return fail(`cross-host redirect rejected for ${inputUrl}`);
      }
      return fetchOnce(nextUrl.toString(), options, redirectCount + 1);
    }
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength > options.maxBytes) {
      return fail(`${inputUrl} exceeds ${options.maxBytes} bytes`);
    }
    const headers: Record<string, string | undefined> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    return {
      status: response.status,
      headers,
      body,
      finalUrl: response.url || inputUrl,
    };
  };
  return fetchOnce;
};

const parseManifestSelections = (
  value: unknown,
  source: ITrustedFirmwareManifestSource,
): readonly IManifestSelection[] => {
  if (!isRecord(value)) return fail(`${source.manifestUrl} must be an object`);
  const selections: IManifestSelection[] = [];
  DEVICE_MODELS.forEach((deviceModel) => {
    const device = value[deviceModel];
    if (device === undefined) return;
    const deviceRecord = isRecord(device)
      ? device
      : fail(`${source.manifestUrl}.${deviceModel} must be an object`);
    FIRMWARE_FIELDS.forEach((firmwareField) => {
      const rawReleases = deviceRecord[firmwareField];
      if (rawReleases === undefined) return;
      const releaseArray = Array.isArray(rawReleases)
        ? rawReleases
        : fail(
            `${source.manifestUrl}.${deviceModel}.${firmwareField} must be an array`,
          );
      if (releaseArray.length === 0) return;
      const releaseVersions = new Set<string>();
      const releases = releaseArray.map((rawRelease, releaseIndex) => {
        const label = `${deviceModel}.${firmwareField}[${releaseIndex}]`;
        if (!isRecord(rawRelease)) return fail(`${label} must be an object`);
        if (typeof rawRelease.required !== 'boolean') {
          return fail(`${label}.required must be a boolean`);
        }
        const version = parseVersion(rawRelease.version, `${label}.version`);
        if (releaseVersions.has(version)) {
          return fail(`${label} duplicates release version ${version}`);
        }
        releaseVersions.add(version);
        const primaryUrl = getPrimaryUrl(rawRelease, firmwareField, label);
        const candidates: IArtifactCandidate[] = [];
        const addCandidate = (
          suffix: string,
          candidate: Omit<IArtifactCandidate, 'candidateId'>,
        ) => {
          candidates.push({
            candidateId: sanitizeId(
              `${source.channel}-${deviceModel}-${firmwareField}-${version}-${suffix}`,
            ),
            ...candidate,
          });
        };
        if (deviceModel === 'pro2' && firmwareField === 'firmware-v1') {
          if (
            rawRelease.upgradeType !== 'payload-package-set' ||
            !isRecord(rawRelease.components)
          ) {
            return fail(`${label} must define payload-package-set components`);
          }
          const installOrder = rawRelease.installOrder;
          if (
            !Array.isArray(installOrder) ||
            installOrder.length !==
              Object.keys(PRO2_COMPONENT_TARGETS).length ||
            installOrder.some((key) => typeof key !== 'string') ||
            new Set(installOrder).size !== installOrder.length ||
            installOrder.some((key) => !(key in PRO2_COMPONENT_TARGETS))
          ) {
            return fail(`${label}.installOrder is incomplete or invalid`);
          }
          Object.entries(PRO2_COMPONENT_TARGETS).forEach(
            ([componentKey, target]) => {
              const component = (
                rawRelease.components as Record<string, unknown>
              )[componentKey];
              const componentRecord = isRecord(component)
                ? component
                : fail(`${label}.components.${componentKey} is missing`);
              const declaredTarget = componentRecord.target;
              const expectedTarget = {
                bootloader: 'BOOTLOADER',
                applicationP1: 'APPLICATION_P1',
                applicationP2: 'APPLICATION_P2',
                coprocessor: 'COPROCESSOR',
                se01: 'SE01',
                se02: 'SE02',
                se03: 'SE03',
                se04: 'SE04',
              }[componentKey];
              if (declaredTarget !== expectedTarget) {
                fail(
                  `${label}.components.${componentKey} has unknown target ${String(
                    declaredTarget,
                  )}`,
                );
              }
              addCandidate(componentKey, {
                sourceUrl: assertHttpsUrl(
                  componentRecord.url,
                  `${label}.components.${componentKey}.url`,
                ),
                role: target === 'bootloader' ? 'bootloader' : 'component',
                target,
                targetVersion: version,
                container: 'raw',
                usage: 'release',
              });
            },
          );
          if (!Array.isArray(rawRelease.resourceBundles)) {
            return fail(`${label}.resourceBundles is required`);
          }
          const bundleNames = new Set<string>();
          rawRelease.resourceBundles.forEach((rawBundle, bundleIndex) => {
            if (!isRecord(rawBundle)) {
              fail(
                `${label}.resourceBundles[${bundleIndex}] must be an object`,
              );
            }
            const name = rawBundle.name;
            if (
              typeof name !== 'string' ||
              !(name in PRO2_RESOURCE_BUNDLE_PATHS) ||
              bundleNames.has(name)
            ) {
              fail(`${label}.resourceBundles[${bundleIndex}] has invalid name`);
            }
            bundleNames.add(name);
            if (
              rawBundle.devicePath !==
              PRO2_RESOURCE_BUNDLE_PATHS[
                name as keyof typeof PRO2_RESOURCE_BUNDLE_PATHS
              ]
            ) {
              fail(
                `${label}.resourceBundles[${bundleIndex}] has invalid devicePath`,
              );
            }
            addCandidate(`resource-${name}`, {
              sourceUrl: assertHttpsUrl(
                rawBundle.url,
                `${label}.resourceBundles[${bundleIndex}].url`,
              ),
              role: 'resource-bundle',
              target: 'resource',
              container: 'raw',
              logicalName: name,
              usage: 'release',
            });
          });
          if (
            bundleNames.size !== Object.keys(PRO2_RESOURCE_BUNDLE_PATHS).length
          ) {
            return fail(`${label}.resourceBundles is incomplete`);
          }
        } else {
          addCandidate(firmwareField === 'ble' ? 'ble' : 'firmware', {
            sourceUrl: primaryUrl,
            role: firmwareField === 'ble' ? 'ble' : 'firmware',
            target: firmwareField === 'ble' ? 'ble' : 'firmware',
            targetVersion: version,
            container: 'raw',
            usage: 'release',
          });
          const bootloaderUrl = getOptionalUrl(
            rawRelease,
            'bootloaderResource',
            label,
          );
          if (bootloaderUrl) {
            let targetVersion: string | undefined;
            if (rawRelease.displayBootloaderVersion !== undefined) {
              targetVersion = parseVersion(
                rawRelease.displayBootloaderVersion,
                `${label}.displayBootloaderVersion`,
              );
            } else if (
              Array.isArray(rawRelease.bootloaderVersion) &&
              rawRelease.bootloaderVersion.length > 0
            ) {
              targetVersion = parseVersion(
                rawRelease.bootloaderVersion,
                `${label}.bootloaderVersion`,
              );
            }
            addCandidate('bootloader', {
              sourceUrl: bootloaderUrl,
              role: 'bootloader',
              target: 'bootloader',
              targetVersion,
              container: 'raw',
              usage: 'release',
            });
          }
          const resourceUrl = getOptionalUrl(rawRelease, 'resource', label);
          if (resourceUrl) {
            addCandidate('resource', {
              sourceUrl: resourceUrl,
              role: 'resource-bundle',
              target: 'resource',
              container: 'archive',
              usage: 'release',
            });
          }
          const fullResourceUrl = getOptionalUrl(
            rawRelease,
            'fullResource',
            label,
          );
          if (fullResourceUrl) {
            addCandidate('full-resource', {
              sourceUrl: fullResourceUrl,
              role: 'resource-bundle',
              target: 'resource',
              container: 'archive',
              usage: 'standalone-full-resource',
            });
          }
        }
        return {
          required: rawRelease.required,
          version,
          artifacts: candidates,
          ...(Array.isArray(rawRelease.installOrder)
            ? {
                installOrder: rawRelease.installOrder.map((key) => String(key)),
              }
            : {}),
        };
      });
      selections.push({
        channel: source.channel,
        sourceManifestUrl: source.manifestUrl,
        sourceSelectionDigest: sha256TrustedFirmwareJson(rawReleases),
        deviceModel,
        firmwareField,
        firmwareType: getFirmwareType(firmwareField),
        releases,
      });
    });
  });
  return selections;
};

const inspectCandidate = async (
  candidate: IArtifactCandidate,
  fetcher: ITrustedFirmwareCatalogFetcher,
  timeoutMs: number,
  maxArtifactBytes: number,
): Promise<IArtifactInspection> => {
  const response = await fetcher(candidate.sourceUrl, {
    accept: 'application/octet-stream',
    maxBytes: maxArtifactBytes,
    timeoutMs,
  });
  if (response.status < 200 || response.status >= 300) {
    return fail(`${candidate.sourceUrl} returned HTTP ${response.status}`);
  }
  if (response.body.byteLength === 0) {
    return fail(`${candidate.sourceUrl} returned an empty artifact`);
  }
  if (
    response.finalUrl &&
    new URL(response.finalUrl).hostname !==
      new URL(candidate.sourceUrl).hostname
  ) {
    return fail(`${candidate.sourceUrl} redirected across hosts`);
  }
  return {
    expectedSize: response.body.byteLength,
    expectedSha256: sha256Bytes(response.body),
    entries:
      candidate.container === 'archive'
        ? inspectFirmwareZip(response.body)
        : [],
  };
};

const createInspectionLoader = ({
  fetcher,
  concurrency,
  timeoutMs,
  maxArtifactBytes,
}: {
  fetcher: ITrustedFirmwareCatalogFetcher;
  concurrency: number;
  timeoutMs: number;
  maxArtifactBytes: number;
}) => {
  const cache = new Map<string, Promise<IArtifactInspection>>();
  const queue: Array<() => void> = [];
  let activeCount = 0;
  const runNext = () => {
    while (activeCount < concurrency && queue.length > 0) {
      activeCount += 1;
      queue.shift()?.();
    }
  };
  const load = (candidate: IArtifactCandidate) => {
    const key = `${candidate.container}\0${candidate.sourceUrl}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const promise = new Promise<IArtifactInspection>(
      (resolvePromise, reject) => {
        queue.push(() => {
          void inspectCandidate(candidate, fetcher, timeoutMs, maxArtifactBytes)
            .then(resolvePromise, reject)
            .finally(() => {
              activeCount -= 1;
              runNext();
            });
        });
        runNext();
      },
    );
    cache.set(key, promise);
    return promise;
  };
  return load;
};

const buildSnapshot = async ({
  selection,
  catalogEpoch,
  catalogLineage,
  inspect,
}: {
  selection: IManifestSelection;
  catalogEpoch: number;
  catalogLineage: string;
  inspect: (candidate: IArtifactCandidate) => Promise<IArtifactInspection>;
}): Promise<ITrustedFirmwareCatalogSnapshot> => {
  const projection = {
    schemaVersion: 1,
    channel: selection.channel,
    sourceManifestUrl: selection.sourceManifestUrl,
    selection: {
      deviceModel: selection.deviceModel,
      firmwareField: selection.firmwareField,
      firmwareType: selection.firmwareType,
    },
    releases: selection.releases.map((release) => ({
      required: release.required,
      version: release.version,
      artifacts: release.artifacts.map((artifact) => ({
        candidateId: artifact.candidateId,
        sourceUrl: artifact.sourceUrl,
        role: artifact.role,
        target: artifact.target,
        targetVersion: artifact.targetVersion ?? null,
        container: artifact.container,
        logicalName: artifact.logicalName ?? null,
        usage: artifact.usage,
      })),
      installOrder: release.installOrder ?? [],
    })),
  } as const;
  const projectionDigest = sha256TrustedFirmwareJson(projection);
  const artifactCatalog: IFirmwareArtifactRequirement[] = [];
  const releases: IFirmwareManifestRelease[] = [];
  for (const release of selection.releases) {
    const requirements: IFirmwareArtifactRequirement[] = [];
    for (const candidate of release.artifacts) {
      const inspection = await inspect(candidate);
      const parentArtifactId = `${candidate.candidateId}-${inspection.expectedSha256.slice(
        0,
        16,
      )}`;
      const parent: IFirmwareArtifactRequirement = {
        artifactId: parentArtifactId,
        role: candidate.role,
        sourceUrls: [candidate.sourceUrl],
        expectedSize: inspection.expectedSize,
        expectedSha256: inspection.expectedSha256,
        integrity: 'catalog-trusted',
        container:
          candidate.container === 'archive'
            ? { kind: 'archive', format: 'zip' }
            : { kind: 'raw' },
        target: candidate.target,
        ...(candidate.targetVersion
          ? { targetVersion: candidate.targetVersion }
          : {}),
        devicePathRule: candidate.logicalName
          ? { kind: 'sdk-generated', logicalName: candidate.logicalName }
          : { kind: 'none' },
        dependsOn: [],
      };
      artifactCatalog.push(parent);
      requirements.push(parent);
      inspection.entries.forEach((entry) => {
        const entryArtifact: IFirmwareArtifactRequirement = {
          artifactId: sanitizeId(
            `${parentArtifactId}-entry-${entry.logicalName}-${entry.expectedSha256.slice(
              0,
              16,
            )}`,
          ),
          role: 'archive-entry',
          sourceUrls: [candidate.sourceUrl],
          expectedSize: entry.expectedSize,
          expectedSha256: entry.expectedSha256,
          integrity: 'catalog-trusted',
          container: {
            kind: 'archive-entry',
            parentArtifactId,
            entryId: entry.entryId,
          },
          target: 'resource',
          devicePathRule: {
            kind: 'sdk-generated',
            logicalName: entry.logicalName,
          },
          dependsOn: [parentArtifactId],
        };
        artifactCatalog.push(entryArtifact);
        requirements.push(entryArtifact);
      });
    }
    const releaseId = sanitizeId(
      `${selection.deviceModel}-${selection.firmwareType}-${selection.channel}-${release.version}-${selection.firmwareField}`,
    );
    const releaseRequirements = requirements.filter(
      (artifact) =>
        !selection.releases
          .find(
            (candidateRelease) => candidateRelease.version === release.version,
          )
          ?.artifacts.some(
            (candidate) =>
              candidate.usage === 'standalone-full-resource' &&
              artifact.sourceUrls[0] === candidate.sourceUrl,
          ),
    );
    releases.push({
      releaseId,
      deviceModel: selection.deviceModel,
      firmwareType: selection.firmwareType,
      channel: selection.channel,
      version: release.version,
      required: release.required,
      artifactIds: releaseRequirements
        .filter((artifact) => artifact.container.kind !== 'archive')
        .map((artifact) => artifact.artifactId),
    });
  }

  const digestInput = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    catalogEpoch,
    source: 'app-bundled-catalog',
    remoteConfigProjection: projection,
    artifactCatalog,
    releases,
  } as const;
  const snapshot: IFirmwareManifestSnapshot = {
    ...digestInput,
    snapshotDigest: sha256TrustedFirmwareJson(digestInput),
  };
  const key = [
    selection.channel,
    selection.deviceModel,
    selection.firmwareField,
    selection.firmwareType,
  ].join(':');
  return {
    key,
    catalogEpoch,
    catalogLineage,
    channel: selection.channel,
    deviceModel: selection.deviceModel,
    firmwareField: selection.firmwareField,
    firmwareType: selection.firmwareType,
    sourceManifestUrl: selection.sourceManifestUrl,
    sourceSelectionDigest: selection.sourceSelectionDigest,
    projectionDigest,
    snapshot,
  };
};

export const generateTrustedFirmwareCatalog = async (
  options: IGenerateTrustedFirmwareCatalogOptions,
): Promise<ITrustedFirmwareCatalog> => {
  const catalogEpoch = assertSafePositiveInteger(
    options.catalogEpoch,
    'catalogEpoch',
  );
  const generatedAt = new Date(options.generatedAt);
  if (
    Number.isNaN(generatedAt.getTime()) ||
    generatedAt.toISOString() !== options.generatedAt
  ) {
    return fail('generatedAt must be an exact ISO timestamp');
  }
  const sources = options.sources ?? DEFAULT_TRUSTED_FIRMWARE_MANIFEST_SOURCES;
  if (
    sources.length === 0 ||
    new Set(sources.map((source) => source.channel)).size !== sources.length
  ) {
    return fail('sources must contain unique channels');
  }
  sources.forEach((source, index) => {
    assertHttpsUrl(source.manifestUrl, `sources[${index}].manifestUrl`);
  });
  const fetcher = options.fetcher ?? createDefaultFetcher();
  const timeoutMs = assertSafePositiveInteger(
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    'timeoutMs',
  );
  const maxManifestBytes = assertSafePositiveInteger(
    options.maxManifestBytes ?? DEFAULT_MAX_MANIFEST_BYTES,
    'maxManifestBytes',
  );
  const maxArtifactBytes = assertSafePositiveInteger(
    options.maxArtifactBytes ?? DEFAULT_MAX_ARTIFACT_BYTES,
    'maxArtifactBytes',
  );
  const concurrency = assertSafePositiveInteger(
    options.artifactConcurrency ?? 2,
    'artifactConcurrency',
  );
  const selections: IManifestSelection[] = [];
  for (const source of sources) {
    const response = await fetcher(source.manifestUrl, {
      accept: 'application/json',
      maxBytes: maxManifestBytes,
      timeoutMs,
    });
    if (response.status < 200 || response.status >= 300) {
      return fail(`${source.manifestUrl} returned HTTP ${response.status}`);
    }
    const contentType = response.headers['content-type']?.toLowerCase() ?? '';
    if (!/^application\/(?:[^;]+\+)?json(?:;|$)/.test(contentType)) {
      return fail(`${source.manifestUrl} did not return JSON`);
    }
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(response.body);
    selections.push(
      ...parseManifestSelections(parseStrictFirmwareJson(raw), source),
    );
  }
  const inspect = createInspectionLoader({
    fetcher,
    concurrency,
    timeoutMs,
    maxArtifactBytes,
  });
  const generated: ITrustedFirmwareCatalogSnapshot[] = [];
  for (const selection of selections) {
    generated.push(
      await buildSnapshot({
        selection,
        catalogEpoch,
        catalogLineage: TRUSTED_FIRMWARE_CATALOG_LINEAGE,
        inspect,
      }),
    );
  }
  const withoutDigest = {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    catalogLineage: TRUSTED_FIRMWARE_CATALOG_LINEAGE,
    catalogEpoch,
    generatedAt: generatedAt.toISOString(),
    sources: sources.map((source) => ({ ...source })),
    snapshots: generated,
  } as const;
  return {
    ...withoutDigest,
    catalogDigest: sha256TrustedFirmwareJson(withoutDigest),
  };
};

export const renderTrustedFirmwareCatalogModule = (
  catalog: ITrustedFirmwareCatalog,
) => {
  const snapshotIndex = catalog.snapshots.map(({ snapshot, ...entry }) => ({
    ...entry,
    snapshotDigest: snapshot.snapshotDigest,
  }));
  const snapshotJsonByKey = Object.fromEntries(
    catalog.snapshots.map(({ key, snapshot }) => [
      key,
      JSON.stringify(snapshot),
    ]),
  );
  const metadata = {
    schemaVersion: catalog.schemaVersion,
    catalogLineage: catalog.catalogLineage,
    catalogEpoch: catalog.catalogEpoch,
    generatedAt: catalog.generatedAt,
    sources: catalog.sources,
    snapshotIndex,
    catalogDigest: catalog.catalogDigest,
  };
  return `/* eslint-disable */
// Generated by development/scripts/firmware/generateTrustedFirmwareCatalog.ts.
// Review the complete diff. Do not edit this file manually.

export const trustedFirmwareCatalogMetadata = ${JSON.stringify(metadata, null, 2)} as const;

export const trustedFirmwareCatalogSnapshotJsonByKey: Readonly<Record<string, string>> = ${JSON.stringify(snapshotJsonByKey, null, 2)};
`;
};

type ICliOptions = {
  catalogEpoch: number;
  generatedAt: string;
  outputPath: string;
  channels?: readonly IFirmwareChannel[];
  sourceFile?: string;
};

const parseCliOptions = (): ICliOptions => {
  const args = new Map(
    process.argv.slice(2).map((argument) => {
      const separator = argument.indexOf('=');
      if (!argument.startsWith('--') || separator < 3) {
        return fail(`invalid argument ${argument}`);
      }
      return [argument.slice(2, separator), argument.slice(separator + 1)];
    }),
  );
  const allowedArguments = new Set([
    'catalog-epoch',
    'generated-at',
    'output',
    'channels',
    'source-file',
  ]);
  for (const argument of args.keys()) {
    if (!allowedArguments.has(argument)) {
      return fail(`unknown argument --${argument}`);
    }
  }
  const catalogEpoch = Number(args.get('catalog-epoch'));
  const generatedAt = args.get('generated-at');
  const outputPath = args.get('output');
  const channelsArgument = args.get('channels');
  const sourceFile = args.get('source-file');
  if (!generatedAt || !outputPath) {
    return fail(
      'required arguments: --catalog-epoch, --generated-at, and --output',
    );
  }
  let channels: readonly IFirmwareChannel[] | undefined;
  if (channelsArgument) {
    const parsedChannels = channelsArgument.split(',');
    if (
      parsedChannels.length === 0 ||
      new Set(parsedChannels).size !== parsedChannels.length ||
      parsedChannels.some(
        (channel) => channel !== 'stable' && channel !== 'pre-release',
      )
    ) {
      return fail(
        '--channels must contain unique stable and/or pre-release values',
      );
    }
    channels = parsedChannels as readonly IFirmwareChannel[];
  }
  return {
    catalogEpoch,
    generatedAt,
    outputPath,
    ...(channels ? { channels } : {}),
    ...(sourceFile ? { sourceFile } : {}),
  };
};

const main = async () => {
  const options = parseCliOptions();
  let sources: readonly ITrustedFirmwareManifestSource[] | undefined;
  let fetcher: ITrustedFirmwareCatalogFetcher | undefined;
  if (options.sourceFile) {
    const sourceValue = parseStrictFirmwareJson(
      await readFile(resolve(options.sourceFile), 'utf8'),
    );
    if (!isRecord(sourceValue) || !Array.isArray(sourceValue.sources)) {
      return fail('source-file must contain sources and response fixtures');
    }
    sources = sourceValue.sources.map((source, index) => {
      if (
        !isRecord(source) ||
        (source.channel !== 'stable' && source.channel !== 'pre-release') ||
        typeof source.manifestUrl !== 'string'
      ) {
        return fail(`source-file sources[${index}] is invalid`);
      }
      return {
        channel: source.channel,
        manifestUrl: source.manifestUrl,
      };
    });
    const responses = sourceValue.responses;
    if (!isRecord(responses)) {
      return fail('source-file responses must be an object');
    }
    fetcher = async (url) => {
      const response = responses[url];
      if (
        !isRecord(response) ||
        typeof response.status !== 'number' ||
        typeof response.contentType !== 'string' ||
        typeof response.bodyBase64 !== 'string'
      ) {
        return fail(`source-file has no response for ${url}`);
      }
      return {
        status: response.status,
        headers: { 'content-type': response.contentType },
        body: Buffer.from(response.bodyBase64, 'base64'),
        finalUrl: url,
      };
    };
  }
  if (options.channels) {
    const channelSet = new Set(options.channels);
    sources = (sources ?? DEFAULT_TRUSTED_FIRMWARE_MANIFEST_SOURCES).filter(
      (source) => channelSet.has(source.channel),
    );
  }
  const catalog = await generateTrustedFirmwareCatalog({
    catalogEpoch: options.catalogEpoch,
    generatedAt: options.generatedAt,
    ...(sources ? { sources } : {}),
    ...(fetcher ? { fetcher } : {}),
  });
  await writeFile(
    resolve(options.outputPath),
    renderTrustedFirmwareCatalogModule(catalog),
    'utf8',
  );
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(__filename);

if (isDirectExecution) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
