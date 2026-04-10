import { useCallback, useEffect, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAddressQueryResult } from '@onekeyhq/kit/src/components/AddressInput';
import { checkIsScamTx } from '@onekeyhq/shared/src/utils/historyUtils';
import { isReusableLightningRecipient } from '@onekeyhq/shared/src/utils/lnUrlUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  IAccountHistoryTx,
  ITransferRecipient,
} from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

const MAX_RECIPIENTS = 20;

type IRecipientExtraInfo = {
  address: string;
  time: number;
  networkName?: string;
  memo?: string;
};

function hasPositiveTransferAmount(amount?: string) {
  if (!amount) return false;
  const amountBN = new BigNumber(amount);
  return !amountBN.isNaN() && amountBN.gt(0);
}

function getRecipientMemoFromDecodedTx(decodedTx: IDecodedTx) {
  const extra = decodedTx.extraInfo as Record<string, unknown> | null;
  if (!extra) {
    return undefined;
  }
  return (
    (extra.memo as string) ??
    (extra.note as string) ??
    (extra.destinationTag !== null && extra.destinationTag !== undefined
      ? String(extra.destinationTag)
      : undefined)
  );
}

function extractOutgoingRecipientFromDecodedTx({
  decodedTx,
  ownerAddress,
  includeMemo,
}: {
  decodedTx: IDecodedTx;
  ownerAddress?: string;
  includeMemo?: boolean;
}) {
  // Skip receive transactions: if tx owner differs from our address, not outgoing
  const txOwner = decodedTx.owner?.toLowerCase();
  if (ownerAddress && txOwner && txOwner !== ownerAddress) {
    return undefined;
  }

  let recipient: string | undefined;
  let hasOutgoingSend = false;
  let hasNonZeroAmount = false;

  for (const action of decodedTx.actions ?? []) {
    if (action.functionCall) {
      // eslint-disable-next-line no-continue
      continue;
    }

    const assetTransfer = action.assetTransfer;
    if (!assetTransfer) {
      // eslint-disable-next-line no-continue
      continue;
    }

    const firstSend = assetTransfer.sends?.[0];
    if (firstSend) {
      // UTXO chains: sends[0].from may be a change address; trust the
      // tx-level owner check and only fall back to per-send filter.
      if (!txOwner) {
        const senderAddress = firstSend.from?.toLowerCase();
        if (senderAddress && ownerAddress && senderAddress !== ownerAddress) {
          // eslint-disable-next-line no-continue
          continue;
        }
      }
      hasOutgoingSend = true;
      if (hasPositiveTransferAmount(firstSend.amount)) {
        hasNonZeroAmount = true;
      }
      if (!recipient && firstSend.to) {
        recipient = firstSend.to;
      }
    }

    if (hasOutgoingSend && !recipient && assetTransfer.to) {
      recipient = assetTransfer.to;
    }

    if (recipient) {
      break;
    }
  }

  if (hasOutgoingSend && !recipient && decodedTx.to) {
    recipient = decodedTx.to;
  }

  if (!hasOutgoingSend || !hasNonZeroAmount || !recipient) {
    return undefined;
  }

  if (ownerAddress && recipient.toLowerCase() === ownerAddress) {
    return undefined;
  }

  return {
    address: recipient,
    time: decodedTx.updatedAt ?? decodedTx.createdAt ?? 0,
    memo: includeMemo ? getRecipientMemoFromDecodedTx(decodedTx) : undefined,
  };
}

function collectRecipientsFromHistoryTxs({
  txs,
  ownerAddress,
  networkName,
  includeMemo,
  seedMap,
}: {
  txs: IAccountHistoryTx[];
  ownerAddress?: string;
  networkName?: string;
  includeMemo?: boolean;
  seedMap?: Map<string, IRecipientExtraInfo>;
}) {
  const recipientMap = seedMap
    ? new Map<string, IRecipientExtraInfo>(seedMap)
    : new Map<string, IRecipientExtraInfo>();

  for (const tx of txs) {
    if (checkIsScamTx({ tx })) {
      // eslint-disable-next-line no-continue
      continue;
    }

    const { decodedTx } = tx;
    if (!decodedTx) {
      if (recipientMap.size >= MAX_RECIPIENTS) break;
      // eslint-disable-next-line no-continue
      continue;
    }
    if (
      decodedTx.status === EDecodedTxStatus.Failed ||
      decodedTx.status === EDecodedTxStatus.Dropped
    ) {
      // eslint-disable-next-line no-continue
      continue;
    }

    const recipientInfo = extractOutgoingRecipientFromDecodedTx({
      decodedTx,
      ownerAddress,
      includeMemo,
    });
    if (!recipientInfo) {
      // eslint-disable-next-line no-continue
      continue;
    }

    const recipientLower = recipientInfo.address.toLowerCase();
    if (!recipientMap.has(recipientLower)) {
      if (recipientMap.size >= MAX_RECIPIENTS) break;
      recipientMap.set(recipientLower, {
        address: recipientInfo.address,
        time: recipientInfo.time,
        networkName,
        memo: recipientInfo.memo,
      });
    } else if (includeMemo && recipientInfo.memo) {
      const existing = recipientMap.get(recipientLower);
      if (existing && !existing.memo) {
        existing.memo = recipientInfo.memo;
      }
    }
  }

  return recipientMap;
}

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
        enableAddressContract: true,
        skipValidateAddress: true,
      }),
    ),
  );

  return processQueryResults(addressInfoResults, extraMap);
}

