import { AppError, ERROR_CODES } from '../errors';
import { apiClient } from '../infra';

export type IBtcFeeTier = 'slow' | 'standard' | 'fast';

const TIER_INDEX: Record<IBtcFeeTier, number> = {
  slow: 0,
  standard: 1,
  fast: 2,
};

const MIN_RELAY_FEE_RATE = 1;
const MAINNET_SAFE_FLOOR = 2;
// Hard ceiling against malformed API responses or fat-finger user input.
// Historic mempool peaks rarely exceed a few hundred sat/vB; 2000 leaves
// generous headroom while still preventing accidental fee blowouts.
const MAX_REASONABLE_FEE_RATE = 2000;

interface IEstimateFeeBtcResp {
  feeUTXO?: Array<{ feeRate?: string; feeValue?: string }>;
}

export interface IFetchBtcFeeRateParams {
  networkId: string;
  accountAddress: string;
  tier?: IBtcFeeTier;
}

function pickFeeFromTiers(
  rates: string[],
  tier: IBtcFeeTier,
): string | undefined {
  const idx = TIER_INDEX[tier];
  if (rates[idx]) return rates[idx];
  // tier missing: fall back to the closest LOWER tier; never silently upgrade
  // to a higher tier, otherwise an API outlier (e.g. only `fast` returned) can
  // overcharge a user who asked for `slow`/`standard`.
  for (let i = idx - 1; i >= 0; i -= 1) {
    if (rates[i]) return rates[i];
  }
  return undefined;
}

function normalizeRates(raw: Array<{ feeRate?: string }>): string[] {
  // Filter to positive integers and ascending sort. The App tolerates negative
  // values by neighbour-replacement, but for the CLI we just drop them — they
  // arise from upstream blockbook outliers and the user can pass --fee-rate
  // explicitly if all tiers are bogus.
  const cleaned = raw
    .map((item) => item.feeRate)
    .filter(
      (rate): rate is string =>
        typeof rate === 'string' && /^-?\d+(\.\d+)?$/.test(rate),
    )
    .map((rate) => Math.max(0, Math.floor(Number(rate))).toString())
    .filter((rate) => {
      const numeric = Number(rate);
      return (
        numeric >= MIN_RELAY_FEE_RATE && numeric <= MAX_REASONABLE_FEE_RATE
      );
    });
  cleaned.sort((a, b) => Number(a) - Number(b));
  return cleaned;
}

export async function fetchBtcFeeRate({
  networkId,
  accountAddress,
  tier = 'standard',
}: IFetchBtcFeeRateParams): Promise<string> {
  let resp: IEstimateFeeBtcResp;
  try {
    resp = await apiClient.post<IEstimateFeeBtcResp>(
      'wallet',
      '/wallet/v1/account/estimate-fee',
      { networkId, accountAddress },
    );
  } catch (error) {
    throw new AppError(
      ERROR_CODES.BIZ_GAS_ESTIMATION_FAILED.code,
      'Failed to fetch BTC fee rate',
      'Pass --fee-rate explicitly or check network connectivity',
      { cause: error },
    );
  }

  if (!resp.feeUTXO || resp.feeUTXO.length === 0) {
    throw new AppError(
      ERROR_CODES.BIZ_GAS_ESTIMATION_FAILED.code,
      'BTC estimate-fee returned no feeUTXO data',
      'Pass --fee-rate explicitly or retry',
    );
  }

  const tiers = normalizeRates(resp.feeUTXO);
  if (tiers.length === 0) {
    throw new AppError(
      ERROR_CODES.BIZ_GAS_ESTIMATION_FAILED.code,
      'BTC estimate-fee returned no usable fee rates',
      'Pass --fee-rate explicitly or retry',
    );
  }

  const picked = pickFeeFromTiers(tiers, tier);
  if (!picked) {
    throw new AppError(
      ERROR_CODES.BIZ_GAS_ESTIMATION_FAILED.code,
      `No fee rate available for tier "${tier}"`,
      'Pass --fee-rate explicitly or use a different --fee-tier',
    );
  }
  return picked;
}

export function parseBtcFeeTier(value: string | undefined): IBtcFeeTier {
  if (value === undefined) return 'standard';
  const normalized = value.toLowerCase();
  if (
    normalized === 'slow' ||
    normalized === 'standard' ||
    normalized === 'fast'
  ) {
    return normalized;
  }
  throw new AppError(
    ERROR_CODES.PARAM_INVALID_CONFIG.code,
    `Invalid --fee-tier: "${value}"`,
    'Use one of: slow, standard, fast',
  );
}

export function validateExplicitFeeRate(feeRate: string, impl: string): string {
  if (!/^\d+(\.\d+)?$/.test(feeRate)) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CONFIG.code,
      `Invalid --fee-rate: "${feeRate}" is not a positive number`,
      'Use a positive sats/vByte value (e.g. 5)',
    );
  }
  const numeric = Number(feeRate);
  if (!Number.isFinite(numeric) || numeric < MIN_RELAY_FEE_RATE) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CONFIG.code,
      `--fee-rate ${feeRate} is below the relay minimum (${MIN_RELAY_FEE_RATE} sat/vB)`,
      'Use a value >= 1; on mainnet at least 2-3 to avoid getting stuck',
    );
  }
  if (impl === 'btc' && numeric < MAINNET_SAFE_FLOOR) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CONFIG.code,
      `--fee-rate ${feeRate} is below the mainnet safe floor (${MAINNET_SAFE_FLOOR} sat/vB)`,
      'Mainnet transactions below 2 sat/vB routinely get stuck. Use --fee-tier or a higher --fee-rate',
    );
  }
  if (numeric > MAX_REASONABLE_FEE_RATE) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CONFIG.code,
      `--fee-rate ${feeRate} exceeds the safety cap (${MAX_REASONABLE_FEE_RATE} sat/vB)`,
      'Pick a lower rate; if intentional, raise the cap explicitly in the source',
    );
  }
  return Math.floor(numeric).toString();
}

export async function resolveBtcFeeRate(params: {
  impl: string;
  networkId: string;
  accountAddress: string;
  explicitFeeRate?: string;
  tier?: IBtcFeeTier;
}): Promise<string> {
  if (params.explicitFeeRate !== undefined && params.explicitFeeRate !== '') {
    return validateExplicitFeeRate(params.explicitFeeRate, params.impl);
  }
  return fetchBtcFeeRate({
    networkId: params.networkId,
    accountAddress: params.accountAddress,
    tier: params.tier,
  });
}
