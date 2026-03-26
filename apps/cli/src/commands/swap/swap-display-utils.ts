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
