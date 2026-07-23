import type {
  IHomeRuntimeOwnerScope,
  IHomeRuntimeOwnerToken,
  IHomeRuntimeSourceId,
  IHomeRuntimeTopology,
} from '@onekeyhq/shared/src/types/homeRuntime';

import type { IHomeCapabilityFacts } from '../capabilities/homeCapabilityTypes';

export type IHomeBackupStatus =
  | 'unknown'
  | 'required'
  | 'complete'
  | 'notApplicable';

export type IHomeAccountType =
  | 'hd'
  | 'imported'
  | 'watching'
  | 'external'
  | 'hardware'
  | 'qr'
  | 'unknown';

export type IHomeNetworkFamily =
  | 'allNetworks'
  | 'btc'
  | 'evm'
  | 'sol'
  | 'ton'
  | 'tron'
  | 'unknown';

export type IHomeFactRow = {
  id: string;
};

export type IHomePortfolioFactData = {
  amount: string;
  currency: string;
  positiveEvidence: boolean;
  requiredSetRevision: string;
  bannerAvailable?: boolean;
  rows?: readonly IHomeFactRow[];
};

export type IHomeBalanceContributorId = 'portfolio' | 'defi' | 'perps';

export type IHomeBalanceQuoteBasis = {
  currency: string;
  pricingRevision: string;
};

export type IHomeBalanceContributionData = {
  amount: string;
  positiveEvidence: boolean;
};

export type IHomeBalanceContributorFact = {
  id: IHomeBalanceContributorId;
  ownerToken: IHomeRuntimeOwnerToken;
  requiredSetRevision: string;
  sourceKeyIdentity: string;
  quoteBasis: IHomeBalanceQuoteBasis;
  resource: IHomeFactResource<IHomeBalanceContributionData>;
};

export type IHomeBalanceFacts = {
  ownerToken: IHomeRuntimeOwnerToken;
  requiredContributors: readonly IHomeBalanceContributorId[];
  requiredSetRevision: string;
  sourceKeyIdentity: string;
  quoteBasis: IHomeBalanceQuoteBasis;
  contributors: Partial<
    Record<IHomeBalanceContributorId, IHomeBalanceContributorFact>
  >;
  bannerAvailable: boolean;
};

export type IHomeSectionFactData = {
  rows: readonly IHomeFactRow[];
};

export type IHomeFactResource<T> =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'partial'; data: T; coverageFingerprint: string }
  | {
      kind: 'complete';
      result: { kind: 'success'; data: T } | { kind: 'empty' };
      coverageFingerprint: string;
    }
  | {
      kind: 'error';
      errorKind:
        | 'source'
        | 'transport'
        | 'schemaMismatch'
        | 'runtimeUnavailable';
    };

export type IHomeSourceFacts = {
  portfolio: IHomeFactResource<IHomePortfolioFactData>;
  defi: IHomeFactResource<IHomeSectionFactData>;
  perps: IHomeFactResource<IHomeSectionFactData>;
  nft: IHomeFactResource<IHomeSectionFactData>;
  history: IHomeFactResource<IHomeSectionFactData>;
  market: IHomeFactResource<IHomeSectionFactData>;
};

export type IHomeConfirmedFact = {
  sourceId: IHomeRuntimeSourceId;
  sourceKeyIdentity: string;
  coverageFingerprint: string;
  confirmedAt: number;
  data: IHomePortfolioFactData | IHomeSectionFactData;
};

export type IHomeFacts = {
  owner: IHomeRuntimeOwnerScope;
  ownerToken: IHomeRuntimeOwnerToken;
  wallet: {
    ready: boolean;
    hasNetworkAccount: boolean;
    backupStatus: IHomeBackupStatus;
    accountType: IHomeAccountType;
  };
  environment: {
    currency?: string;
    locale?: string;
    theme: 'light' | 'dark' | 'unknown';
  };
  runtime: {
    topology: IHomeRuntimeTopology;
    connection: 'waiting' | 'ready' | 'degraded';
    producerInstanceId?: string;
    protocolVersion: number;
  };
  capabilityInputs: {
    ready: boolean;
    networkFamily: IHomeNetworkFamily;
    accountType: IHomeAccountType;
    allNetworks: boolean;
    serverConfig: {
      perps: boolean;
      defi: boolean;
      nft: boolean;
      history: boolean;
      market: boolean;
    };
    productAvailability: {
      perps: boolean;
      defi: boolean;
      nft: boolean;
      history: boolean;
      market: boolean;
    };
  };
  sources: IHomeSourceFacts;
  confirmed: Partial<Record<IHomeRuntimeSourceId, IHomeConfirmedFact>>;
  balance?: IHomeBalanceFacts;
  capability?: IHomeCapabilityFacts;
};

export function createIdleHomeSourceFacts(): IHomeSourceFacts {
  return {
    portfolio: { kind: 'idle' },
    defi: { kind: 'idle' },
    perps: { kind: 'idle' },
    nft: { kind: 'idle' },
    history: { kind: 'idle' },
    market: { kind: 'idle' },
  };
}
