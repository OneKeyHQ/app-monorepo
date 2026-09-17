import { useCallback, useEffect, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAddressQueryResult } from '@onekeyhq/kit/src/components/AddressInput';
import { isReusableLightningRecipient } from '@onekeyhq/shared/src/utils/lnUrlUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IAddressBadge } from '@onekeyhq/shared/types/address';
import type {
  ITransferRecipient,
  ITransferRecipientBadge,
} from '@onekeyhq/shared/types/history';

const MAX_RECIPIENTS = 20;

type IRecipientBadgeData = Pick<
  IAddressQueryResult,
  'isContract' | 'isCex' | 'isScam' | 'addressBadges'
>;

type IRecipientExtraInfo = {
  address: string;
  time: number;
  networkName?: string;
  memo?: string;
  badgeData?: IRecipientBadgeData;
};

export type IEnrichedRecentRecipient = IAddressQueryResult & {
  lastTransferTime?: number;
  lastTransferNetworkName?: string;
  isAddressBook?: boolean;
  recipientMemo?: string;
};

async function fetchNetworkNames(networkIds: string[]) {
  const networkNameMap = new Map<string, string>();
  await Promise.all(
    networkIds.map(async (nid) => {
      const network = await backgroundApiProxy.serviceNetwork.getNetworkSafe({
        networkId: nid,
      });
      if (network?.name) {
        networkNameMap.set(nid, network.name);
      }
    }),
  );
  return networkNameMap;
}

const TRANSFER_RECIPIENT_BADGE_TYPE_MAP: Record<string, IAddressBadge['type']> =
  {
    contract: 'warning',
    warning: 'warning',
    critical: 'critical',
    success: 'success',
    info: 'info',
    default: 'default',
  };

function convertTransferRecipientBadges(
  badges?: ITransferRecipientBadge[],
): IAddressBadge[] {
  if (!badges?.length) return [];
  return badges.map((b) => ({
    label: b.title,
    type: TRANSFER_RECIPIENT_BADGE_TYPE_MAP[b.type] ?? 'default',
    tip: b.tip,
    icon: b.icon as IAddressBadge['icon'],
  }));
}

async function buildExtraMapFromApiRecipients(
  apiRecipients: ITransferRecipient[],
) {
  const uniqueNetworkIds = [
    ...new Set(
      apiRecipients.map((r) => r.networkId).filter((id): id is string => !!id),
    ),
  ];
  const networkNameMap = await fetchNetworkNames(uniqueNetworkIds);

  return new Map(
    apiRecipients.map((r) => [
      r.address.toLowerCase(),
      {
        address: r.address,
        time: r.time,
        networkName: r.networkId ? networkNameMap.get(r.networkId) : undefined,
        memo: r.memo,
        // Present when the API returns badge fields (isContract / isCex / badges).
        // Older server versions omit these, so we guard on `isContract`.
        badgeData:
          r.isContract !== undefined
            ? {
                isContract: r.isContract,
                isCex: r.isCex,
                isScam: r.isScam,
                addressBadges: convertTransferRecipientBadges(r.badges),
              }
            : undefined,
      },
    ]),
  );
}

function processQueryResults(
  results: IAddressQueryResult[],
  extraMap: Map<string, IRecipientExtraInfo> | null,
): IEnrichedRecentRecipient[] {
  return results
    .filter((result) => !result.isContract && !result.isScam)
    .map((result) => {
      const addressLower = result.input?.toLowerCase() ?? '';
      const extraInfo = extraMap?.get(addressLower);
      return {
        ...result,
        lastTransferTime: extraInfo?.time,
        lastTransferNetworkName: extraInfo?.networkName,
        isAddressBook: !!result.addressBookId,
        recipientMemo: extraInfo?.memo,
      };
    })
    .filter(
      (result) =>
        !result.recipientMemo || !result.recipientMemo.startsWith('Call:'),
    )
    .toSorted((a, b) => (b.lastTransferTime ?? 0) - (a.lastTransferTime ?? 0));
}

