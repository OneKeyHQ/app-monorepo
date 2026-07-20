import type { IHomeRuntimeOwnerToken } from '@onekeyhq/shared/src/types/homeRuntime';

import type { IHomeAccountType, IHomeNetworkFamily } from '../facts/homeFacts';
import type { IHomeSectionId, IHomeTabId } from '../semantic/homeSemanticTypes';

type IHomeCapabilityAvailability = 'available' | 'unavailable' | 'unknown';

type IHomePerpsDestination = 'inline' | 'web' | 'unavailable';

type IHomeCapabilityContext = {
  accountType: IHomeAccountType;
  allNetworks: boolean;
  networkFamily: IHomeNetworkFamily;
  perpsDestination: IHomePerpsDestination;
  productAvailability: Readonly<
    Record<
      'defi' | 'history' | 'market' | 'nft' | 'perps',
      IHomeCapabilityAvailability
    >
  >;
  serverConfig: Readonly<
    Record<
      'defi' | 'history' | 'market' | 'nft' | 'perps',
      IHomeCapabilityAvailability
    >
  >;
};

type IHomeCapabilityFacts = {
  ownerToken: IHomeRuntimeOwnerToken;
  sourceKeyIdentity: string;
  resource:
    | { kind: 'loading' }
    | { kind: 'error'; errorKind: 'source' | 'transport' }
    | {
        kind: 'complete';
        context: IHomeCapabilityContext;
        coverageFingerprint: string;
      };
};

type IHomeCapabilitySet = {
  destinations: Readonly<Partial<Record<IHomeTabId, 'inline' | 'web'>>>;
  perpsDestination: IHomePerpsDestination;
  revision: string;
  sections: Readonly<Record<IHomeSectionId, boolean>>;
  tabs: readonly [IHomeTabId, ...IHomeTabId[]];
};

type IHomeCapabilityPresentation =
  | { kind: 'pending' }
  | {
      kind: 'ready';
      refresh: 'idle' | 'refreshing' | 'failed';
      freshness: 'live' | 'confirmedCache';
      value: IHomeCapabilitySet;
    };

export type {
  IHomeCapabilityAvailability,
  IHomeCapabilityContext,
  IHomeCapabilityFacts,
  IHomeCapabilityPresentation,
  IHomeCapabilitySet,
  IHomePerpsDestination,
};
