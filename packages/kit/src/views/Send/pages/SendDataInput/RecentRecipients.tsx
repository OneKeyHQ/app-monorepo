import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import {
  ActionList,
  Divider,
  Empty,
  Icon,
  MatchSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import type { IAddressQueryResult } from '@onekeyhq/kit/src/components/AddressInput';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalAddressBookRoutes } from '@onekeyhq/shared/src/routes/addressBook';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsScamTx } from '@onekeyhq/shared/src/utils/historyUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { ITransferRecipient } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

interface IRecentRecipientsProps {
  accountId?: string;
  networkId: string;
  onSelect?: (params: {
    address: string;
    memo?: string;
    note?: string;
  }) => void;
  searchKey?: string;
  isSearchMode?: boolean;
  compact?: boolean;
  onMatchStatusChange?: (hasMatches: boolean, matchCount: number) => void;
  refreshKey?: number;
}

type IQuickItem = {
  id?: string;
  name: string;
  address: string;
  memo?: string;
  note?: string;
  lastTransferTime?: number;
  lastTransferNetworkName?: string;
  isAddressBook?: boolean;
  walletName?: string;
  walletId?: string;
};

// Account avatar with wallet overlay for "My Accounts" items
function AccountAvatarWithWallet({
  address,
  walletId,
}: {
  address: string;
  walletId?: string;
}) {
  const { result: wallet } = usePromiseResult(
    async () => {
      if (!walletId) return undefined;
      const w = await backgroundApiProxy.serviceAccount.getWallet({ walletId });
      return w;
    },
    [walletId],
    { initResult: undefined },
  );

  return <AccountAvatar size="default" address={address} wallet={wallet} />;
}
const MemoizedAccountAvatarWithWallet = memo(
  AccountAvatarWithWallet,
  (prev, next) =>
    prev.address === next.address && prev.walletId === next.walletId,
);

function QuickSelectListItemBase({
  item,
  onPress,
  formatRelativeTime,
  intl,
  networkId,
}: {
  item: IQuickItem;
  onPress?: () => void;
  formatRelativeTime?: (time: number) => string;
  intl: ReturnType<typeof useIntl>;
  networkId: string;
}) {
  const navigation = useAppNavigation();
  const [isHovered, setIsHovered] = useState(false);

  // Animated style for hover menu opacity
  const menuAnimatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isHovered ? 1 : 0, { duration: 150 }),
  }));

  // Determine display mode based on available info
  const hasName = !!item.name;

  // Build primary text: Name or shortened address as identifier
  const primaryText = useMemo(() => {
    if (hasName) {
      return item.name;
    }
    return accountUtils.shortenAddress({ address: item.address });
  }, [hasName, item.name, item.address]);

  // Show network name badge only on EVM (where recipients may span multiple chains)
  const isEvmNetwork = networkUtils.isEvmNetwork({ networkId });
  const showNetworkBadge =
    isEvmNetwork && !hasName && !!item.lastTransferNetworkName;

  // Only show menu for items NOT already in address book
  const showAddToAddressBook = !item.isAddressBook;

  const addToAddressBookLabel = intl.formatMessage({
    id: ETranslations.add_to_address_book__action,
  });

  const handleAddToAddressBook = useCallback(() => {
    navigation.pushModal(EModalRoutes.AddressBookModal, {
      screen: EModalAddressBookRoutes.EditItemModal,
      params: {
        address: item.address,
        networkId,
      },
    });
  }, [navigation, item.address, networkId]);

  const handleLongPress = useCallback(() => {
    if (!showAddToAddressBook) return;
    ActionList.show({
      title: item.address,
      sections: [
        {
          items: [
            {
              label: addToAddressBookLabel,
              icon: 'BookOpenOutline',
              onPress: handleAddToAddressBook,
            },
          ],
        },
      ],
    });
  }, [
    showAddToAddressBook,
    item.address,
    addToAddressBookLabel,
    handleAddToAddressBook,
  ]);

  // Memoize avatar render function to prevent recreation
  // If walletId exists (My Accounts), show wallet avatar overlay on account avatar
  const renderAvatar = useCallback(
    () => (
      <MemoizedAccountAvatarWithWallet
        address={item.address}
        walletId={item.walletId}
      />
    ),
    [item.address, item.walletId],
  );

  return (
    <ListItem
      px="$5"
      py="$3"
      renderAvatar={renderAvatar}
      onPress={onPress}
      onLongPress={platformEnv.isNative ? handleLongPress : undefined}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      testID={`recent-item-${item.address}`}
    >
      <ListItem.Text
        flexGrow={1}
        flexBasis={0}
        primary={
          <XStack gap="$2" alignItems="center">
            {item.isAddressBook ? (
              <Icon
                name="BookOpenOutline"
                size="$4"
                color="$iconSubdued"
                flexShrink={0}
              />
            ) : null}
            <SizableText size="$bodyLgMedium" numberOfLines={1} flexShrink={1}>
              {primaryText}
            </SizableText>
            {item.isAddressBook ? (
              <SizableText size="$bodySm" color="$textSubdued" flexShrink={0}>
                {intl.formatMessage({
                  id: ETranslations.address_book_title,
                })}
              </SizableText>
            ) : null}
            {showNetworkBadge ? (
              <SizableText size="$bodySm" color="$textDisabled" flexShrink={0}>
                {item.lastTransferNetworkName}
              </SizableText>
            ) : null}
            {item.lastTransferTime && formatRelativeTime ? (
              <SizableText size="$bodySm" color="$textDisabled" flexShrink={0}>
                {formatRelativeTime(item.lastTransferTime)}
              </SizableText>
            ) : null}
          </XStack>
        }
        secondary={
          <MatchSizeableText
            size="$bodyMd"
            color="$textSubdued"
            wordWrap="break-word"
          >
            {item.memo ? `${item.address} · ${item.memo}` : item.address}
          </MatchSizeableText>
        }
      />
      {showAddToAddressBook && !platformEnv.isNative ? (
        <Animated.View style={[{ marginLeft: 8 }, menuAnimatedStyle]}>
          <ActionList
            title={item.address}
            items={[
              {
                label: addToAddressBookLabel,
                icon: 'BookOpenOutline',
                onPress: handleAddToAddressBook,
              },
            ]}
            renderTrigger={
              <ListItem.IconButton
                icon="DotVerSolid"
                testID={`recent-menu-${item.address}`}
              />
            }
          />
        </Animated.View>
      ) : null}
    </ListItem>
  );
}

