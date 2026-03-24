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
}

const HONEYPOT_KEYS = new Set(['is_honeypot', 'cannot_buy', 'cannot_sell_all']);

function isTruthy(value: boolean | number | string): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const s = String(value).toLowerCase();
  return s === 'yes' || s === 'true' || s === '1';
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

  const data = response[contractAddress.toLowerCase()];
  if (!data || typeof data !== 'object') {
    throw new AppError(
      ERROR_CODES.NET_HTTP_ERROR.code,
      `Security audit returned no data for ${contractAddress}`,
      'The token may not be indexed — verify the contract address and chain',
    );
  }

  const riskItems: string[] = [];
  for (const [key, item] of Object.entries(data)) {
    if (item.riskType === 'risk') riskItems.push(key);
    if (HONEYPOT_KEYS.has(key) && isTruthy(item.value)) riskItems.push(key);
  }

  return {
    data,
    isHighRisk: riskItems.length > 0,
    riskItems: [...new Set(riskItems)],
  };
}