async function enrichAddresses(
  addresses: string[],
  extraMap: Map<string, IRecipientExtraInfo> | null,
  networkId: string,
): Promise<IEnrichedRecentRecipient[]> {
  if (addresses.length === 0) return [];

  const filteredAddresses = networkUtils.isLightningNetworkByNetworkId(
    networkId,
  )
    ? addresses.filter((addr) => isReusableLightningRecipient(addr))
    : addresses;

  if (filteredAddresses.length === 0) return [];

  const addressInfoResults = await Promise.all(
    filteredAddresses.map((recipient) =>
      backgroundApiProxy.serviceAccountProfile.queryAddress({
        networkId,
        address: recipient,
        enableAddressBook: true,
        enableWalletName: true,
        enableAddressDeriveInfo: true,
        // Don't trigger /badges API calls for the quick-select list. Badge
        // data (isContract / isCex / isScam) is only needed after the user
        // picks an address — AddressInput does its own queryAddress with
        // full flags at that point. When transfer-recipient API provides
        // badge data (EVM / BTC), it's merged from extraMap below without
        // an extra request. For unsupported chains (Solana / Lightning)
        // this avoids N parallel /badges calls on page open.
        enableAddressContract: false,
        skipValidateAddress: true,
      }),
    ),
  );

  const mergedResults = addressInfoResults.map((result) => {
    const addressLower = result.input?.toLowerCase() ?? '';
    const badgeData = extraMap?.get(addressLower)?.badgeData;
    if (badgeData) {
      return {
        ...result,
        isContract: badgeData.isContract,
        isCex: badgeData.isCex,
        isScam: badgeData.isScam,
        addressBadges: badgeData.addressBadges,
      };
    }
    return result;
  });

  return processQueryResults(mergedResults, extraMap);
}

// Local store fallback + freshness overlay for /transfer-recipient, which
// has indexer lag and skips non-indexer EVM chains (OK-52728).
async function loadStoredRecipients({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}): Promise<{
  addresses: string[];
  extraMap: Map<string, IRecipientExtraInfo> | null;
}> {
  try {
    const storedRecipients =
      await backgroundApiProxy.serviceSignatureConfirm.getRecentRecipients({
        networkId,
        accountId,
      });
    if (storedRecipients.length === 0) {
      return { addresses: [], extraMap: null };
    }

    const uniqueNetworkIds = [
      ...new Set(
        storedRecipients
          .map((r) => r.networkId)
          .filter((id): id is string => !!id),
      ),
    ];
    const networkNameMap = await fetchNetworkNames(uniqueNetworkIds);

    const extraMap = new Map<string, IRecipientExtraInfo>(
      storedRecipients.map((r) => [
        r.address.toLowerCase(),
        {
          address: r.address,
          time: r.updatedAt,
          networkName: r.networkId
            ? networkNameMap.get(r.networkId)
            : undefined,
          memo: r.memo,
        },
      ]),
    );
    return {
      addresses: storedRecipients.map((r) => r.address),
      extraMap,
    };
  } catch {
    return { addresses: [], extraMap: null };
  }
}

type IUseRecentRecipientsDataParams = {
  accountId?: string;
  networkId: string;
  refreshKey?: number;
};

type IRecentRecipientsCacheEntry = {
  recipients: IEnrichedRecentRecipient[];
  lastUsedDeriveType?: string;
  // The server reported /transfer-recipient as unsupported for this
  // network, so later loads skip the round trip and read the local store.
  apiUnsupported: boolean;
};

// Last successful /transfer-recipient answer, persisted by ServiceHistory.
// On a cold start (no session cache yet) it is enriched locally and painted
// at once so the Recent tab does not wait for the server round trip; the
// API refresh that follows replaces it (OK-63452).
async function loadPersistedApiRecipients({
  accountId,
  apiNetworkId,
  networkId,
}: {
  accountId: string;
  apiNetworkId: string;
  networkId: string;
}): Promise<IRecentRecipientsCacheEntry | undefined> {
  try {
    const persisted =
      await backgroundApiProxy.serviceHistory.getCachedTransferRecipients({
        accountId,
        networkId: apiNetworkId,
        limit: MAX_RECIPIENTS,
      });
    if (!persisted?.data?.length) {
      return undefined;
    }
    const extraMap = await buildExtraMapFromApiRecipients(persisted.data);
    const recipients = await enrichAddresses(
      persisted.data.map((r) => r.address),
      extraMap,
      networkId,
    );
    return {
      recipients,
      lastUsedDeriveType: persisted.lastUsedDeriveType,
      apiUnsupported: false,
    };
  } catch {
    return undefined;
  }
}

