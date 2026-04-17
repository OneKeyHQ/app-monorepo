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

export function useRecentRecipientsData({
  accountId,
  networkId,
  refreshKey,
}: IUseRecentRecipientsDataParams) {
  const [recentRecipients, setRecentRecipients] = useState<
    IEnrichedRecentRecipient[]
  >([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastUsedDeriveType, setLastUsedDeriveType] = useState<
    string | undefined
  >();
  const loadIdRef = useRef(0);

  const load = useCallback(async () => {
    loadIdRef.current += 1;
    const currentLoadId = loadIdRef.current;
    const isStale = () => loadIdRef.current !== currentLoadId;

    setIsLoadingRecent(true);
    setIsLoadingMore(false);
    setRecentRecipients([]);
    setLastUsedDeriveType(undefined);

    if (!accountId) {
      setIsLoadingRecent(false);
      return;
    }

    const isEvmNetwork = networkUtils.isEvmNetwork({ networkId });

    // Phase 1: try the indexer API. When the API is supported, it is the
    // single source of truth — we do not fall back to local storage or
    // chain history to avoid mixing sources (OK-53284). If the API is
    // not supported for this chain (or the call fails), drop to the
    // local fallback below.
    const apiNetworkId = isEvmNetwork ? 'evm--1' : networkId;
    try {
      const {
        supported,
        data: apiRecipients,
        lastUsedDeriveType: apiDeriveType,
      } = await backgroundApiProxy.serviceHistory.fetchTransferRecipients({
        accountId,
        networkId: apiNetworkId,
        limit: MAX_RECIPIENTS,
      });
      if (isStale()) return;

      if (supported) {
        if (apiDeriveType) setLastUsedDeriveType(apiDeriveType);

        const apiExtraMap = await buildExtraMapFromApiRecipients(apiRecipients);
        if (isStale()) return;

        const enriched = await enrichAddresses(
          apiRecipients.map((r) => r.address),
          apiExtraMap,
          networkId,
        );
        if (isStale()) return;

        setRecentRecipients(enriched);
        setIsLoadingRecent(false);
        return;
      }
    } catch {
      // API call failed — fall through to local fallback.
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

    if (storedAddresses.length > 0) {
      try {
        const enriched = await enrichAddresses(
          storedAddresses,
          storedExtraMap,
          networkId,
        );
        if (isStale()) return;
        setRecentRecipients(enriched);
      } catch {
        // ignore enrichment errors
      }
    }

    if (isStale()) return;
    setIsLoadingRecent(false);
    setIsLoadingMore(false);
  }, [accountId, networkId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return {
    recentRecipients,
    isLoadingRecent,
    isLoadingMore,
    lastUsedDeriveType,
  };
}
