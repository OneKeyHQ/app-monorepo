export type IHomeRuntimeTopology = 'single' | 'split';

export type IHomeRuntimeSourceId =
  | 'capability'
  | 'banner'
  | 'portfolio'
  | 'defi'
  | 'perps'
  | 'nft'
  | 'history'
  | 'market';

export type IHomeRuntimeJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly IHomeRuntimeJsonValue[]
  | { readonly [key: string]: IHomeRuntimeJsonValue };

export interface IHomeRuntimeOwnerScope {
  walletId: string;
  accountId: string;
  network:
    | { kind: 'allNetworks' }
    | { kind: 'singleNetwork'; networkId: string };
}

export interface IHomeRuntimeOwnerToken {
  scopeKey: string;
  sessionId: string;
}

export interface IHomeRuntimeQuoteBasis {
  currency: string;
  pricingRevision?: string;
}

export interface IHomeRuntimeSourceKey {
  scopeKey: string;
  sourceId: IHomeRuntimeSourceId;
  paramsFingerprint: string;
  dataSchemaVersion: number;
  quoteBasis?: IHomeRuntimeQuoteBasis;
}

export interface IHomeRuntimeRequestToken {
  clientInstanceId: string;
  producerInstanceId: string;
  sessionId: string;
  sourceKey: IHomeRuntimeSourceKey;
}

export interface IHomeRuntimeHandshake {
  producerInstanceId: string;
}

export type IHomeRuntimeSourceResult<T extends IHomeRuntimeJsonValue> =
  | { kind: 'partial'; data: T; coverageFingerprint: string }
  | { kind: 'success'; data: T; coverageFingerprint: string }
  | { kind: 'empty'; coverageFingerprint: string }
  | { kind: 'hidden'; reason: 'notApplicable' | 'capabilityNotReady' }
  | {
      kind: 'error';
      errorKind:
        | 'source'
        | 'transport'
        | 'schemaMismatch'
        | 'runtimeUnavailable';
    };

export interface IHomeRuntimeResponseEnvelope<T extends IHomeRuntimeJsonValue> {
  token: IHomeRuntimeRequestToken;
  result: IHomeRuntimeSourceResult<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isHomeRuntimeJsonValue(
  value: unknown,
): value is IHomeRuntimeJsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isHomeRuntimeJsonValue);
  }
  if (!isRecord(value)) {
    return false;
  }
  return Object.values(value).every(isHomeRuntimeJsonValue);
}

export function isHomeRuntimeHandshake(
  value: unknown,
): value is IHomeRuntimeHandshake {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.producerInstanceId === 'string' &&
    value.producerInstanceId.length > 0
  );
}

export function isHomeRuntimeSourceKey(
  value: unknown,
): value is IHomeRuntimeSourceKey {
  if (!isRecord(value)) {
    return false;
  }
  const quoteBasis = value.quoteBasis;
  const quoteBasisValid =
    quoteBasis === undefined ||
    (isRecord(quoteBasis) &&
      typeof quoteBasis.currency === 'string' &&
      quoteBasis.currency.length > 0 &&
      (quoteBasis.pricingRevision === undefined ||
        typeof quoteBasis.pricingRevision === 'string'));
  return (
    typeof value.scopeKey === 'string' &&
    value.scopeKey.length > 0 &&
    [
      'capability',
      'banner',
      'portfolio',
      'defi',
      'perps',
      'nft',
      'history',
      'market',
    ].includes(String(value.sourceId)) &&
    typeof value.paramsFingerprint === 'string' &&
    Number.isSafeInteger(value.dataSchemaVersion) &&
    Number(value.dataSchemaVersion) > 0 &&
    quoteBasisValid
  );
}

export function isHomeRuntimeRequestToken(
  value: unknown,
): value is IHomeRuntimeRequestToken {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.clientInstanceId === 'string' &&
    value.clientInstanceId.length > 0 &&
    typeof value.producerInstanceId === 'string' &&
    value.producerInstanceId.length > 0 &&
    typeof value.sessionId === 'string' &&
    value.sessionId.length > 0 &&
    isHomeRuntimeSourceKey(value.sourceKey)
  );
}

export function isHomeRuntimeResponseEnvelope(
  value: unknown,
): value is IHomeRuntimeResponseEnvelope<IHomeRuntimeJsonValue> {
  if (!isRecord(value) || !isHomeRuntimeRequestToken(value.token)) {
    return false;
  }
  const result = value.result;
  if (!isRecord(result) || typeof result.kind !== 'string') {
    return false;
  }
  if (result.kind === 'error') {
    return [
      'source',
      'transport',
      'schemaMismatch',
      'runtimeUnavailable',
    ].includes(String(result.errorKind));
  }
  if (result.kind === 'hidden') {
    return (
      result.reason === 'notApplicable' ||
      result.reason === 'capabilityNotReady'
    );
  }
  if (
    typeof result.coverageFingerprint !== 'string' ||
    result.coverageFingerprint.length === 0
  ) {
    return false;
  }
  if (result.kind === 'empty') {
    return true;
  }
  return (
    (result.kind === 'partial' || result.kind === 'success') &&
    isHomeRuntimeJsonValue(result.data)
  );
}
