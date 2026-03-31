import { useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAddressQueryResult } from '@onekeyhq/kit/src/components/AddressInput';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { checkIsScamTx } from '@onekeyhq/shared/src/utils/historyUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { ITransferRecipient } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

const MAX_RECIPIENTS = 20;

type IRecipientExtraInfo = {
  address: string;
  time: number;
  networkName?: string;
  memo?: string;
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

            const localMap =
              recipientExtraMap ?? new Map<string, IRecipientExtraInfo>();
            const ownerAddress =
              txsToProcess[0]?.decodedTx?.owner?.toLowerCase() ?? '';

            for (const tx of txsToProcess) {
              if (checkIsScamTx({ tx })) {
                // eslint-disable-next-line no-continue
                continue;
              }
              const { decodedTx } = tx;
              if (!decodedTx) {
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

              let recipient: string | undefined;
              let hasOutgoingSend = false;
              let hasNonZeroAmount = false;

              if (decodedTx.actions) {
                for (const action of decodedTx.actions) {
                  if (action.functionCall) {
                    // eslint-disable-next-line no-continue
                    continue;
                  }
                  const assetTransfer = action.assetTransfer;
                  if (assetTransfer?.sends && assetTransfer.sends.length > 0) {
                    hasOutgoingSend = true;
                    const firstSend = assetTransfer.sends[0];
                    if (
                      firstSend.amount &&
                      firstSend.amount !== '0' &&
                      firstSend.amount !== ''
                    ) {
                      hasNonZeroAmount = true;
                    }
                    if (!recipient && firstSend.to) {
                      recipient = firstSend.to;
                    }
                  }
                  if (hasOutgoingSend && !recipient && assetTransfer?.to) {
                    recipient = assetTransfer.to;
                  }
                  if (recipient) break;
                }
              }

              if (hasOutgoingSend && !recipient && decodedTx.to) {
                recipient = decodedTx.to;
              }
              if (
                !hasOutgoingSend ||
                !hasNonZeroAmount ||
                !recipient ||
                recipient.toLowerCase() === ownerAddress
              ) {
                // eslint-disable-next-line no-continue
                continue;
              }

              const recipientLower = recipient.toLowerCase();
              if (!localMap.has(recipientLower)) {
                const txTime = decodedTx.updatedAt ?? decodedTx.createdAt ?? 0;
                localMap.set(recipientLower, {
                  address: recipient,
                  time: txTime,
                  networkName: currentNetworkName,
                });
              }
              if (localMap.size >= MAX_RECIPIENTS) break;
            }

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

            const recipientMap = new Map<string, IRecipientExtraInfo>();
            const ownerAddress =
              txsToProcess[0]?.decodedTx?.owner?.toLowerCase() ?? '';

            for (const tx of txsToProcess) {
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

              const txTime = decodedTx.updatedAt ?? decodedTx.createdAt ?? 0;
              let recipient: string | undefined;
              let hasOutgoingSend = false;
              let hasNonZeroAmount = false;

              if (decodedTx.actions) {
                for (const action of decodedTx.actions) {
                  if (action.functionCall) {
                    // eslint-disable-next-line no-continue
                    continue;
                  }

                  const assetTransfer = action.assetTransfer;
                  if (!assetTransfer) {
                    // eslint-disable-next-line no-continue
                    continue;
                  }

                  if (assetTransfer.sends && assetTransfer.sends.length > 0) {
                    hasOutgoingSend = true;
                    const firstSend = assetTransfer.sends[0];
                    if (
                      firstSend.amount &&
                      firstSend.amount !== '0' &&
                      firstSend.amount !== ''
                    ) {
                      hasNonZeroAmount = true;
                    }
                    if (!recipient && firstSend.to) {
                      recipient = firstSend.to;
                    }
                  }

                  if (hasOutgoingSend && !recipient && assetTransfer.to) {
                    recipient = assetTransfer.to;
                  }

                  if (recipient) break;
                }
              }

              if (hasOutgoingSend && !recipient && decodedTx.to) {
                recipient = decodedTx.to;
              }

              if (
                !hasOutgoingSend ||
                !hasNonZeroAmount ||
                !recipient ||
                recipient.toLowerCase() === ownerAddress
              ) {
                // eslint-disable-next-line no-continue
                continue;
              }

              const recipientLower = recipient.toLowerCase();
              if (!recipientMap.has(recipientLower)) {
                const extra = decodedTx.extraInfo as Record<string, unknown>;
                const txMemo =
                  (extra?.memo as string) ??
                  (extra?.note as string) ??
                  (extra?.destinationTag !== null &&
                  extra?.destinationTag !== undefined
                    ? String(extra.destinationTag)
                    : undefined);

                recipientMap.set(recipientLower, {
                  address: recipient,
                  time: txTime,
                  networkName: currentNetworkName,
                  memo: txMemo,
                });
              }

              if (recipientMap.size >= MAX_RECIPIENTS) break;
            }

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
          .filter((result) => !result.isContract)
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
