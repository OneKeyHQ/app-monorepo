import { useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAddressQueryResult } from '@onekeyhq/kit/src/components/AddressInput';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { checkIsScamTx } from '@onekeyhq/shared/src/utils/historyUtils';
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

  const normalizedOwnerAddress = ownerAddress?.toLowerCase();
  if (
    normalizedOwnerAddress &&
    recipient.toLowerCase() === normalizedOwnerAddress
  ) {
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
      recipientMap.set(recipientLower, {
        address: recipientInfo.address,
        time: recipientInfo.time,
        networkName,
        memo: recipientInfo.memo,
      });
    }

    if (recipientMap.size >= MAX_RECIPIENTS) break;
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
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShouldLoad(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const { result: recentRecipients = [], isLoading: isLoadingRecent } =
    usePromiseResult<IEnrichedRecentRecipient[]>(
      async () => {
        if (!shouldLoad) {
          return [];
        }

        const isEvmNetwork = networkUtils.isEvmNetwork({ networkId });
        let recipientAddresses: string[] = [];
        let recipientExtraMap: Map<string, IRecipientExtraInfo> | null = null;

        // Strategy 1: All chains call transfer-recipient API first.
        let apiSupported = false;
        if (accountId) {
          try {
            let apiNetworkId = networkId;
            if (isEvmNetwork) {
              apiNetworkId = 'evm--1';
            }

            const { supported, data: apiRecipients } =
              await backgroundApiProxy.serviceHistory.fetchTransferRecipients({
                accountId,
                networkId: apiNetworkId,
                limit: MAX_RECIPIENTS,
              });
            apiSupported = supported;

            if (supported && apiRecipients.length > 0) {
              recipientExtraMap =
                await buildExtraMapFromApiRecipients(apiRecipients);
              recipientAddresses = apiRecipients.map((r) => r.address);
            }
          } catch {
            // Fall through to history fallback.
          }
        }

        // Strategy 2: EVM fallback — extract from local chain history.
        if (
          !apiSupported &&
          recipientAddresses.length === 0 &&
          isEvmNetwork &&
          accountId
        ) {
          try {
            const currentNetwork =
              await backgroundApiProxy.serviceNetwork.getNetworkSafe({
                networkId,
              });
            const currentNetworkName = currentNetwork?.name;

            const txsToProcess =
              await backgroundApiProxy.serviceHistory.getAccountsLocalHistoryTxs(
                { accountId, networkId },
              );

            const ownerAddress =
              txsToProcess[0]?.decodedTx?.owner?.toLowerCase() ?? '';
            const localMap = collectRecipientsFromHistoryTxs({
              txs: txsToProcess,
              ownerAddress,
              networkName: currentNetworkName,
              seedMap: recipientExtraMap ?? undefined,
            });

            recipientExtraMap = localMap;
            recipientAddresses = Array.from(localMap.values()).map(
              (r) => r.address,
            );
          } catch {
            // Keep whatever we got from the API.
          }
        }

        // Strategy 3: Fallback to stored recipients.
        if (recipientAddresses.length === 0) {
          const storedRecipients =
            await backgroundApiProxy.serviceSignatureConfirm.getRecentRecipients(
              { networkId },
            );

          if (storedRecipients.length > 0) {
            const uniqueNetworkIds = [
              ...new Set(
                storedRecipients
                  .map((r) => r.networkId)
                  .filter((id): id is string => !!id),
              ),
            ];
            const networkNameMap = await fetchNetworkNames(uniqueNetworkIds);

            recipientExtraMap = new Map(
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
            recipientAddresses = storedRecipients.map((r) => r.address);
          }
        }

        // Strategy 4: For other chains or if still empty, extract from tx history.
        if (recipientAddresses.length === 0 && accountId) {
          try {
            const currentNetwork =
              await backgroundApiProxy.serviceNetwork.getNetworkSafe({
                networkId,
              });
            const currentNetworkName = currentNetwork?.name;

            let txsToProcess =
              await backgroundApiProxy.serviceHistory.getAccountsLocalHistoryTxs(
                { accountId, networkId },
              );

            if (!txsToProcess || txsToProcess.length === 0) {
              const historyResult =
                await backgroundApiProxy.serviceHistory.fetchAccountHistory({
                  accountId,
                  networkId,
                  limit: 50,
                });
              txsToProcess = historyResult.txs ?? [];
            }

            const ownerAddress =
              txsToProcess[0]?.decodedTx?.owner?.toLowerCase() ?? '';
            const recipientMap = collectRecipientsFromHistoryTxs({
              txs: txsToProcess,
              ownerAddress,
              networkName: currentNetworkName,
              includeMemo: true,
            });

            recipientAddresses = Array.from(recipientMap.values()).map(
              (r) => r.address,
            );
            recipientExtraMap = recipientMap;
          } catch {
            recipientAddresses = [];
          }
        }

        const addressInfoResults = await Promise.all(
          recipientAddresses.map((recipient) =>
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

        return addressInfoResults
          .filter((result) => !result.isContract && !result.isScam)
          .map((result) => {
            const addressLower = result.input?.toLowerCase() ?? '';
            const extraInfo = recipientExtraMap?.get(addressLower);
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
              !result.recipientMemo ||
              !result.recipientMemo.startsWith('Call:'),
          )
          .toSorted(
            (a, b) => (b.lastTransferTime ?? 0) - (a.lastTransferTime ?? 0),
          );
      },
      // refreshKey is used only to trigger re-fetch.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [networkId, accountId, shouldLoad, refreshKey],
      {
        initResult: [],
        watchLoading: true,
        undefinedResultIfError: true,
      },
    );

  return {
    recentRecipients,
    isLoadingRecent,
  };
}
