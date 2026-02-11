import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, YStack, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EChainSelectorPages } from '@onekeyhq/shared/src/routes';
import bulkSendUtils from '@onekeyhq/shared/src/utils/bulkSendUtils';
import type { IToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';

import { useBulkSendAddressesInputContext } from './Context';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

function AssetSelectorTrigger() {
  const intl = useIntl();
  const media = useMedia();
  const {
    selectedAccountId,
    selectedNetworkId,
    selectedToken,
    setSelectedToken,
    selectedIndexedAccountId,
    setSelectedAccountId,
    setSelectedNetworkId,
  } = useBulkSendAddressesInputContext();
  const navigation = useAppNavigation();

  const openChainSelector = useConfigurableChainSelector();

  const { network } = useAccountData({
    networkId: selectedNetworkId,
  });

  const title = useMemo(() => {
    if (selectedToken) {
      return selectedToken.symbol;
    }

    return media.gtMd
      ? ''
      : intl.formatMessage({ id: ETranslations.token_selector_title });
  }, [selectedToken, media.gtMd, intl]);

  const availableNetworkIds = useMemo(() => {
    return bulkSendUtils.getBulkSendSupportedNetworkIds();
  }, []);

  const handleSelectAsset = useCallback(() => {
    openChainSelector({
      networkIds: availableNetworkIds,
      defaultNetworkId: selectedNetworkId,
      showNetworkValues: true,
      indexedAccountId: selectedIndexedAccountId ?? undefined,
      accountId: selectedAccountId ?? undefined,
      onSelect: async (_network) => {
        let accountId = '';
        if (
          accountUtils.isOthersAccount({ accountId: selectedAccountId }) ||
          (networkUtils.isAllNetwork({ networkId: selectedNetworkId }) &&
            selectedAccountId)
        ) {
          accountId = selectedAccountId ?? '';
        } else {
          const networkAccounts =
            await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountId(
              {
                networkIds: [_network.id],
                indexedAccountId: selectedIndexedAccountId ?? '',
              },
            );
          accountId = networkAccounts[0].account?.id ?? '';
        }

        if (accountId) {
          navigation.push(EChainSelectorPages.TokenSelector, {
            activeAccountId: accountId,
            activeNetworkId: _network.id,
            indexedAccountId: selectedIndexedAccountId ?? '',
            onSelect: (token: IToken) => {
              setSelectedToken(token);
              setSelectedAccountId(accountId);
              setSelectedNetworkId(_network.id);
              navigation.popStack();
            },
          });
        } else {
          navigation.popStack();
          setSelectedAccountId(undefined);
          setSelectedNetworkId(_network.id);
          setSelectedToken(undefined);
        }
      },
      excludeAllNetworkItem: true,
      grouped: false,
      closeAfterSelect: false,
    });
  }, [
    openChainSelector,
    availableNetworkIds,
    selectedNetworkId,
    selectedAccountId,
    selectedIndexedAccountId,
    navigation,
    setSelectedToken,
    setSelectedAccountId,
    setSelectedNetworkId,
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
        renderAvatar={() => (
          <Token
            tokenImageUri={selectedToken?.logoURI}
            size="lg"
            showNetworkIcon
            networkImageUri={network?.logoURI}
            networkId={network?.id}
          />
        )}
        title={title}
        subtitle={network?.name}
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

export default AssetSelectorTrigger;
