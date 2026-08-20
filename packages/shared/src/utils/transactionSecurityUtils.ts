import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';
import type {
  ITransactionSecurityCheckResult,
  ITransactionSecurityCheckResultRaw,
  ITransactionSecurityFeature,
  ITransactionSecurityFeatureRaw,
  ITransactionSecurityJsonRpc,
} from '@onekeyhq/shared/types/transactionSecurity';

export function buildTransactionSecurityJsonRpc({
  jsonRpcRequest,
}: {
  jsonRpcRequest?: {
    method?: unknown;
    params?: unknown;
  };
}): ITransactionSecurityJsonRpc | undefined {
  if (
    typeof jsonRpcRequest?.method !== 'string' ||
    !jsonRpcRequest.method ||
    !Array.isArray(jsonRpcRequest.params) ||
    !jsonRpcRequest.params.length
  ) {
    return undefined;
  }

  return {
    method: jsonRpcRequest.method,
    params: jsonRpcRequest.params,
  };
}

const HOST_SECURITY_LEVELS = new Set<string>(Object.values(EHostSecurityLevel));

const FEATURE_LEVEL_WEIGHT: Record<EHostSecurityLevel, number> = {
  [EHostSecurityLevel.High]: 4,
  [EHostSecurityLevel.Medium]: 3,
  [EHostSecurityLevel.Unknown]: 2,
  [EHostSecurityLevel.Security]: 1,
};

export function normalizeTransactionSecurityLevel(
  value?: string,
): EHostSecurityLevel {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return EHostSecurityLevel.Unknown;
  }
  if (HOST_SECURITY_LEVELS.has(normalized)) {
    return normalized as EHostSecurityLevel;
  }
  if (normalized === 'malicious') {
    return EHostSecurityLevel.High;
  }
  if (normalized === 'warning') {
    return EHostSecurityLevel.Medium;
  }
  if (normalized === 'benign') {
    return EHostSecurityLevel.Security;
  }
  return EHostSecurityLevel.Unknown;
}

function normalizeFeature(
  feature: ITransactionSecurityFeatureRaw,
): ITransactionSecurityFeature | undefined {
  const code = feature.code?.trim();
  if (!code) {
    return undefined;
  }
  const title = feature.title?.trim();
  const content = feature.content?.trim();
  const address = feature.address?.trim();
  return {
    level: normalizeTransactionSecurityLevel(feature.level ?? feature.type),
    code,
    title: title || undefined,
    content: content || undefined,
    address: address || undefined,
  };
}

export function normalizeTransactionSecurityResult(
  result?: ITransactionSecurityCheckResultRaw,
): ITransactionSecurityCheckResult | undefined {
  if (!result) {
    return undefined;
  }

  const code =
    result.detail?.code?.trim() || result.detail?.summaryCode?.trim();
  const title = result.detail?.title?.trim();
  const content = result.detail?.content?.trim();
  const features = (result.detail?.features ?? [])
    .map((feature) => normalizeFeature(feature))
    .filter((feature): feature is ITransactionSecurityFeature =>
      Boolean(feature),
    );

  if (!code && !title && !content && features.length === 0 && !result.level) {
    return undefined;
  }

  return {
    level: normalizeTransactionSecurityLevel(result.level),
    detail: {
      code: code || 'unable_to_assess',
      title: title || undefined,
      content: content || undefined,
      features,
    },
  };
}

export function sortTransactionSecurityFeatures(
  features: ITransactionSecurityFeature[],
) {
  return features
    .map((feature, index) => ({ feature, index }))
    .toSorted((a, b) => {
      const weightDiff =
        FEATURE_LEVEL_WEIGHT[b.feature.level] -
        FEATURE_LEVEL_WEIGHT[a.feature.level];
      if (weightDiff !== 0) {
        return weightDiff;
      }
      return a.index - b.index;
    })
    .map(({ feature }) => feature);
}

export function shouldShowTransactionSecurityFinding(
  result?: ITransactionSecurityCheckResult,
): result is ITransactionSecurityCheckResult {
  return Boolean(result);
}

export function hasTransactionSecurityFeatures(
  result?: ITransactionSecurityCheckResult,
) {
  return Boolean(result?.detail.features.length);
}

export function mergeTransactionSecurityResults(
  results: Array<ITransactionSecurityCheckResult | undefined>,
): ITransactionSecurityCheckResult | undefined {
  const validResults = results.filter(
    (result): result is ITransactionSecurityCheckResult => Boolean(result),
  );
  if (!validResults.length) {
    return undefined;
  }

  const primary = validResults.reduce((best, current) =>
    FEATURE_LEVEL_WEIGHT[current.level] > FEATURE_LEVEL_WEIGHT[best.level]
      ? current
      : best,
  );

  const seen = new Set<string>();
  const features: ITransactionSecurityFeature[] = [];
  validResults.forEach((result) => {
    result.detail.features.forEach((feature) => {
      const key = `${feature.code}:${feature.address ?? ''}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      features.push(feature);
    });
  });

  return {
    level: primary.level,
    detail: {
      ...primary.detail,
      features,
    },
  };
}
