import type { IUtxoInfo } from '../../../types';

export function buildUtxoKey(utxo: IUtxoInfo): string {
  return `${utxo.txid}:${utxo.vout}`;
}

// merge claimed (find-address) relPath entries into an address→path map
// used by signing flows. pool-resolved entries always win so a claimed
// address that was already discovered by the gap scan keeps its pool path.
export function appendClaimedAddressPaths({
  addressPathMap,
  accountPath,
  findAddresses,
  filterAddresses,
}: {
  addressPathMap: Record<string, string>;
  accountPath: string;
  findAddresses: Record<string, string> | undefined;
  filterAddresses?: (address: string) => boolean;
}): Record<string, string> {
  Object.entries(findAddresses || {}).forEach(([relPath, claimedAddress]) => {
    if (
      !addressPathMap[claimedAddress] &&
      (!filterAddresses || filterAddresses(claimedAddress))
    ) {
      addressPathMap[claimedAddress] = `${accountPath}/${relPath}`;
    }
  });
  return addressPathMap;
}

// merge claimed (find-address) UTXOs into a gap-scanned UTXO list,
// a claimed address that later got discovered by the gap scan is already
// part of the main list, dedupe by txid:vout and prefer the main entry
export function mergeClaimedUtxos({
  poolUtxos,
  claimedUtxos,
}: {
  poolUtxos: IUtxoInfo[];
  claimedUtxos: IUtxoInfo[];
}): IUtxoInfo[] {
  if (!claimedUtxos.length) {
    return poolUtxos;
  }
  const existingUtxoKeys = new Set(poolUtxos.map(buildUtxoKey));
  return poolUtxos.concat(
    claimedUtxos.filter((utxo) => !existingUtxoKeys.has(buildUtxoKey(utxo))),
  );
}

// build the candidate UTXO pool for a btc send.
// SAFETY INVARIANT: claimed (find-address) UTXOs must NEVER enter the pool
// of a send without an explicit coin-control selection, otherwise the coin
// selector could silently spend hidden funds (including Send Max).
export function buildBtcSendUtxoPool({
  poolUtxos,
  claimedUtxos,
  selectedUtxoKeys,
}: {
  poolUtxos: IUtxoInfo[];
  claimedUtxos: IUtxoInfo[];
  selectedUtxoKeys: string[] | undefined;
}): IUtxoInfo[] {
  const hasSelectedUtxos = Boolean(selectedUtxoKeys?.length);
  if (!hasSelectedUtxos) {
    // defense in depth: drop claimed UTXOs even if a caller injected them
    return poolUtxos.filter((utxo) => !utxo.isCustomClaimed);
  }
  return mergeClaimedUtxos({ poolUtxos, claimedUtxos });
}