const QuickSelectListItem = memo(
  QuickSelectListItemBase,
  (prevProps, nextProps) =>
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.address === nextProps.item.address &&
    prevProps.item.name === nextProps.item.name &&
    prevProps.item.memo === nextProps.item.memo &&
    prevProps.item.note === nextProps.item.note &&
    prevProps.item.lastTransferTime === nextProps.item.lastTransferTime &&
    prevProps.item.lastTransferNetworkName ===
      nextProps.item.lastTransferNetworkName &&
    prevProps.item.isAddressBook === nextProps.item.isAddressBook &&
    prevProps.item.walletName === nextProps.item.walletName &&
    prevProps.item.walletId === nextProps.item.walletId &&
    prevProps.networkId === nextProps.networkId,
);

function QuickSelectSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Stack>
      {Array.from({ length: count }).map((_, index) => (
        <ListItem
          key={index}
          px="$5"
          py="$3"
          renderAvatar={() => (
            <Skeleton width="$10" height="$10" borderRadius="$2" bg="$bgApp" />
          )}
        >
          <ListItem.Text
            primary={<Skeleton height={18} width="50%" bg="$bgApp" />}
            secondary={<Skeleton height={14} width="70%" bg="$bgApp" />}
          />
        </ListItem>
      ))}
    </Stack>
  );
}

