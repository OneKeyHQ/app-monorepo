import networkUtils from './networkUtils';

// Estimated seconds until an incoming transfer is safely confirmed
// (irreversible / exchange-credit level), NOT first block inclusion.
// Values are curated against major exchange confirmation policies.
export const RECEIVE_ARRIVAL_SECONDS_DEFAULT: {
  byImpl: Record<string, number>;
  byNetworkId: Record<string, number>;
} = {
  byImpl: {
    // UTXO / PoW probabilistic finality
    btc: 600,
    bch: 600,
    ltc: 600,
    doge: 600,
    neurai: 600,
    nexa: 600,
    dynex: 600,
    scdo: 600,
    // slow-block probabilistic finality
    ada: 300,
    nervos: 300,
    alph: 300,
    fil: 120,
    // EVM family default (most L2s / side chains); exceptions in byNetworkId
    evm: 60,
    tron: 60,
    // fast DAG / fast finality
    sol: 30,
    kaspa: 30,
    cfx: 30,
    dot: 30,
    // BFT-style single-block finality
    cosmos: 15,
    xrp: 15,
    near: 15,
    aptos: 15,
    sui: 15,
    ton: 15,
    algo: 15,
    stellar: 15,
    bfc: 15,
    neo: 15,
    // payment channel
    lightning: 5,
  },
  byNetworkId: {
    'evm--1': 300, // Ethereum L1
    'evm--137': 180, // Polygon (deep-reorg history)
    'evm--42161': 180, // Arbitrum
    'evm--10001': 600, // EthereumPoW
    'evm--61': 600, // Ethereum Classic
    'evm--314': 120, // Filecoin FEVM
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

// TODO(i18n): unit suffixes are hard-coded pending i18n keys
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
    return `~${Math.ceil(seconds)}s`;
  }
  const minutes = Math.ceil(seconds / 60);
  if (minutes > 60) {
    return '> 60min';
  }
  return `~${minutes}min`;
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
