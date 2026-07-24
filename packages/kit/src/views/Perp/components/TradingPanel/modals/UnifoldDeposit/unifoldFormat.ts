// cspell: words unifold Unifold
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import {
  formatUnifoldTokenAmountValue,
  parseUnifoldExecutionCreatedAtMs,
} from '@onekeyhq/shared/src/utils/unifoldDepositUtils';
import type { IUnifoldDepositExecution } from '@onekeyhq/shared/types/unifoldDeposit';

// `terminal` covers succeeded as well, so it can never stand in for "went
// wrong" — every failure affordance keys on this instead.
export function isUnifoldExecutionFailed(
  execution: IUnifoldDepositExecution,
): boolean {
  return execution.terminal && execution.status !== 'succeeded';
}

// Support references are 36-char UUIDs and never fit a single card line.
export function shortenUnifoldRef(id: string): string {
  if (id.length <= 14) {
    return id;
  }
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

// SDK formatter: ceil(seconds/60) → "< N min"; ≥60min → "< N hr"; null → "< 1 min".
export function formatUnifoldProcessingTime(
  seconds: number | null | undefined,
): string {
  if (!seconds || seconds <= 0) {
    return '< 1 min';
  }
  const mins = Math.ceil(seconds / 60);
  if (mins >= 60) {
    return `< ${Math.ceil(mins / 60)} hr`;
  }
  return `< ${mins} min`;
}

// Amount discipline (contract §4-3): strings end-to-end, null renders as an
// em dash, never 0. Implementation is shared with the bg terminal toast.
export { formatUnifoldUsdAmount as formatUnifoldUsd } from '@onekeyhq/shared/src/utils/unifoldDepositUtils';

export function formatUnifoldTokenAmount({
  baseUnit,
  decimals,
  currency,
}: {
  baseUnit: string | null | undefined;
  decimals: number | null | undefined;
  currency: string | null | undefined;
}): string {
  const rendered = formatUnifoldTokenAmountValue({ baseUnit, decimals });
  if (rendered === null) {
    return '—';
  }
  return currency ? `${rendered} ${currency.toUpperCase()}` : rendered;
}

// The vendor serves every icon as both SVG and PNG under parallel paths
// (/icons/<kind>/svg/x.svg and /icons/<kind>/png/x.png) and the API hands us
// the SVG one. React Native's Image cannot render SVG, so native falls back to
// the PNG variant — the same trick the vendor SDK used for its RN build.
// Web keeps the SVG (sharper, and <img> handles it).
export function normalizeUnifoldIconUrl(
  url: string | null | undefined,
): string | undefined {
  if (!url) {
    return undefined;
  }
  if (!platformEnv.isNative || !url.endsWith('.svg')) {
    return url;
  }
  return url.replace('/svg/', '/png/').replace(/\.svg$/, '.png');
}

// Chain display names, mirroring the vendor SDK: EVM chains are named by
// chainId, everything else falls back to its chain type.
const EVM_CHAIN_NAMES: Record<string, string> = {
  '1': 'Ethereum',
  '10': 'Optimism',
  '56': 'BSC',
  '137': 'Polygon',
  '999': 'HyperEVM',
  '1337': 'HyperCore',
  '4326': 'MegaETH',
  '4663': 'Robinhood Chain',
  '8453': 'Base',
  '42161': 'Arbitrum',
};

const CHAIN_TYPE_NAMES: Record<string, string> = {
  solana: 'Solana',
  bitcoin: 'Bitcoin',
  cardano: 'Cardano',
  algorand: 'Algorand',
  xrpl: 'XRPL',
  n1: 'N1',
};

export function formatUnifoldChainName({
  chainType,
  chainId,
}: {
  chainType: string | null | undefined;
  chainId: string | null | undefined;
}): string {
  if (chainId && EVM_CHAIN_NAMES[chainId]) {
    return EVM_CHAIN_NAMES[chainId];
  }
  if (chainType && CHAIN_TYPE_NAMES[chainType.toLowerCase()]) {
    return CHAIN_TYPE_NAMES[chainType.toLowerCase()];
  }
  return chainType || '—';
}

// Shares the bg loop's parser: `createdAt` has no pinned format (epoch
// seconds, epoch ms, or a date string), and `new Date('1753248000')` is an
// Invalid Date. Parsing it differently here would have shown a dash on every
// row while the bg discovery window read the same field correctly.
export function formatUnifoldExecutionDate(
  createdAt: string | null | undefined,
): string {
  const parsedMs = parseUnifoldExecutionCreatedAtMs(createdAt);
  if (parsedMs === null) {
    return '—';
  }
  try {
    return formatDate(new Date(parsedMs));
  } catch {
    return '—';
  }
}