// Last completed load per account + network, kept for the app session so a
// re-opened Send page paints the previous list at once while a refresh runs
// in the background (stale-while-revalidate).
const recentRecipientsCache = new Map<string, IRecentRecipientsCacheEntry>();

// Latest load version per cache key, shared by every hook instance, so a
// slower load started by an earlier Send page cannot overwrite the cache
// with an older answer after a newer load has committed.
const recentRecipientsLoadVersion = new Map<string, number>();

function getRecentRecipientsCacheKey({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  return `${accountId}__${networkId}`;
}

export function clearRecentRecipientsCache() {
  recentRecipientsCache.clear();
  recentRecipientsLoadVersion.clear();
}

export function useRecentRecipientsData({
  accountId,
  networkId,
  refreshKey,
}: IUseRecentRecipientsDataParams) {
  const initialCacheEntry = accountId
    ? recentRecipientsCache.get(
        getRecentRecipientsCacheKey({ accountId, networkId }),
      )
    : undefined;
  const [recentRecipients, setRecentRecipients] = useState<
    IEnrichedRecentRecipient[]
  >(() => initialCacheEntry?.recipients ?? []);
  const [isLoadingRecent, setIsLoadingRecent] = useState(!initialCacheEntry);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastUsedDeriveType, setLastUsedDeriveType] = useState<
    string | undefined
  >(() => initialCacheEntry?.lastUsedDeriveType);
  const loadIdRef = useRef(0);

  const load = useCallback(async () => {
    loadIdRef.current += 1;
    const currentLoadId = loadIdRef.current;

    setIsLoadingMore(false);

    if (!accountId) {
      setRecentRecipients([]);
      setLastUsedDeriveType(undefined);
      setIsLoadingRecent(false);
      return;
    }

    const cacheKey = getRecentRecipientsCacheKey({ accountId, networkId });
    const loadVersion = (recentRecipientsLoadVersion.get(cacheKey) ?? 0) + 1;
    recentRecipientsLoadVersion.set(cacheKey, loadVersion);
    // Stale when this instance started a newer load or unmounted; such a
    // load must neither update state nor write the shared cache.
    const isStale = () => loadIdRef.current !== currentLoadId;
    // Another instance may have started a newer load for the same account +
    // network. This load may still paint its own screen (so an abandoned
    // newer load never strands it on a skeleton), but it must not overwrite
    // the shared cache with an older answer.
    const isLatestVersion = () =>
      recentRecipientsLoadVersion.get(cacheKey) === loadVersion;

    const isEvmNetwork = networkUtils.isEvmNetwork({ networkId });
    const apiNetworkId = isEvmNetwork ? 'evm--1' : networkId;

    const fetchApiRecipients = () =>
      backgroundApiProxy.serviceHistory.fetchTransferRecipients({
        accountId,
        networkId: apiNetworkId,
        limit: MAX_RECIPIENTS,
      });

    let cached = recentRecipientsCache.get(cacheKey);
    let apiPromise: ReturnType<typeof fetchApiRecipients> | undefined;
    if (cached) {
      setRecentRecipients(cached.recipients);
      setLastUsedDeriveType(cached.lastUsedDeriveType);
      setIsLoadingRecent(false);
    } else {
      setIsLoadingRecent(true);
      setRecentRecipients([]);
      setLastUsedDeriveType(undefined);
      // Cold start: the API request does not depend on the persisted answer,
      // so start it now and let the round trip overlap the local enrichment
      // of the persisted list. Rejections are observed in Phase 1 below; the
      // no-op catch only keeps an early stale return from leaving it
      // unhandled.
      apiPromise = fetchApiRecipients();
      apiPromise.catch(() => undefined);
      const persisted = await loadPersistedApiRecipients({
        accountId,
        apiNetworkId,
        networkId,
      });
      if (isStale()) return;
      if (persisted) {
        cached = persisted;
        // Seed the session cache so a failed refresh still leaves the next
        // mount with an instant paint instead of replaying the cold path.
        if (isLatestVersion()) {
          recentRecipientsCache.set(cacheKey, persisted);
        }
        setRecentRecipients(persisted.recipients);
        setLastUsedDeriveType(persisted.lastUsedDeriveType);
        setIsLoadingRecent(false);
      }
    }

    const commit = (entry: IRecentRecipientsCacheEntry) => {
      if (isLatestVersion()) {
        recentRecipientsCache.set(cacheKey, entry);
      }
      setRecentRecipients(entry.recipients);
      setLastUsedDeriveType(entry.lastUsedDeriveType);
      setIsLoadingRecent(false);
    };

    let apiUnsupported = cached?.apiUnsupported ?? false;
    let apiFailed = false;

    // Phase 1: try the indexer API. When the API is supported, it is the
    // single source of truth — we do not fall back to local storage or
    // chain history to avoid mixing sources (OK-53284). If the API is
    // not supported for this chain (or the call fails), drop to the
    // local fallback below. A network the server already reported as
    // unsupported this session skips the round trip entirely.
    if (!apiUnsupported) {
      try {
        const {
          supported,
          data: apiRecipients,
          lastUsedDeriveType: apiDeriveType,
          errored,
        } = await (apiPromise ?? fetchApiRecipients());
        if (isStale()) return;

        if (supported) {
          const apiExtraMap =
            await buildExtraMapFromApiRecipients(apiRecipients);
          if (isStale()) return;

          const enriched = await enrichAddresses(
            apiRecipients.map((r) => r.address),
            apiExtraMap,
            networkId,
          );
          if (isStale()) return;

          commit({
            recipients: enriched,
            lastUsedDeriveType: apiDeriveType,
            apiUnsupported: false,
          });
          return;
        }
        // Only a server-side "unsupported" answer is memoized; a failed
        // request must be retried on the next load.
        apiUnsupported = !errored;
        apiFailed = Boolean(errored);
      } catch {
        // API call failed — fall through to local fallback.
        apiFailed = true;
      }
    }

    // A thrown request skips the in-try stale checks, so guard here before
    // touching state: this instance may have moved on to another network.
    if (isStale()) return;

    // A failed background refresh keeps the cached API list on screen (it
    // was applied at the start of this load); the local store is only a
    // substitute for a cold load or for a network the server reported as
    // unsupported (OK-53284: never mix sources).
    if (apiFailed && cached && !cached.apiUnsupported) {
      return;
    }

    // Phase 2: indexer API not supported — show only locally-confirmed
    // send recipients. These are recorded by TxConfirmActions after a
    // successful send, so they're always real user-initiated transfers,
    // never DApp contract interactions.
    //
    // We intentionally skip Phase 3 (chain tx history) here. Chain history
    // includes ALL outgoing transactions — swaps, approvals, contract
    // calls — which can pollute the list with program/contract addresses
    // (especially on Solana / Aptos where we can't cheaply distinguish
    // contracts from EOAs without a badge API call per address). The local
    // store is a clean, curated source that only grows when the user sends
    // via OneKey's send flow.
    const { addresses: storedAddresses, extraMap: storedExtraMap } =
      await loadStoredRecipients({ networkId, accountId });
    if (isStale()) return;

    let storedRecipients: IEnrichedRecentRecipient[] = [];
    if (storedAddresses.length > 0) {
      try {
        storedRecipients = await enrichAddresses(
          storedAddresses,
          storedExtraMap,
          networkId,
        );
      } catch {
        // ignore enrichment errors
      }
    }

    if (isStale()) return;
    commit({ recipients: storedRecipients, apiUnsupported });
    setIsLoadingMore(false);
  }, [accountId, networkId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  // Invalidate this instance's in-flight load on unmount so it can neither
  // update state nor write the shared cache after the page has closed.
  useEffect(
    () => () => {
      loadIdRef.current += 1;
    },
    [],
  );

  return {
    recentRecipients,
    isLoadingRecent,
    isLoadingMore,
    lastUsedDeriveType,
  };
}
