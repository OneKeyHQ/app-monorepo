import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, YStack, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EChainSelectorPages, EModalRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bulkSendUtils from '@onekeyhq/shared/src/utils/bulkSendUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';
import type { IToken } from '@onekeyhq/shared/types/token';

import { useBulkSendAddressesInputContext } from './Context';

type IResolvedSelectorAccount = {
  accountId: string;
  indexedAccountId?: string;
};

function AssetSelectorTrigger({
  getSenderAddresses,
  activeAccountId,
  activeIndexedAccountId,
}: {
  getSenderAddresses: () => string;
  activeAccountId?: string;
  activeIndexedAccountId?: string;
}) {
  const intl = useIntl();
  const media = useMedia();
  const {
    selectedAccountId,
    selectedNetworkId,
    selectedToken,
    setSelectedToken,
    selectedIndexedAccountId,
    setSelectedAccountId,
    setSelectedIndexedAccountId,
    setSelectedNetworkId,
    bulkSendMode,
    resolvedSenderAccountIds,
    hasUserSelectedAsset,
    setHasUserSelectedAsset,
  } = useBulkSendAddressesInputContext();
  const navigation = useAppNavigation();

  const openChainSelector = useConfigurableChainSelector();
  const isOneToMany = bulkSendMode === EBulkSendMode.OneToMany;
  const displayNetworkId = selectedToken?.networkId ?? selectedNetworkId;

  const { network } = useAccountData({
    networkId: displayNetworkId,
    options: {
      checkIsFocused: false,
      undefinedResultIfReRun: true,
    },
  });

  const title = useMemo(() => {
    if (selectedToken) {
      return selectedToken.symbol;
    }

    return media.gtMd
      ? ''
      : intl.formatMessage({ id: ETranslations.token_selector_title });
  }, [selectedToken, media.gtMd, intl]);

  const avatarElement = useMemo(
    () => (
      <Token
        key={displayNetworkId}
        tokenImageUri={selectedToken?.logoURI}
        size="lg"
        showNetworkIcon
        networkId={displayNetworkId}
      />
    ),
    [displayNetworkId, selectedToken?.logoURI],
  );

  const {
    result: { availableNetworkIds, unavailableNetworkIds },
  } = usePromiseResult(
    async () => {
      if (!isOneToMany) {
        const { networks } =
          await backgroundApiProxy.serviceNetwork.getAllNetworks({
            excludeAllNetworkItem: true,
          });
        return {
          availableNetworkIds: networks
            .filter(
              (item) => !bulkSendUtils.isBulkSendExcludedNetworkId(item.id),
            )
            .map((item) => item.id),
          unavailableNetworkIds: [],
        };
      }

      const _availableNetworkIds =
        bulkSendUtils.getBulkSendSupportedNetworkIds();

      if (!selectedAccountId) {
        return {
          availableNetworkIds: _availableNetworkIds,
          unavailableNetworkIds: [],
        };
      }

      const { unavailableItems } =
        await backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
          {
            accountId: selectedAccountId,
            networkIds: _availableNetworkIds,
          },
        );
      return {
        availableNetworkIds: _availableNetworkIds,
        unavailableNetworkIds: unavailableItems.map((o) => o.id),
      };
    },
    [isOneToMany, selectedAccountId],
    {
      initResult: {
        availableNetworkIds: [],
        unavailableNetworkIds: [],
      },
      watchLoading: true,
    },
  );

  const resolveAccountContextForAddress = useCallback(
    async ({
      address,
      networkId,
      skipValidation = false,
    }: {
      address: string;
      networkId: string;
      skipValidation?: boolean;
    }): Promise<IResolvedSelectorAccount | undefined> => {
      const trimmedAddress = address.trim();
      if (!trimmedAddress) {
        return undefined;
      }

      if (!skipValidation) {
        const validationResult =
          await backgroundApiProxy.serviceValidator.localValidateAddress({
            networkId,
            address: trimmedAddress,
          });
        if (!validationResult.isValid) {
          return undefined;
        }
      }

      try {
        const walletAccountItems =
          await backgroundApiProxy.serviceAccount.getAccountNameFromAddress({
            networkId,
            address: trimmedAddress,
          });

        for (const item of walletAccountItems) {
          if (!accountUtils.isWatchingAccount({ accountId: item.accountId })) {
            if (
              accountUtils.isHdAccount({ accountId: item.accountId }) ||
              accountUtils.isHwAccount({ accountId: item.accountId })
            ) {
              const networkAccounts =
                await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountId(
                  {
                    indexedAccountId: item.accountId,
                    networkIds: [networkId],
                  },
                );

              if (networkAccounts[0]?.account?.id) {
                return {
                  accountId: networkAccounts[0].account.id,
                  indexedAccountId: item.accountId,
                };
              }
            } else if (
              accountUtils.isExternalAccount({ accountId: item.accountId }) ||
              accountUtils.isImportedAccount({ accountId: item.accountId }) ||
              accountUtils.isOthersAccount({ accountId: item.accountId })
            ) {
              return {
                accountId: item.accountId,
              };
            }
          }
        }
      } catch {
        return undefined;
      }

      return undefined;
    },
    [],
  );

  const resolveAccountContextFromSenders = useCallback(
    async (
      networkId: string,
    ): Promise<IResolvedSelectorAccount | undefined> => {
      const nonEmptyLines = getSenderAddresses()
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      for (let index = 0; index < nonEmptyLines.length; index += 1) {
        const address = nonEmptyLines[index].split(',')[0]?.trim();
        if (address) {
          const resolvedAccountId = resolvedSenderAccountIds[index];
          const resolved = await resolveAccountContextForAddress({
            address,
            networkId,
            skipValidation: Boolean(resolvedAccountId),
          });

          if (resolved) {
            return resolvedAccountId
              ? {
                  ...resolved,
                  accountId: resolvedAccountId,
                }
              : resolved;
          }
        }
      }

      return undefined;
    },
    [
      getSenderAddresses,
      resolvedSenderAccountIds,
      resolveAccountContextForAddress,
    ],
  );

  const resolveFallbackActiveAccountContext = useCallback(
    async (
      networkId: string,
    ): Promise<IResolvedSelectorAccount | undefined> => {
      if (!activeAccountId) {
        return undefined;
      }

      if (
        accountUtils.isOthersAccount({ accountId: activeAccountId }) ||
        !activeIndexedAccountId
      ) {
        return {
          accountId: activeAccountId,
          indexedAccountId: activeIndexedAccountId,
        };
      }

      const networkAccounts =
        await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountId(
          {
            networkIds: [networkId],
            indexedAccountId: activeIndexedAccountId,
          },
        );

      if (!networkAccounts[0]?.account?.id) {
        return undefined;
      }

      return {
        accountId: networkAccounts[0].account.id,
        indexedAccountId: activeIndexedAccountId,
      };
    },
    [activeAccountId, activeIndexedAccountId],
  );

  // Pre-compute whether the selected network supports multiple tokens,
  // so handleSelectAsset can decide synchronously without an IPC hop.
  const { result: hasMultipleTokens } = usePromiseResult(
    async () => {
      if (!selectedNetworkId) return false;
      const vaultSettings =
        await backgroundApiProxy.serviceNetwork.getVaultSettings({
          networkId: selectedNetworkId,
        });
      return !vaultSettings.isSingleToken;
    },
    [selectedNetworkId],
    { initResult: false },
  );

  const buildTokenSelectHandler = useCallback(
    ({
      accountId,
      indexedAccountId,
      networkId,
    }: {
      accountId: string;
      indexedAccountId?: string;
      networkId: string;
    }) =>
      (token: IToken) => {
        const nextNetworkId = token.networkId ?? networkId;
        setSelectedToken(token);
        setSelectedAccountId(accountId);
        setSelectedIndexedAccountId(indexedAccountId);
        setSelectedNetworkId(nextNetworkId);
        setHasUserSelectedAsset(true);
        navigation.popStack();
      },
    [
      navigation,
      setSelectedToken,
      setSelectedAccountId,
      setSelectedIndexedAccountId,
      setSelectedNetworkId,
      setHasUserSelectedAsset,
    ],
  );

  const openChainSelectorWithConfig = useCallback(() => {
    openChainSelector({
      networkIds:
        availableNetworkIds.length > 0 ? availableNetworkIds : undefined,
      disableNetworkIds: isOneToMany ? unavailableNetworkIds : undefined,
      defaultNetworkId: selectedNetworkId,
      showNetworkValues: isOneToMany,
      indexedAccountId: selectedIndexedAccountId ?? undefined,
      accountId: selectedAccountId ?? undefined,
      onSelect: async (_network) => {
        let resolvedAccountContext = await resolveAccountContextFromSenders(
          _network.id,
        );

        if (!resolvedAccountContext) {
          resolvedAccountContext = await resolveFallbackActiveAccountContext(
            _network.id,
          );
        }

        if (!resolvedAccountContext && selectedAccountId) {
          if (
            accountUtils.isOthersAccount({ accountId: selectedAccountId }) ||
            (networkUtils.isAllNetwork({ networkId: selectedNetworkId }) &&
              selectedAccountId)
          ) {
            resolvedAccountContext = {
              accountId: selectedAccountId,
              indexedAccountId: selectedIndexedAccountId,
            };
          } else if (selectedIndexedAccountId) {
            const networkAccounts =
              await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountId(
                {
                  networkIds: [_network.id],
                  indexedAccountId: selectedIndexedAccountId,
                },
              );
            if (networkAccounts[0]?.account?.id) {
              resolvedAccountContext = {
                accountId: networkAccounts[0].account.id,
                indexedAccountId: selectedIndexedAccountId,
              };
            }
          }
        }

        if (resolvedAccountContext?.accountId) {
          const { accountId, indexedAccountId } = resolvedAccountContext;

          const vaultSettings =
            await backgroundApiProxy.serviceNetwork.getVaultSettings({
              networkId: _network.id,
            });

          if (vaultSettings.isSingleToken) {
            const nativeToken =
              await backgroundApiProxy.serviceToken.getNativeToken({
                accountId,
                networkId: _network.id,
                tokenInfoOnly: true,
              });

            if (nativeToken) {
              buildTokenSelectHandler({
                accountId,
                indexedAccountId,
                networkId: _network.id,
              })(nativeToken);
              return;
            }
          }

          navigation.push(EChainSelectorPages.TokenSelector, {
            accountId,
            networkId: _network.id,
            activeAccountId: accountId,
            activeNetworkId: _network.id,
            forceShowActiveAccountTokenList: true,
            indexedAccountId: indexedAccountId ?? '',
            hideBalanceAndValue: !isOneToMany,
            onSelect: buildTokenSelectHandler({
              accountId,
              indexedAccountId,
              networkId: _network.id,
            }),
          });
        } else {
          navigation.popStack();
          setSelectedAccountId(undefined);
          setSelectedIndexedAccountId(undefined);
          setSelectedNetworkId(_network.id);
          setSelectedToken(undefined);
          setHasUserSelectedAsset(false);
        }
      },
      excludeAllNetworkItem: true,
      grouped: !isOneToMany,
      closeAfterSelect: false,
    });
  }, [
    openChainSelector,
    availableNetworkIds,
    isOneToMany,
    resolveAccountContextFromSenders,
    resolveFallbackActiveAccountContext,
    selectedNetworkId,
    selectedAccountId,
    selectedIndexedAccountId,
    buildTokenSelectHandler,
    navigation,
    setSelectedToken,
    setSelectedAccountId,
    setSelectedIndexedAccountId,
    setSelectedNetworkId,
    setHasUserSelectedAsset,
    unavailableNetworkIds,
  ]);

  const handleSwitchNetwork = useCallback(async () => {
    navigation.popStack();
    await timerUtils.wait(300);
    openChainSelectorWithConfig();
  }, [navigation, openChainSelectorWithConfig]);

  const handleSelectAsset = useCallback(() => {
    if (
      selectedNetworkId &&
      selectedAccountId &&
      hasMultipleTokens &&
      hasUserSelectedAsset
    ) {
      navigation.pushModal(EModalRoutes.ChainSelectorModal, {
        screen: EChainSelectorPages.TokenSelector,
        params: {
          accountId: selectedAccountId,
          networkId: selectedNetworkId,
          activeAccountId: selectedAccountId,
          activeNetworkId: selectedNetworkId,
          forceShowActiveAccountTokenList: true,
          indexedAccountId: selectedIndexedAccountId ?? '',
          hideBalanceAndValue: !isOneToMany,
          onSelect: buildTokenSelectHandler({
            accountId: selectedAccountId,
            indexedAccountId: selectedIndexedAccountId,
            networkId: selectedNetworkId,
          }),
          onSwitchNetwork: handleSwitchNetwork,
        },
      });
      return;
    }

    openChainSelectorWithConfig();
  }, [
    selectedNetworkId,
    selectedAccountId,
    selectedIndexedAccountId,
    hasMultipleTokens,
    hasUserSelectedAsset,
    navigation,
    isOneToMany,
    buildTokenSelectHandler,
    handleSwitchNetwork,
    openChainSelectorWithConfig,
  ]);

  return (
    <YStack gap="$1.5">
      {media.gtMd ? null : (
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({
            id: ETranslations.wallet_bulk_send_label_asset,
          })}
        </SizableText>
      )}
      <ListItem
        drillIn={media.md}
        renderAvatar={avatarElement}
        title={title}
        subtitle={selectedToken?.networkName ?? network?.name}
        bg="$bgSubdued"
        mx="$0"
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
        userSelect="none"
        borderRadius="$3"
        $gtMd={{
          bg: '$bgApp',
          px: '$3',
          mx: '$-3',
        }}
        onPress={handleSelectAsset}
      >
        {media.gtMd ? (
          <Button size="small" variant="secondary">
            {intl.formatMessage({
              id: ETranslations.send_to_contacts_selector_account_title,
            })}
          </Button>
        ) : null}
      </ListItem>
    </YStack>
  );
}

export default memo(AssetSelectorTrigger);
