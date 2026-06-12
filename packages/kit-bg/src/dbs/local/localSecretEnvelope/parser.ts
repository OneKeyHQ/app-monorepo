import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import {
  LOCAL_SECRET_ENVELOPE_PREFIX,
  LOCAL_SECRET_ENVELOPE_VERSION,
} from './consts';

import type {
  ILocalSecretEnvelopeDataType,
  ILocalSecretEnvelopeLayer,
  ILocalSecretEnvelopeLayerCapabilities,
  ILocalSecretEnvelopeLayerKind,
  ILocalSecretEnvelopeProtectedHeaderV1,
  ILocalSecretEnvelopeStrength,
  ILocalSecretEnvelopeV1,
} from './types';

type IJsonRecord = Record<string, unknown>;

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new OneKeyLocalError(message);
  }
}

function isJsonRecord(value: unknown): value is IJsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readString(record: IJsonRecord, key: string): string {
  const value = record[key];
  invariant(
    typeof value === 'string' && value.length > 0,
    `Invalid local secret envelope field: ${key}`,
  );
  return value;
}

function readOptionalString(
  record: IJsonRecord,
  key: string,
): string | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  invariant(
    typeof value === 'string' && value.length > 0,
    `Invalid local secret envelope field: ${key}`,
  );
  return value;
}

function readOptionalBoolean(
  record: IJsonRecord,
  key: string,
): boolean | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  invariant(
    typeof value === 'boolean',
    `Invalid local secret envelope field: ${key}`,
  );
  return value;
}

function parseDataType(value: string): ILocalSecretEnvelopeDataType {
  invariant(
    value === 'credential' || value === 'verify-string',
    'Invalid local secret envelope dataType',
  );
  return value;
}

function parseLayerKind(value: string): ILocalSecretEnvelopeLayerKind {
  invariant(
    value === 'keychain' ||
      value === 'keystore' ||
      value === 'secure-storage' ||
      value === 'indexeddb-cryptokey',
    'Invalid local secret envelope layer kind',
  );
  return value;
}

function parseLayerAlg(value: string): ILocalSecretEnvelopeLayer['alg'] {
  invariant(
    value === 'AES-256-GCM' ||
      value === 'OS-Keychain' ||
      value === 'OS-SecureStorage',
    'Invalid local secret envelope layer alg',
  );
  return value;
}

function parseStrength(value: string): ILocalSecretEnvelopeStrength {
  invariant(
    value === 'secure-storage-bound' ||
      value === 'device-bound' ||
      value === 'profile-bound' ||
      value === 'unavailable',
    'Invalid local secret envelope strength',
  );
  return value;
}

function parseLayerCapabilities(
  value: unknown,
): ILocalSecretEnvelopeLayerCapabilities {
  invariant(
    isJsonRecord(value),
    'Invalid local secret envelope layer capabilities',
  );
  const sync = readString(value, 'sync');
  invariant(
    sync === 'local-only' || sync === 'cloud-sync' || sync === 'unknown',
    'Invalid local secret envelope layer sync capability',
  );

  const extractable = value.extractable;
  invariant(
    typeof extractable === 'boolean' || extractable === 'unknown',
    'Invalid local secret envelope layer extractable capability',
  );

  const keyAccess = readString(value, 'keyAccess');
  invariant(
    keyAccess === 'opaque-decrypt' ||
      keyAccess === 'raw-key-readable' ||
      keyAccess === 'unknown',
    'Invalid local secret envelope layer key access capability',
  );

  const requireAuth = readOptionalBoolean(value, 'requireAuth');
  return {
    sync,
    extractable,
    keyAccess,
    ...(requireAuth === undefined ? undefined : { requireAuth }),
  };
}

function parseWrappingLayer(value: unknown): ILocalSecretEnvelopeLayer {
  invariant(isJsonRecord(value), 'Invalid local secret envelope layer');
  return {
    kind: parseLayerKind(readString(value, 'kind')),
    keyRef: readString(value, 'keyRef'),
    alg: parseLayerAlg(readString(value, 'alg')),
    ...(readOptionalString(value, 'iv')
      ? { iv: readOptionalString(value, 'iv') }
      : undefined),
    capabilities: parseLayerCapabilities(value.capabilities),
  };
}

