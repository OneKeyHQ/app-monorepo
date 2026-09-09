import { ETranslations } from '../locale';
import { appLocale } from '../locale/appLocale';

import networkUtils from './networkUtils';

// Estimated seconds until an incoming transfer is safely confirmed
// (irreversible / exchange-credit level), NOT first block inclusion.
// Values are curated against major exchange confirmation policies and
// were calibrated on 2026-07-06 against Binance's live deposit policy
// (GET /sapi/v1/capital/config/getall, minConfirm × block interval).
export const RECEIVE_ARRIVAL_SECONDS_DEFAULT: {
  byImpl: Record<string, number>;
  byNetworkId: Record<string, number>;
} = {
  byImpl: {
    // UTXO / PoW probabilistic finality
    btc: 600, // Binance 1 conf × 600s
    bch: 1200, // Binance 2 conf × 600s
    ltc: 600, // Binance 3 conf × 150s ≈ 8 min
    doge: 600, // Binance 6 conf × 60s = 6 min (kept conservative)
    neurai: 600,
    nexa: 600,
    dynex: 600,
    scdo: 600,
    // slow-block probabilistic finality
    ada: 600, // Binance 30 conf × 20s
    nervos: 300, // Binance 12 conf × 10s = 2 min (kept conservative)
    alph: 300, // no Binance anchor
    fil: 1800, // Binance 60 conf × 30s
    // EVM family default (most L2s / side chains); exceptions in byNetworkId
    evm: 60,
    tron: 60, // Binance 1 conf; solidification ~57s
    // fast DAG / fast finality
    sol: 30, // Binance 1 rooted slot
    kaspa: 30, // no Binance anchor
    dot: 30, // Binance 3 conf via Asset Hub ≈ 18s
    cfx: 240, // Binance 400 conf × ~0.5s
    // BFT-style single-block finality
    cosmos: 60, // Binance 10 conf × 6s (ATOM)
    xrp: 15,
    near: 15,
    aptos: 15,
    sui: 15,
    ton: 15,
    algo: 15,
    stellar: 15,
    bfc: 15,
    neo: 90, // Binance 5 conf × 15s
    // payment channel
    lightning: 5,
  },
  byNetworkId: {
    'evm--1': 300, // Ethereum L1: Binance credit 6 conf / unlock 64 conf
    'evm--137': 300, // Polygon: Binance 200 conf × ~2s ≈ 7 min
    'evm--42161': 180, // Arbitrum (conservative vs Binance 120 conf × 0.25s)
    'evm--10001': 3900, // EthereumPoW: Binance 300 conf × 13s ≈ 65 min
    'evm--61': 1800, // Ethereum Classic: Binance 70 conf ≈ 15 min, OKX ~46 min
    'evm--314': 1800, // Filecoin FEVM (same consensus as fil)
  },
};

// Server-delivered override config. Must be fetched as a standalone map —
// never embedded in the network list payload (preset networks win the
// getNetworks merge and would drop server-only fields).
export type IReceiveArrivalTimeOverride = {
  version?: number;
  byNetworkId?: Record<string, number>;
  byImpl?: Record<string, number>;
};

function lookupArrivalSeconds(
  map: Record<string, number> | undefined,
  key: string,
): { hit: true; seconds: number | null } | { hit: false } {
  if (!map || !Object.prototype.hasOwnProperty.call(map, key)) {
    return { hit: false };
  }
  const value = map[key];
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    // malformed entry: ignore this layer, fall through to the next
    return { hit: false };
  }
  if (value === 0) {
    // explicit 0 means force-hide, overriding bundled defaults
    return { hit: true, seconds: null };
  }
  return { hit: true, seconds: value };
}

export function resolveReceiveArrivalSeconds({
  networkId,
  isTestnet,
  isCustomNetwork,
  override,
}: {
  networkId: string | undefined;
  isTestnet?: boolean;
  isCustomNetwork?: boolean;
  override?: IReceiveArrivalTimeOverride;
}): number | null {
  if (!networkId || isTestnet || isCustomNetwork) {
    return null;
  }
  const impl = networkUtils.getNetworkImpl({ networkId });
  const layers: Array<{
    map: Record<string, number> | undefined;
    key: string;
  }> = [
    { map: override?.byNetworkId, key: networkId },
    { map: override?.byImpl, key: impl },
    { map: RECEIVE_ARRIVAL_SECONDS_DEFAULT.byNetworkId, key: networkId },
    { map: RECEIVE_ARRIVAL_SECONDS_DEFAULT.byImpl, key: impl },
  ];
  for (const layer of layers) {
    const result = lookupArrivalSeconds(layer.map, layer.key);
    if (result.hit) {
      return result.seconds;
    }
  }
  return null;
}

export function formatReceiveArrivalTime({
  seconds,
}: {
  seconds: number | null | undefined;
}): string | undefined {
  if (
    typeof seconds !== 'number' ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return undefined;
  }
  if (seconds < 60) {
    return appLocale.intl.formatMessage(
      { id: ETranslations.receive_arrival_time_sec },
      { number: Math.ceil(seconds) },
    );
  }
  const minutes = Math.ceil(seconds / 60);
  if (minutes > 60) {
    return appLocale.intl.formatMessage(
      { id: ETranslations.receive_arrival_time_over_min },
      { number: 60 },
    );
  }
  return appLocale.intl.formatMessage(
    { id: ETranslations.receive_arrival_time_min },
    { number: minutes },
  );
}

export function getReceiveArrivalTimeText(params: {
  networkId: string | undefined;
  isTestnet?: boolean;
  isCustomNetwork?: boolean;
  override?: IReceiveArrivalTimeOverride;
}): string | undefined {
  return formatReceiveArrivalTime({
    seconds: resolveReceiveArrivalSeconds(params),
  });
}
