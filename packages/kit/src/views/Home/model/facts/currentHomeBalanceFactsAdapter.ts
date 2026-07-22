import BigNumber from 'bignumber.js';

import type { IHomeRuntimeOwnerToken } from '@onekeyhq/shared/src/types/homeRuntime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import type {
  IHomeBalanceContributorFact,
  IHomeBalanceContributorId,
  IHomeBalanceFacts,
  IHomeBalanceQuoteBasis,
  IHomeFactResource,
} from './homeFacts';

type ICurrentHomeBalanceContributorInput = {
  amount?: string;
  coverageFingerprint?: string;
  errorKind?: 'source' | 'transport' | 'schemaMismatch' | 'runtimeUnavailable';
  expectedSourceScopeKey: string;
  id: IHomeBalanceContributorId;
  included: boolean;
  positiveEvidence: boolean;
  sourceIdentity: string;
  sourceScopeKey?: string;
  status: 'idle' | 'loading' | 'partial' | 'success' | 'empty' | 'error';
};

type IAdaptCurrentHomeBalanceFactsOptions = {
  bannerAvailable: boolean;
  contributors: readonly ICurrentHomeBalanceContributorInput[];
  ownerToken: IHomeRuntimeOwnerToken;
  quoteBasis: IHomeBalanceQuoteBasis;
  requiredSetRevision: string;
};

type IHomeBalanceQuoteRateMap = Readonly<
  Record<string, { value: BigNumber.Value }>
>;

type IHomeBalanceQuotedAmount = {
  amount: string;
  rateIdentity: string;
};

type IHomePortfolioWorthSelection = {
  amount: string;
  sourcePresent: boolean;
};

type IHomeBalanceSourceStatus =
  | 'empty'
  | 'error'
  | 'loading'
  | 'partial'
  | 'success';

function resolveHomeBalanceQuoteAwareSourceStatus<
  TStatus extends IHomeBalanceSourceStatus,
>({
  quoteReady,
  status,
}: {
  quoteReady: boolean;
  status: TStatus;
}): TStatus | 'loading' {
  if (quoteReady || status === 'error') {
    return status;
  }
  return 'loading';
}

function selectHomePortfolioWorth({
  currentWorthKey,
  usesAggregateWorth,
  worth,
}: {
  currentWorthKey?: string;
  usesAggregateWorth: boolean;
  worth: Readonly<Record<string, BigNumber.Value>>;
}): IHomePortfolioWorthSelection {
  const sourcePresent = usesAggregateWorth
    ? Object.keys(worth).length > 0
    : Boolean(
        currentWorthKey &&
        Object.prototype.hasOwnProperty.call(worth, currentWorthKey),
      );
  let values: BigNumber.Value[] = [];
  if (usesAggregateWorth) {
    values = Object.values(worth);
  } else if (currentWorthKey && sourcePresent) {
    values = [worth[currentWorthKey]];
  }
  let total = new BigNumber(0);
  values.forEach((value) => {
    const amount = new BigNumber(value);
    if (amount.isFinite()) {
      total = total.plus(amount);
    }
  });
  return { amount: total.toFixed(), sourcePresent };
}

function buildHomeBalanceQuoteRateIdentity({
  currencyMap,
  sourceCurrency,
  targetCurrency,
}: {
  currencyMap: IHomeBalanceQuoteRateMap;
  sourceCurrency: string;
  targetCurrency: string;
}): string {
  return stringUtils.stableStringify({
    sourceCurrency,
    sourceRate:
      sourceCurrency === targetCurrency
        ? 'identity'
        : (currencyMap[sourceCurrency]?.value ?? 'missing'),
    targetCurrency,
    targetRate:
      sourceCurrency === targetCurrency
        ? 'identity'
        : (currencyMap[targetCurrency]?.value ?? 'missing'),
  });
}

function resolveHomeBalanceQuotedAmount({
  currencyMap,
  sourceCurrency,
  targetCurrency,
  value,
}: {
  currencyMap: IHomeBalanceQuoteRateMap;
  sourceCurrency: string;
  targetCurrency: string;
  value: BigNumber.Value;
}): IHomeBalanceQuotedAmount | undefined {
  const amount = new BigNumber(value);
  if (!amount.isFinite()) {
    return undefined;
  }
  const rateIdentity = buildHomeBalanceQuoteRateIdentity({
    currencyMap,
    sourceCurrency,
    targetCurrency,
  });
  if (sourceCurrency === targetCurrency) {
    return { amount: amount.toFixed(), rateIdentity };
  }
  const sourceRate = new BigNumber(currencyMap[sourceCurrency]?.value ?? NaN);
  const targetRate = new BigNumber(currencyMap[targetCurrency]?.value ?? NaN);
  if (
    !sourceRate.isFinite() ||
    sourceRate.isZero() ||
    !targetRate.isFinite() ||
    targetRate.isZero()
  ) {
    return undefined;
  }
  const converted = amount.div(sourceRate).times(targetRate);
  return converted.isFinite()
    ? { amount: converted.toFixed(), rateIdentity }
    : undefined;
}

