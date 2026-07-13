import type { IUtxoInfo } from '../../../types';

export function buildUtxoKey(utxo: IUtxoInfo): string {
  return `${utxo.txid}:${utxo.vout}`;
}

// claimed relPaths are always "0/<index>" (receive branch only), anything
// else in the map is stale data and must never reach the server
const FIND_ADDRESS_REL_PATH_REGEX = /^0\/\d+$/;

// build the `accountAddressArray` param attached to history list/detail
// requests so the server can merge claimed (find-address) addresses into
// the xpub-derived address set. Sorted by claimed index so the value is
// deterministic (stable server-side cache key), never truncated: silently
// dropping claimed addresses makes their txs vanish from history. When
// `txInvolvedAddresses` is provided (detail requests with tx context) the
// set is narrowed to the claimed addresses the tx actually involves; an
// empty intersection falls back to the full claimed set because it may
// just mean the decoded tx data was incomplete, and the full set is
// always a safe superset server-side.
export function buildAccountAddressArrayParam({
  findAddresses,
  txInvolvedAddresses,
}: {
  findAddresses: Record<string, string> | undefined;
  txInvolvedAddresses?: string[];
}): string[] | undefined {
  let addresses = Object.entries(findAddresses || {})
    .filter(
      ([relPath, address]) =>
        FIND_ADDRESS_REL_PATH_REGEX.test(relPath) && !!address,
    )
    .toSorted(([a], [b]) => Number(a.split('/')[1]) - Number(b.split('/')[1]))
    .map(([, address]) => address);
  addresses = Array.from(new Set(addresses));
  if (!addresses.length) {
    return undefined;
  }
  if (txInvolvedAddresses?.length) {
    const involvedSet = new Set(txInvolvedAddresses);
    const involved = addresses.filter((address) => involvedSet.has(address));
    if (involved.length) {
      addresses = involved;
    }
  }
  return addresses;
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
