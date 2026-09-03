import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';
import {
  ETransactionSecurityResultCode,
  type ITransactionSecurityCheckResult,
  type ITransactionSecurityCheckResultRaw,
  type ITransactionSecurityFeature,
  type ITransactionSecurityFeatureRaw,
  type ITransactionSecurityJsonRpc,
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

export function getTransactionSecurityResultCode(
  result?: ITransactionSecurityCheckResultRaw,
) {
  return result?.detail?.code?.trim() || result?.detail?.summaryCode?.trim();
}

function isTransactionSecurityResultCode(
  result: ITransactionSecurityCheckResultRaw | undefined,
  code: ETransactionSecurityResultCode,
) {
  return getTransactionSecurityResultCode(result)?.toLowerCase() === code;
}

export function isTransactionSecurityNotApplicable(
  result?: ITransactionSecurityCheckResultRaw,
) {
  return (
    result?.supported === false ||
    isTransactionSecurityResultCode(
      result,
      ETransactionSecurityResultCode.NotSupported,
    )
  );
}

function createUnknownTransactionSecurityResult(
  code: ETransactionSecurityResultCode,
): ITransactionSecurityCheckResult {
  return {
    level: EHostSecurityLevel.Unknown,
    detail: {
      code,
      features: [],
    },
  };
}

export function createUnableToAssessTransactionSecurityResult() {
  return createUnknownTransactionSecurityResult(
    ETransactionSecurityResultCode.UnableToAssess,
  );
}

export function createCheckFailedTransactionSecurityResult() {
  return createUnknownTransactionSecurityResult(
    ETransactionSecurityResultCode.CheckFailed,
  );
}

export function isTransactionSecurityCheckFailed(
  result?: ITransactionSecurityCheckResult | ITransactionSecurityCheckResultRaw,
) {
  return isTransactionSecurityResultCode(
    result,
    ETransactionSecurityResultCode.CheckFailed,
  );
}

// Live /utility/v1/transaction/check allowlist. Other methods return 422.
const TRANSACTION_SECURITY_JSON_RPC_METHODS = new Set([
  'eth_sendtransaction',
  'eth_sendrawtransaction',
  'eth_signtransaction',
  'eth_sign',
  'eth_signtypeddata',
  'eth_signtypeddata_v1',
  'eth_signtypeddata_v2',
  'eth_signtypeddata_v3',
  'eth_signtypeddata_v4',
  'eth_senduseroperation',
  'personal_sign',
  'wallet_sendcalls',
]);

// After vault normalization: string payloads, or EVM objects with these keys.
const TRANSACTION_SECURITY_ENCODED_TX_KEYS = new Set([
  'to',
  'data',
  'value',
  'from',
]);

export function canSubmitTransactionSecurityJsonRpc(
  jsonRpc?: ITransactionSecurityJsonRpc,
) {
  const method = jsonRpc?.method?.trim().toLowerCase();
  return Boolean(method && TRANSACTION_SECURITY_JSON_RPC_METHODS.has(method));
}

function isEncodedTxRecord(
  encodedTx: unknown,
): encodedTx is Record<string, unknown> {
  return Boolean(
    encodedTx && typeof encodedTx === 'object' && !Array.isArray(encodedTx),
  );
}

export function canSubmitTransactionSecurityEncodedTx(encodedTx: unknown) {
  if (typeof encodedTx === 'string') {
    return encodedTx.trim().length > 0;
  }
  if (!isEncodedTxRecord(encodedTx)) {
    return false;
  }
  const keys = Object.keys(encodedTx);
  return (
    keys.length > 0 &&
    keys.every((key) => TRANSACTION_SECURITY_ENCODED_TX_KEYS.has(key))
  );
}

export function canAttemptTransactionSecurityEncodedTx(encodedTx: unknown) {
  if (canSubmitTransactionSecurityEncodedTx(encodedTx)) {
    return true;
  }
  return (
    isEncodedTxRecord(encodedTx) &&
    ['to', 'data', 'value'].some((key) => key in encodedTx)
  );
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
  if (!result || isTransactionSecurityNotApplicable(result)) {
    return undefined;
  }

  const code = getTransactionSecurityResultCode(result);
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
      code: code || ETransactionSecurityResultCode.UnableToAssess,
      title: title || undefined,
      content: content || undefined,
      features,
    },
  };
}

export function resolveTransactionSecurityServerResult(
  raw?: ITransactionSecurityCheckResultRaw,
) {
  if (isTransactionSecurityNotApplicable(raw)) {
    return undefined;
  }
  return (
    normalizeTransactionSecurityResult(raw) ??
    createUnableToAssessTransactionSecurityResult()
  );
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

export function hasTransactionSecurityFeatures(
  result?: ITransactionSecurityCheckResult,
) {
  return Boolean(result?.detail.features.length);
}

export function mergeTransactionSecurityResults(
  results: Array<ITransactionSecurityCheckResult | undefined>,
): ITransactionSecurityCheckResult | undefined {
  const validResults = results.filter(
    (result): result is ITransactionSecurityCheckResult =>
      Boolean(result) && !isTransactionSecurityCheckFailed(result),
  );
  if (!validResults.length) {
    return results.some((result) => isTransactionSecurityCheckFailed(result))
      ? createCheckFailedTransactionSecurityResult()
      : undefined;
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

    if (
      result !== primary &&
      result.level !== EHostSecurityLevel.Security &&
      result.detail.features.length === 0
    ) {
      const key = [
        'summary',
        result.level,
        result.detail.code,
        result.detail.title,
        result.detail.content ?? '',
      ].join(':');
      if (!seen.has(key)) {
        seen.add(key);
        features.push({
          level: result.level,
          code: result.detail.code,
          title: result.detail.title,
          content: result.detail.content,
        });
      }
    }
  });

  return {
    level: primary.level,
    detail: {
      ...primary.detail,
      features,
    },
  };
}
