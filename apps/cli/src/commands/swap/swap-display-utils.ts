import { ESwapProviderSort } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

import { AppError, ERROR_CODES } from '../../errors';

const SORT_MODE_MAP: Record<string, ESwapProviderSort> = {
  recommended: ESwapProviderSort.RECOMMENDED,
  gas_fee: ESwapProviderSort.GAS_FEE,
  swap_duration: ESwapProviderSort.SWAP_DURATION,
  received: ESwapProviderSort.RECEIVED,
};

export function parseSortMode(input?: string): ESwapProviderSort {
  if (!input) return ESwapProviderSort.RECOMMENDED;
  const mapped = SORT_MODE_MAP[input.toLowerCase()];
  if (!mapped) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CHAIN.code,
      `Invalid sort mode: "${input}"`,
      `Valid modes: ${Object.keys(SORT_MODE_MAP).join(', ')}`,
    );
  }
  return mapped;
}

function formatBadges(quote: IFetchQuoteResult): string {
  const badges: string[] = [];
  if (quote.isBest) badges.push('[Best]');
  if (quote.receivedBest) badges.push('[Receive Most]');
  if (quote.minGasCost) badges.push('[Low Gas]');
  if (quote.approvedInfo?.isApproved) badges.push('[Approved]');
  return badges.join(' ');
}

function formatTime(estimatedTime?: string | number): string {
  if (!estimatedTime) return 'N/A';
  const seconds = Number(estimatedTime);
  if (Number.isNaN(seconds)) return 'N/A';
  if (seconds < 60) return '< 1min';
  return `${Math.ceil(seconds / 60)}min`;
}

function formatGas(fee?: { estimatedFeeFiatValue?: number }): string {
  if (!fee?.estimatedFeeFiatValue) return 'N/A';
  const val = fee.estimatedFeeFiatValue;
  if (val < 0.01) return '< $0.01';
  return `$${val.toFixed(2)}`;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}\u2026`;
}

export function renderQuoteTable(
  sorted: IFetchQuoteResult[],
  toSymbol: string,
  selectedProvider?: string,
): string {
  const header =
    'Provider        Amount               Tags                    Gas Fee     Time';
  const sep = '\u2500'.repeat(header.length);
  const rows = sorted
    .filter((q) => q.toAmount)
    .map((q) => {
      let marker = '';
      if (selectedProvider) {
        marker = q.info.provider === selectedProvider ? '\u25BA' : ' ';
      }
      const prefix = marker ? `${marker} ` : '';
      const provider = truncate(
        q.info.providerName || q.info.provider,
        15,
      ).padEnd(15);
      const amount = `${q.toAmount} ${toSymbol}`.padEnd(20);
      const badges = formatBadges(q).padEnd(23);
      const gas = formatGas(q.fee).padEnd(11);
      const time = formatTime(q.estimatedTime);
      return `${prefix}${provider} ${amount} ${badges} ${gas} ${time}`;
    });

  const best = sorted.find((q) => q.isBest && q.toAmount);
  const footer = best
    ? `\n\u2714 Recommended: ${best.info.providerName || best.info.provider} (${best.toAmount} ${toSymbol})`
    : '';

  return [header, sep, ...rows, footer].join('\n');
}

export function formatRouteHeader(
  fromChainName: string,
  toChainName: string,
): string {
  if (fromChainName === toChainName) {
    return fromChainName;
  }
  return `${fromChainName} \u2192 ${toChainName}`;
}

export function renderBridgeStatus(stateInfo: {
  label: string;
  stage: number;
  total: number;
  isFinal: boolean;
  fromTxHash?: string;
  crossChainReceiveTxHash?: string;
  fromAmount?: string;
  fromSymbol?: string;
  fromChainName?: string;
  toAmount?: string;
  toSymbol?: string;
  toChainName?: string;
}): string {
  const { label, stage, total, fromTxHash, crossChainReceiveTxHash } =
    stateInfo;

  // Progress bar
  const filled = Math.max(0, Math.min(total, stage));
  const bar =
    '\u2588'.repeat(filled * 3) + '\u2591'.repeat((total - filled) * 3);
  const progressHeader = `Status: ${label}  [${bar}] Stage ${stage}/${total}`;

  // Stage lines
  const stageIcon = (s: number) => {
    if (s < stage) return '\u2713';
    if (s === stage) return '\u23F3';
    return '\u2014';
  };
  const stageLabel = (s: number) => {
    if (s < stage) return 'confirmed';
    if (s === stage)
      return label.toLowerCase().includes('pending')
        ? 'pending...'
        : 'in progress';
    return 'waiting';
  };

  const lines = [progressHeader, ''];
  const fromHash = fromTxHash
    ? `  (tx: ${fromTxHash.slice(0, 6)}...${fromTxHash.slice(-4)})`
    : '';
  const toHash = crossChainReceiveTxHash
    ? `  (tx: ${crossChainReceiveTxHash.slice(0, 6)}...${crossChainReceiveTxHash.slice(-4)})`
    : '';

  lines.push(`  Source chain:  ${stageIcon(1)} ${stageLabel(1)}${fromHash}`);
  lines.push(`  Bridge:        ${stageIcon(2)} ${stageLabel(2)}`);
  lines.push(`  Destination:   ${stageIcon(3)} ${stageLabel(3)}${toHash}`);

  if (stateInfo.fromAmount && stateInfo.fromSymbol) {
    lines.push('');
    lines.push(
      `From:  ${stateInfo.fromAmount} ${stateInfo.fromSymbol} (${stateInfo.fromChainName ?? ''})`,
    );
    if (stateInfo.toAmount) {
      lines.push(
        `To:    ~${stateInfo.toAmount} ${stateInfo.toSymbol ?? ''} (${stateInfo.toChainName ?? ''})`,
      );
    }
  }

  return lines.join('\n');
}
