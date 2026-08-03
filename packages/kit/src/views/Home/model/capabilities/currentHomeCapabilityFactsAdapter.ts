import type { IHomeRuntimeOwnerToken } from '@onekeyhq/shared/src/types/homeRuntime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import type {
  IHomeCapabilityContext,
  IHomeCapabilityFacts,
  IHomePerpsDestination,
} from './homeCapabilityTypes';
import type { IHomeAccountType, IHomeNetworkFamily } from '../facts/homeFacts';

type ICurrentHomeCapabilityFactsInput = {
  accountType: IHomeAccountType;
  allNetworks: boolean;
  expectedSourceScopeKey: string;
  errorKind?: 'source' | 'transport';
  isReady: boolean;
  networkFamily: IHomeNetworkFamily;
  ownerToken: IHomeRuntimeOwnerToken;
  perpsDestination: IHomePerpsDestination;
  productAvailability: Readonly<
    Record<'defi' | 'history' | 'market' | 'nft' | 'perps', boolean>
  >;
  serverConfig: Readonly<
    Record<'defi' | 'history' | 'market' | 'nft' | 'perps', boolean | 'unknown'>
  >;
  sourceRevision: string;
  sourceScopeKey?: string;
};

function toAvailability(
  value: boolean | 'unknown',
): 'available' | 'unavailable' | 'unknown' {
  if (value === 'unknown') return value;
  return value ? 'available' : 'unavailable';
}

function adaptCurrentHomeCapabilityFacts(
  input: ICurrentHomeCapabilityFactsInput,
): IHomeCapabilityFacts {
  const sourceKeyIdentity = stringUtils.stableStringify({
    accountType: input.accountType,
    allNetworks: input.allNetworks,
    capabilityScopeKey: input.expectedSourceScopeKey,
    networkFamily: input.networkFamily,
    ownerScopeKey: input.ownerToken.scopeKey,
    sourceRevision: input.sourceRevision,
  });
  if (
    !input.isReady ||
    input.sourceScopeKey !== input.expectedSourceScopeKey ||
    input.accountType === 'unknown' ||
    input.networkFamily === 'unknown'
  ) {
    return {
      ownerToken: input.ownerToken,
      resource: input.errorKind
        ? { errorKind: input.errorKind, kind: 'error' }
        : { kind: 'loading' },
      sourceKeyIdentity,
    };
  }
  const context: IHomeCapabilityContext = {
    accountType: input.accountType,
    allNetworks: input.allNetworks,
    networkFamily: input.networkFamily,
    perpsDestination: input.perpsDestination,
    productAvailability: {
      defi: toAvailability(input.productAvailability.defi),
      history: toAvailability(input.productAvailability.history),
      market: toAvailability(input.productAvailability.market),
      nft: toAvailability(input.productAvailability.nft),
      perps: toAvailability(input.productAvailability.perps),
    },
    serverConfig: {
      defi: toAvailability(input.serverConfig.defi),
      history: toAvailability(input.serverConfig.history),
      market: toAvailability(input.serverConfig.market),
      nft: toAvailability(input.serverConfig.nft),
      perps: toAvailability(input.serverConfig.perps),
    },
  };
  return {
    ownerToken: input.ownerToken,
    resource: {
      kind: 'complete',
      context,
      coverageFingerprint: stringUtils.stableStringify(context),
    },
    sourceKeyIdentity,
  };
}

export { adaptCurrentHomeCapabilityFacts };
export type { ICurrentHomeCapabilityFactsInput };