function buildContributorSourceKeyIdentity({
  contributor,
  ownerScopeKey,
  quoteBasis,
  requiredSetRevision,
}: {
  contributor: ICurrentHomeBalanceContributorInput;
  ownerScopeKey: string;
  quoteBasis: IHomeBalanceQuoteBasis;
  requiredSetRevision: string;
}): string {
  return stringUtils.stableStringify({
    contributorId: contributor.id,
    ownerScopeKey,
    quoteBasis,
    requiredSetRevision,
    sourceIdentity: contributor.sourceIdentity,
  });
}

function toResource({
  contributor,
  sourceMatches,
}: {
  contributor: ICurrentHomeBalanceContributorInput;
  sourceMatches: boolean;
}): IHomeFactResource<{
  amount: string;
  positiveEvidence: boolean;
}> {
  if (!sourceMatches) {
    return { kind: 'loading' };
  }
  const data = {
    amount: contributor.amount ?? '0',
    positiveEvidence: contributor.positiveEvidence,
  };
  const coverageFingerprint = contributor.coverageFingerprint ?? 'unknown';
  switch (contributor.status) {
    case 'idle':
      return { kind: 'idle' };
    case 'loading':
      return { kind: 'loading' };
    case 'partial':
      return { kind: 'partial', data, coverageFingerprint };
    case 'empty':
      return {
        kind: 'complete',
        result: { kind: 'empty' },
        coverageFingerprint,
      };
    case 'success':
      return {
        kind: 'complete',
        result: { kind: 'success', data },
        coverageFingerprint,
      };
    case 'error':
      return {
        kind: 'error',
        errorKind: contributor.errorKind ?? 'source',
      };
    default:
      return { kind: 'idle' };
  }
}

function adaptCurrentHomeBalanceFacts({
  bannerAvailable,
  contributors,
  ownerToken,
  quoteBasis,
  requiredSetRevision,
}: IAdaptCurrentHomeBalanceFactsOptions): IHomeBalanceFacts {
  const includedContributors = contributors
    .filter((contributor) => contributor.included)
    .toSorted((left, right) => left.id.localeCompare(right.id));
  const requiredContributors = includedContributors.map(
    (contributor) => contributor.id,
  );
  const adaptedContributors: Partial<
    Record<IHomeBalanceContributorId, IHomeBalanceContributorFact>
  > = {};
  includedContributors.forEach((contributor) => {
    const sourceKeyIdentity = buildContributorSourceKeyIdentity({
      contributor,
      ownerScopeKey: ownerToken.scopeKey,
      quoteBasis,
      requiredSetRevision,
    });
    adaptedContributors[contributor.id] = {
      id: contributor.id,
      ownerToken,
      quoteBasis,
      requiredSetRevision,
      sourceKeyIdentity,
      resource: toResource({
        contributor,
        sourceMatches:
          contributor.sourceScopeKey === contributor.expectedSourceScopeKey,
      }),
    };
  });
  const sourceKeyIdentity = stringUtils.stableStringify({
    contributors: includedContributors.map((contributor) => ({
      id: contributor.id,
      sourceIdentity: contributor.sourceIdentity,
    })),
    ownerScopeKey: ownerToken.scopeKey,
    quoteBasis,
    requiredSetRevision,
  });
  return {
    bannerAvailable,
    contributors: adaptedContributors,
    ownerToken,
    quoteBasis,
    requiredContributors,
    requiredSetRevision,
    sourceKeyIdentity,
  };
}

export {
  adaptCurrentHomeBalanceFacts,
  buildContributorSourceKeyIdentity,
  buildHomeBalanceQuoteRateIdentity,
  resolveHomeBalanceQuoteAwareSourceStatus,
  resolveHomeBalanceQuotedAmount,
  selectHomePortfolioWorth,
};
export type {
  IAdaptCurrentHomeBalanceFactsOptions,
  ICurrentHomeBalanceContributorInput,
  IHomeBalanceQuoteRateMap,
  IHomeBalanceQuotedAmount,
  IHomeBalanceSourceStatus,
  IHomePortfolioWorthSelection,
};