function mergeRecipients(
  existing: IEnrichedRecentRecipient[],
  incoming: IEnrichedRecentRecipient[],
): IEnrichedRecentRecipient[] {
  const seen = new Set(
    existing.map((r) => r.input?.toLowerCase()).filter(Boolean),
  );
  const merged = [...existing];
  for (const item of incoming) {
    const key = item.input?.toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }
  return merged
    .toSorted((a, b) => (b.lastTransferTime ?? 0) - (a.lastTransferTime ?? 0))
    .slice(0, MAX_RECIPIENTS);
}

// Local store fallback + freshness overlay for /transfer-recipient, which
// has indexer lag and skips non-indexer EVM chains (OK-52728).
async function loadStoredRecipients(networkId: string): Promise<{
  addresses: string[];
  extraMap: Map<string, IRecipientExtraInfo> | null;
}> {
  try {
    const storedRecipients =
      await backgroundApiProxy.serviceSignatureConfirm.getRecentRecipients({
        networkId,
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
  const loadIdRef = useRef(0);

  const load = useCallback(async () => {
    const currentLoadId = (loadIdRef.current += 1);
    const isStale = () => loadIdRef.current !== currentLoadId;

    setIsLoadingRecent(true);
    setIsLoadingMore(false);
    setRecentRecipients([]);

    const isEvmNetwork = networkUtils.isEvmNetwork({ networkId });

    // Phase 1: API + local store in parallel. Local store is always loaded
    // so fresh sends (OK-52728) and non-indexer EVM chains aren't masked.
    const fetchApiRecipients = async () => {
      if (!accountId) return { extraMap: null, addresses: [] as string[] };
      try {
        const apiNetworkId = isEvmNetwork ? 'evm--1' : networkId;
        const { supported, data: apiRecipients } =
          await backgroundApiProxy.serviceHistory.fetchTransferRecipients({
            accountId,
            networkId: apiNetworkId,
            limit: MAX_RECIPIENTS,
          });
        if (supported && apiRecipients.length > 0) {
          return {
            extraMap: await buildExtraMapFromApiRecipients(apiRecipients),
            addresses: apiRecipients.map((r) => r.address),
          };
        }
      } catch {
        // Fall through to local strategies.
      }
      return { extraMap: null, addresses: [] as string[] };
    };

    let apiEnriched: IEnrichedRecentRecipient[] | null = null;
    const [
      { extraMap: apiExtraMap, addresses: apiAddresses },
      { addresses: storedAddresses, extraMap: storedExtraMap },
    ] = await Promise.all([
      fetchApiRecipients(),
      loadStoredRecipients(networkId),
    ]);

    if (isStale()) return;

    if (apiAddresses.length > 0) {
      // Merge before enrichment so each unique address hits queryAddress
      // only once (OK-52897 — badge calls are expensive).
      const apiAddressSet = new Set(apiAddresses.map((a) => a.toLowerCase()));
      const localOnlyAddresses = storedAddresses.filter(
        (a) => !apiAddressSet.has(a.toLowerCase()),
      );

      const combinedAddresses = [...apiAddresses, ...localOnlyAddresses];
      const combinedExtraMap = new Map<string, IRecipientExtraInfo>(
        apiExtraMap ?? [],
      );
      if (storedExtraMap) {
        for (const [key, value] of storedExtraMap) {
          if (!combinedExtraMap.has(key)) combinedExtraMap.set(key, value);
        }
      }

      try {
        const enriched = await enrichAddresses(
          combinedAddresses,
          combinedExtraMap,
          networkId,
        );
        if (isStale()) return;

        // Freshness overlay: on re-send the local updatedAt is newer than
        // the indexer's — bump the entry up and swap the network badge so
        // the new timestamp doesn't pair with the API's stale network.
        apiEnriched = enriched
          .map((r) => {
            const lower = r.input?.toLowerCase();
            const local = lower ? storedExtraMap?.get(lower) : undefined;
            if (local?.time && local.time > (r.lastTransferTime ?? 0)) {
              return {
                ...r,
                lastTransferTime: local.time,
                lastTransferNetworkName:
                  local.networkName ?? r.lastTransferNetworkName,
              };
            }
            return r;
          })
          .toSorted(
            (a, b) => (b.lastTransferTime ?? 0) - (a.lastTransferTime ?? 0),
          )
          .slice(0, MAX_RECIPIENTS);
      } catch {
        // ignore enrichment errors — fall through to local strategies
      }
    }

    if (apiEnriched) {
      setRecentRecipients(apiEnriched);
      setIsLoadingRecent(false);
      return;
    }

    // Phase 2: API not supported or empty — show stored recipients instantly.
    if (storedAddresses.length > 0) {
      try {
        const enriched = await enrichAddresses(
          storedAddresses,
          storedExtraMap,
          networkId,
        );
        if (isStale()) return;
        setRecentRecipients(enriched);
        setIsLoadingRecent(false);
        // Continue loading more from chain history in background.
        setIsLoadingMore(true);
      } catch {
        // ignore enrichment errors, continue to Phase 3
      }
    }

    // Phase 3: Load from chain history and merge new entries.
    if (!accountId) {
      setIsLoadingRecent(false);
      setIsLoadingMore(false);
      return;
    }

    try {
      let historyAddresses: string[] = [];
      let historyExtraMap: Map<string, IRecipientExtraInfo> | null = null;

      // Try local chain history first (EVM).
      if (isEvmNetwork) {
        try {
          const currentNetwork =
            await backgroundApiProxy.serviceNetwork.getNetworkSafe({
              networkId,
            });
          const currentNetworkName = currentNetwork?.name;
          const txsToProcess =
            await backgroundApiProxy.serviceHistory.getAccountsLocalHistoryTxs({
              accountId,
              networkId,
            });
          const ownerAddress = txsToProcess[0]?.decodedTx?.owner?.toLowerCase();
          const localMap = collectRecipientsFromHistoryTxs({
            txs: txsToProcess,
            ownerAddress,
            networkName: currentNetworkName,
          });
          historyExtraMap = localMap;
          historyAddresses = Array.from(localMap.values()).map(
            (r) => r.address,
          );
        } catch {
          // ignore
        }
      }

      // If local history is empty, fetch remote history.
      if (historyAddresses.length === 0) {
        try {
          const currentNetwork =
            await backgroundApiProxy.serviceNetwork.getNetworkSafe({
              networkId,
            });
          const currentNetworkName = currentNetwork?.name;
          let txsToProcess =
            await backgroundApiProxy.serviceHistory.getAccountsLocalHistoryTxs({
              accountId,
              networkId,
            });
          if (!txsToProcess || txsToProcess.length === 0) {
            const historyResult =
              await backgroundApiProxy.serviceHistory.fetchAccountHistory({
                accountId,
                networkId,
                limit: 20,
              });
            txsToProcess = historyResult.txs ?? [];
          }
          const ownerAddress = txsToProcess[0]?.decodedTx?.owner?.toLowerCase();
          const recipientMap = collectRecipientsFromHistoryTxs({
            txs: txsToProcess,
            ownerAddress,
            networkName: currentNetworkName,
            includeMemo: true,
          });
          historyAddresses = Array.from(recipientMap.values()).map(
            (r) => r.address,
          );
          historyExtraMap = recipientMap;
        } catch {
          // ignore
        }
      }

      if (isStale()) return;

      if (historyAddresses.length > 0) {
        // Filter out addresses already shown from stored recipients.
        const storedSet = new Set(storedAddresses.map((a) => a.toLowerCase()));
        const newAddresses = historyAddresses.filter(
          (a) => !storedSet.has(a.toLowerCase()),
        );

        if (newAddresses.length > 0) {
          const enriched = await enrichAddresses(
            newAddresses,
            historyExtraMap,
            networkId,
          );
          if (isStale()) return;
          setRecentRecipients((prev) => mergeRecipients(prev, enriched));
        }
      }
    } catch {
      // ignore history errors
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
  };
}