function parseWrappingLayers(value: unknown): ILocalSecretEnvelopeLayer[] {
  invariant(
    Array.isArray(value) && value.length > 0,
    'Invalid local secret envelope wrapping layers',
  );
  return value.map((layer) => parseWrappingLayer(layer));
}

export function isLocalSecretEnvelopeString(value: string): boolean {
  return value.startsWith(LOCAL_SECRET_ENVELOPE_PREFIX);
}

export function stripLocalSecretPrefix(text: string): string {
  const prefixEnd = text.indexOf('|', 1);
  if (text.startsWith('|') && prefixEnd > 0) {
    return text.slice(prefixEnd + 1);
  }
  return text;
}

export function buildLocalSecretEnvelopeProtectedHeaderV1({
  dataType,
  recordId,
  wrappingLayers,
}: {
  dataType: ILocalSecretEnvelopeDataType;
  recordId: string;
  wrappingLayers: ILocalSecretEnvelopeLayer[];
}): string {
  const header: ILocalSecretEnvelopeProtectedHeaderV1 = {
    version: LOCAL_SECRET_ENVELOPE_VERSION,
    dataType,
    recordId,
    wrappingLayers,
  };
  return stringUtils.stableStringify(header);
}

export function buildLocalSecretEnvelopeAadV1({
  dataType,
  recordId,
  protectedHeader,
}: {
  dataType: ILocalSecretEnvelopeDataType;
  recordId: string;
  protectedHeader: string;
}): string {
  return stringUtils.stableStringify({
    dataType,
    recordId,
    protectedHeader,
  });
}

export function assertLocalSecretEnvelopeV1(
  value: unknown,
): asserts value is ILocalSecretEnvelopeV1 {
  invariant(isJsonRecord(value), 'Invalid local secret envelope');
  invariant(
    value.version === LOCAL_SECRET_ENVELOPE_VERSION,
    'Invalid local secret envelope version',
  );

  const dataType = parseDataType(readString(value, 'dataType'));
  const recordId = readString(value, 'recordId');
  const wrappingLayers = parseWrappingLayers(value.wrappingLayers);
  const strength = parseStrength(readString(value, 'strength'));
  invariant(
    strength !== 'unavailable',
    'Invalid local secret envelope unavailable strength',
  );
  const protectedHeader = readString(value, 'protectedHeader');
  const ciphertext = readString(value, 'ciphertext');

  const expectedProtectedHeader = buildLocalSecretEnvelopeProtectedHeaderV1({
    dataType,
    recordId,
    wrappingLayers,
  });
  invariant(
    protectedHeader === expectedProtectedHeader,
    'Invalid local secret envelope protected header',
  );

  Object.assign(value, {
    version: LOCAL_SECRET_ENVELOPE_VERSION,
    dataType,
    recordId,
    wrappingLayers,
    strength,
    protectedHeader,
    ciphertext,
  });
}

export function serializeLocalSecretEnvelopeV1(
  envelope: ILocalSecretEnvelopeV1,
): string {
  assertLocalSecretEnvelopeV1(envelope);
  return `${LOCAL_SECRET_ENVELOPE_PREFIX}${stringUtils.stableStringify(
    envelope,
  )}`;
}

export function parseLocalSecretEnvelopeV1(
  value: string,
): ILocalSecretEnvelopeV1 {
  invariant(
    isLocalSecretEnvelopeString(value),
    'Invalid local secret envelope prefix',
  );
  const payload = value.slice(LOCAL_SECRET_ENVELOPE_PREFIX.length);
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload) as unknown;
  } catch {
    throw new OneKeyLocalError('Invalid local secret envelope JSON');
  }
  assertLocalSecretEnvelopeV1(parsed);
  return parsed;
}
