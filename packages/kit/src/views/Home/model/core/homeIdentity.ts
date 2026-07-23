import type {
  IHomeRuntimeOwnerScope,
  IHomeRuntimeOwnerToken,
  IHomeRuntimeQuoteBasis,
  IHomeRuntimeSourceId,
  IHomeRuntimeSourceKey,
} from '@onekeyhq/shared/src/types/homeRuntime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

const HOME_SCOPE_KEY_VERSION = 'home-owner-v1';

function encodeIdentityPart(value: string): string {
  return `${value.length}:${value}`;
}

export function buildHomeOwnerScopeKey(owner: IHomeRuntimeOwnerScope): string {
  const networkIdentity =
    owner.network.kind === 'allNetworks'
      ? 'all'
      : `single:${encodeIdentityPart(owner.network.networkId)}`;
  return [
    HOME_SCOPE_KEY_VERSION,
    encodeIdentityPart(owner.walletId),
    encodeIdentityPart(owner.accountId),
    networkIdentity,
  ].join('|');
}

export function createHomeAuthorityId(
  prefix: 'client' | 'intent' | 'session',
  generateId: () => string = () =>
    stringUtils.generateUUID({ removeDashes: true }),
): string {
  return `home-${prefix}-${generateId()}`;
}

export function createHomeOwnerToken({
  owner,
  sessionId,
}: {
  owner: IHomeRuntimeOwnerScope;
  sessionId: string;
}): IHomeRuntimeOwnerToken {
  return {
    scopeKey: buildHomeOwnerScopeKey(owner),
    sessionId,
  };
}

export function createHomeSourceKey({
  dataSchemaVersion,
  ownerToken,
  paramsFingerprint,
  quoteBasis,
  sourceId,
}: {
  dataSchemaVersion: number;
  ownerToken: IHomeRuntimeOwnerToken;
  paramsFingerprint: string;
  quoteBasis?: IHomeRuntimeQuoteBasis;
  sourceId: IHomeRuntimeSourceId;
}): IHomeRuntimeSourceKey {
  return {
    scopeKey: ownerToken.scopeKey,
    sourceId,
    paramsFingerprint,
    dataSchemaVersion,
    quoteBasis,
  };
}

export function getHomeSourceKeyIdentity(
  sourceKey: IHomeRuntimeSourceKey,
): string {
  const quoteBasis = sourceKey.quoteBasis
    ? `${encodeIdentityPart(sourceKey.quoteBasis.currency)}:${encodeIdentityPart(
        sourceKey.quoteBasis.pricingRevision ?? '',
      )}`
    : '';
  return [
    encodeIdentityPart(sourceKey.scopeKey),
    sourceKey.sourceId,
    encodeIdentityPart(sourceKey.paramsFingerprint),
    String(sourceKey.dataSchemaVersion),
    quoteBasis,
  ].join('|');
}

export function areHomeSourceKeysEqual(
  first: IHomeRuntimeSourceKey,
  second: IHomeRuntimeSourceKey,
): boolean {
  return getHomeSourceKeyIdentity(first) === getHomeSourceKeyIdentity(second);
}
