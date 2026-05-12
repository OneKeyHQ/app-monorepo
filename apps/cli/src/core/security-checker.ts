import { AppError, ERROR_CODES } from '../errors';
import { apiClient } from '../infra';

interface ISecurityItem {
  value: boolean | number | string;
  content: string;
  riskType: 'safe' | 'caution' | 'normal' | 'risk';
}

export type ISecurityAuditResult = Record<string, ISecurityItem>;

export interface IAuditSummary {
  data: ISecurityAuditResult;
  isHighRisk: boolean;
  riskItems: string[];
  cautionItems: string[];
}

const HONEYPOT_KEYS = new Set(['is_honeypot', 'cannot_buy', 'cannot_sell_all']);

const VALID_RISK_TYPES = new Set(['safe', 'caution', 'normal', 'risk']);

function isValidSecurityItem(v: unknown): v is ISecurityItem {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    'value' in r &&
    typeof r.content === 'string' &&
    typeof r.riskType === 'string' &&
    VALID_RISK_TYPES.has(r.riskType)
  );
}

function isTruthy(value: boolean | number | string): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const s = String(value).toLowerCase();
  return s === 'yes' || s === 'true' || s === '1';
}

export function classifySecurityData(data: ISecurityAuditResult): {
  isHighRisk: boolean;
  riskItems: string[];
  cautionItems: string[];
} {
  const riskItems: string[] = [];
  const cautionItems: string[] = [];
  for (const [key, raw] of Object.entries(data)) {
    if (!isValidSecurityItem(raw)) {
      throw new AppError(
        ERROR_CODES.NET_HTTP_ERROR.code,
        `Malformed security item for key "${key}": missing value/content/riskType`,
        'This may indicate an API contract change',
      );
    }
    if (raw.riskType === 'risk') riskItems.push(key);
    if (raw.riskType === 'caution') cautionItems.push(key);
    if (HONEYPOT_KEYS.has(key) && isTruthy(raw.value)) riskItems.push(key);
  }

  // TODO: Remove once backend downgrades owner_change_balance for GoPlus-trusted tokens.
  // See useTokenSecurity.ts:40 — App removed client-side trusted_token handling,
  // deferring to backend. This is a temporary CLI workaround because the CLI has
  // no interactive "accept risk" modal — --force is bad UX for USDT/USDC.
  const trustListEntry = data.trust_list;
  if (trustListEntry && String(trustListEntry.value) === 'Yes') {
    const idx = riskItems.indexOf('owner_change_balance');
    if (idx !== -1) {
      riskItems.splice(idx, 1);
      if (!cautionItems.includes('owner_change_balance')) {
        cautionItems.push('owner_change_balance');
      }
    }
  }

  return {
    isHighRisk: new Set(riskItems).size > 0,
    riskItems: [...new Set(riskItems)],
    cautionItems: [...new Set(cautionItems)],
  };
}

export async function auditToken(
  chainId: string,
  contractAddress: string,
): Promise<IAuditSummary> {
  // API failure throws directly (fail-safe) — no catch
  const response = await apiClient.post<Record<string, ISecurityAuditResult>>(
    'utility',
    '/utility/v2/market/token/security/batch',
    {
      tokenAddressList: [{ contractAddress, chainId }],
    },
  );

  // Try original case first, then lowercase (API may return either)
  const data =
    response[contractAddress] ?? response[contractAddress.toLowerCase()];
  if (!data || typeof data !== 'object') {
    throw new AppError(
      ERROR_CODES.NET_HTTP_ERROR.code,
      `Security audit returned no data for ${contractAddress}`,
      'The token may not be indexed — verify the contract address and chain',
    );
  }

  // Empty audit result = no security data available, fail-closed
  if (Object.keys(data).length === 0) {
    throw new AppError(
      ERROR_CODES.NET_HTTP_ERROR.code,
      `Security audit returned empty result for ${contractAddress}`,
      'The token may not have security data available',
    );
  }

  const { isHighRisk, riskItems, cautionItems } = classifySecurityData(data);
  return { data, isHighRisk, riskItems, cautionItems };
}