function RecentRecipients(props: IRecentRecipientsProps) {
  const intl = useIntl();
  const {
    accountId,
    networkId,
    searchKey: rawSearchKey,
    isSearchMode,
    onSelect,
    compact = false,
    onMatchStatusChange,
    refreshKey,
  } = props;

  type IEnrichedRecipient = IAddressQueryResult & {
    lastTransferTime?: number;
    lastTransferNetworkName?: string;
    isAddressBook?: boolean;
    recipientMemo?: string;
  };

  const [filteredRecentRecipients, setFilteredRecentRecipients] = useState<
    IEnrichedRecipient[]
  >([]);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShouldLoad(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const { formatDistanceToNow } = useFormatDate();

  const { result: recentRecipients = [], isLoading: isLoadingRecent } =
    usePromiseResult(
      async (): Promise<IEnrichedRecipient[]> => {
        if (!shouldLoad) {
          return [];
        }

        // Determine network type for data source strategy
        const isEvmNetwork = networkUtils.isEvmNetwork({ networkId });
        let recipientAddresses: string[] = [];
        // Map to store extra info: time, network name, and memo/tag
        let recipientExtraMap: Map<
          string,
          {
            address: string;
            time: number;
            networkName?: string;
            memo?: string;
          }
        > | null = null;

        // Helper function to fetch network names for networkIds
        const fetchNetworkNames = async (networkIds: string[]) => {
          const networkNameMap = new Map<string, string>();
          await Promise.all(
            networkIds.map(async (nid) => {
              const network =
                await backgroundApiProxy.serviceNetwork.getNetworkSafe({
                  networkId: nid,
                });
              if (network?.name) {
                networkNameMap.set(nid, network.name);
              }
            }),
          );
          return networkNameMap;
        };

        // Helper to build recipientExtraMap from API response
        const buildExtraMapFromApi = async (
          apiRecipients: ITransferRecipient[],
        ) => {
          const uniqueNetworkIds = [
            ...new Set(
              apiRecipients
                .map((r) => r.networkId)
                .filter((id): id is string => !!id),
            ),
          ];
          const networkNameMap = await fetchNetworkNames(uniqueNetworkIds);
          return new Map(
            apiRecipients.map((r) => [
              r.address.toLowerCase(),
              {
                address: r.address,
                time: r.time,
                networkName: r.networkId
                  ? networkNameMap.get(r.networkId)
                  : undefined,
                memo: r.memo,
              },
            ]),
          );
        };

        // Strategy 1: All chains call transfer-recipient API first
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
                limit: 20,
              });
            apiSupported = supported;

            if (supported && apiRecipients.length > 0) {
              recipientExtraMap = await buildExtraMapFromApi(apiRecipients);
              recipientAddresses = apiRecipients.map((r) => r.address);
            }
          } catch {
            // Fall through to history fallback
          }
        }

        // Strategy 2: EVM fallback — extract from local chain history
        // Strict filtering: no spam/scam, no contract interactions, no 0 amount
        if (
          !apiSupported &&
          recipientAddresses.length === 0 &&
          isEvmNetwork &&
          accountId
        ) {
          // Extract from local history on this EVM chain
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
              recipientExtraMap ??
              new Map<
                string,
                {
                  address: string;
                  time: number;
                  networkName?: string;
                  memo?: string;
                }
              >();
            const ownerAddress =
              txsToProcess[0]?.decodedTx?.owner?.toLowerCase();

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
              // Skip failed/dropped transactions
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
                  // Skip contract interactions
                  if (action.functionCall) {
                    // eslint-disable-next-line no-continue
                    continue;
                  }
                  const assetTransfer = action.assetTransfer;
                  if (assetTransfer?.sends && assetTransfer.sends.length > 0) {
                    hasOutgoingSend = true;
                    const firstSend = assetTransfer.sends[0];
                    // Filter out 0 amount transfers
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
              if (localMap.size >= 20) break;
            }

            recipientExtraMap = localMap;
            recipientAddresses = Array.from(localMap.values()).map(
              (r) => r.address,
            );
          } catch {
            // Keep whatever we got from the API
          }
        }

        // Strategy 3: Fallback to stored recipients
        if (recipientAddresses.length === 0) {
          const storedRecipients =
            await backgroundApiProxy.serviceSignatureConfirm.getRecentRecipients(
              {
                networkId,
              },
            );

          if (storedRecipients.length > 0) {
            // Get unique networkIds and fetch their names
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

        // Strategy 4: For other chains or if still empty, extract from transaction history
        if (recipientAddresses.length === 0 && accountId) {
          try {
            // Get current network name for display
            const currentNetwork =
              await backgroundApiProxy.serviceNetwork.getNetworkSafe({
                networkId,
              });
            const currentNetworkName = currentNetwork?.name;

            // First try local history (faster, already cached)
            let txsToProcess =
              await backgroundApiProxy.serviceHistory.getAccountsLocalHistoryTxs(
                {
                  accountId,
                  networkId,
                },
              );

            // If no local history, try fetching from server
            if (!txsToProcess || txsToProcess.length === 0) {
              const historyResult =
                await backgroundApiProxy.serviceHistory.fetchAccountHistory({
                  accountId,
                  networkId,
                  limit: 50,
                });
              txsToProcess = historyResult.txs ?? [];
            }

            // Extract unique recipient addresses with their last transfer time
            const recipientMap = new Map<
              string,
              {
                address: string;
                time: number;
                networkName?: string;
                memo?: string;
              }
            >();
            const ownerAddress =
              txsToProcess[0]?.decodedTx?.owner?.toLowerCase();

            for (const tx of txsToProcess) {
              // Skip risky/spam transactions
              if (checkIsScamTx({ tx })) {
                // eslint-disable-next-line no-continue
                continue;
              }

              const { decodedTx } = tx;
              if (!decodedTx) {
                if (recipientMap.size >= 20) break;
                // eslint-disable-next-line no-continue
                continue;
              }
              // Skip failed/dropped transactions
              if (
                decodedTx.status === EDecodedTxStatus.Failed ||
                decodedTx.status === EDecodedTxStatus.Dropped
              ) {
                // eslint-disable-next-line no-continue
                continue;
              }

              const txTime = decodedTx.updatedAt ?? decodedTx.createdAt ?? 0;

              // Only extract from OUTGOING transactions (user actively sent)
              let recipient: string | undefined;
              let hasOutgoingSend = false;
              let hasNonZeroAmount = false;

              // Check actions for outgoing asset transfers
              // Skip contract interactions - only include simple transfers
              if (decodedTx.actions) {
                for (const action of decodedTx.actions) {
                  // Skip contract interactions (functionCall)
                  if (action.functionCall) {
                    // eslint-disable-next-line no-continue
                    continue;
                  }

                  const assetTransfer = action.assetTransfer;
                  if (!assetTransfer) {
                    // eslint-disable-next-line no-continue
                    continue;
                  }

                  // Only process if there are SENDS (outgoing transfers from user)
                  if (assetTransfer.sends && assetTransfer.sends.length > 0) {
                    hasOutgoingSend = true;
                    const firstSend = assetTransfer.sends[0];
                    // Filter out 0 amount transfers
                    if (
                      firstSend.amount &&
                      firstSend.amount !== '0' &&
                      firstSend.amount !== ''
                    ) {
                      hasNonZeroAmount = true;
                    }

                    // Get recipient from send.to
                    if (!recipient && firstSend.to) {
                      recipient = firstSend.to;
                    }
                  }

                  // Fallback: get recipient from assetTransfer.to if we have sends
                  if (hasOutgoingSend && !recipient && assetTransfer.to) {
                    recipient = assetTransfer.to;
                  }

                  if (recipient) break;
                }
              }

              // Fallback to decodedTx.to only if we confirmed this is an outgoing tx
              if (hasOutgoingSend && !recipient && decodedTx.to) {
                recipient = decodedTx.to;
              }

              // Skip if not an outgoing transaction, no non-zero amount, or recipient is self
              if (
                !hasOutgoingSend ||
                !hasNonZeroAmount ||
                !recipient ||
                recipient.toLowerCase() === ownerAddress
              ) {
                // eslint-disable-next-line no-continue
                continue;
              }

              // Add outgoing recipient
              const recipientLower = recipient.toLowerCase();
              // Only keep the most recent time for each recipient
              if (!recipientMap.has(recipientLower)) {
                // Extract memo/tag/comment/note from extraInfo
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

              if (recipientMap.size >= 20) break;
            }

            recipientAddresses = Array.from(recipientMap.values()).map(
              (r) => r.address,
            );
            recipientExtraMap = recipientMap;
          } catch {
            // If history fetch fails, continue with empty list
            recipientAddresses = [];
          }
        }

        // Enrich addresses with wallet name, address book info, contract status, etc.
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

        // Merge extra info (time, network name) and address book status with results
        // Filter out contract addresses - they should not appear in recent recipients
        const enrichedResults: IEnrichedRecipient[] = addressInfoResults
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
          // Filter out entries whose API memo indicates a contract call (e.g. "Call: Swap")
          // This is a client-side defense for cases where backend isContract detection is incomplete
          .filter(
            (result) =>
              !result.recipientMemo ||
              !result.recipientMemo.startsWith('Call:'),
          );

        setFilteredRecentRecipients(enrichedResults);
        return enrichedResults;
      },
      // refreshKey is used to trigger refresh, not used in callback
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [networkId, accountId, shouldLoad, refreshKey],
      {
        initResult: [],
        watchLoading: true,
        undefinedResultIfError: true,
      },
    );

  const debouncedSearchKey = useDebounce(rawSearchKey, 300);
  const trimmedSearchKey = debouncedSearchKey?.trim().toLowerCase();
  const isSearchActive = !!(isSearchMode && trimmedSearchKey);
  // Detect debounce gap: searchKey changed but debounce hasn't settled yet
  const isDebouncing = isSearchMode && rawSearchKey !== debouncedSearchKey;

  useEffect(() => {
    if (!isSearchActive) {
      if (!trimmedSearchKey) {
        setFilteredRecentRecipients(recentRecipients);
      }
      return;
    }
    const nameMatched: typeof recentRecipients = [];
    const addressOnlyMatched: typeof recentRecipients = [];
    for (const recipient of recentRecipients) {
      const isNameMatch =
        recipient.walletAccountName?.toLowerCase().includes(trimmedSearchKey) ||
        recipient.addressBookName?.toLowerCase().includes(trimmedSearchKey);
      const isAddressMatch = recipient.input
        ?.toLowerCase()
        .includes(trimmedSearchKey);
      if (isNameMatch) {
        nameMatched.push(recipient);
      } else if (isAddressMatch) {
        addressOnlyMatched.push(recipient);
      }
    }
    setFilteredRecentRecipients([...nameMatched, ...addressOnlyMatched]);
  }, [isSearchActive, recentRecipients, trimmedSearchKey]);

  // Notify parent of match status and count
  useEffect(() => {
    // Skip reporting stale counts during debounce gap to prevent badge flickering
    if (isDebouncing) return;
    onMatchStatusChange?.(
      filteredRecentRecipients.length > 0,
      filteredRecentRecipients.length,
    );
  }, [filteredRecentRecipients.length, onMatchStatusChange, isDebouncing]);

  const renderContent = useCallback(() => {
    if (!filteredRecentRecipients.length && isLoadingRecent) {
      return <QuickSelectSkeleton />;
    }
    if (filteredRecentRecipients.length > 0) {
      return filteredRecentRecipients.map((recipient) => (
        <QuickSelectListItem
          key={recipient.input}
          item={{
            id: recipient.input ?? '',
            name:
              recipient.addressBookName ?? recipient.walletAccountName ?? '',
            address: recipient.input ?? '',
            memo: recipient.addressMemo || recipient.recipientMemo,
            note: recipient.addressNote,
            lastTransferTime: recipient.lastTransferTime,
            lastTransferNetworkName: recipient.lastTransferNetworkName,
            isAddressBook: recipient.isAddressBook,
            walletName: recipient.walletName,
            walletId: recipient.walletId,
          }}
          intl={intl}
          networkId={networkId}
          formatRelativeTime={formatDistanceToNow}
          onPress={() => {
            onSelect?.({
              address: recipient.input ?? '',
              memo: recipient.addressMemo || recipient.recipientMemo,
              note: recipient.addressNote,
            });
          }}
        />
      ));
    }
    if (isSearchActive) {
      return (
        <Empty
          mt="$3"
          icon="SearchOutline"
          title={intl.formatMessage({
            id: ETranslations.no_search_results__title,
          })}
        />
      );
    }
    return (
      <Empty
        mt="$3"
        icon="ClockTimeHistoryOutline"
        title={intl.formatMessage({
          id: ETranslations.transfer_recent_transfers,
        })}
        description={intl.formatMessage({
          id: ETranslations.transfer_recent_transfers_empty,
        })}
      />
    );
  }, [
    filteredRecentRecipients,
    formatDistanceToNow,
    intl,
    isLoadingRecent,
    isSearchActive,
    networkId,
    onSelect,
  ]);

  return (
    <Stack mx={compact ? 0 : -20}>
      {compact ? null : <Divider mb="$5" borderColor="$borderSubdued" />}
      {compact ? null : (
        <SizableText size="$bodyMd" color="$textSubdued" mb="$2" ml="$5">
          {intl.formatMessage({ id: ETranslations.transfer_recent_transfers })}
        </SizableText>
      )}
      {renderContent()}
    </Stack>
  );
}

export default RecentRecipients;
