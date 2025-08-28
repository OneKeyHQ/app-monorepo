import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Empty } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { ITokenFiat } from '@onekeyhq/shared/types/token';

import { useAccountData } from '../../hooks/useAccountData';
import { useBlockExplorerNavigation } from '../../hooks/useBlockExplorerNavigation';
import { openExplorerAddressUrl } from '../../utils/explorerUtils';
import AddressTypeSelector from '../AddressTypeSelector/AddressTypeSelector';

interface IEmptyHistoryProps {
  walletId?: string;
  accountId?: string;
  networkId?: string;
  indexedAccountId?: string;
  showViewInExplorer?: boolean;
  isSingleAccount?: boolean;
  tokenMap?: Record<string, ITokenFiat>;
}

function EmptyHistory({
  walletId,
  accountId,
  networkId,
  indexedAccountId,
  isSingleAccount,
  tokenMap,
}: IEmptyHistoryProps) {
  const intl = useIntl();
  const { account, network, vaultSettings } = useAccountData({
    accountId,
    networkId,
  });
  const { requiresNetworkSelection, openExplorer } = useBlockExplorerNavigation(
    network,
    walletId,
  );

  const handleOnPress = useCallback(async () => {
    await openExplorer({
      accountId,
      indexedAccountId,
      networkId: account?.createAtNetwork ?? network?.id,
      address: account?.address,
    });
  }, [
    openExplorer,
    accountId,
    indexedAccountId,
    account?.createAtNetwork,
    account?.address,
    network?.id,
  ]);

  const renderViewInExplorerButton = useCallback(() => {
    if (vaultSettings?.hideBlockExplorer && !network?.isAllNetworks) {
      return null;
    }

    return !isSingleAccount &&
      !accountUtils.isOthersWallet({ walletId: walletId ?? '' }) &&
      vaultSettings?.mergeDeriveAssetsEnabled ? (
      <AddressTypeSelector
        walletId={walletId ?? ''}
        networkId={networkId ?? ''}
        indexedAccountId={indexedAccountId ?? account?.indexedAccountId ?? ''}
        renderSelectorTrigger={
          <Button size="medium" variant="secondary" onPress={() => {}} mt="$6">
            {intl.formatMessage({
              id: ETranslations.global_block_explorer,
            })}
          </Button>
        }
        onSelect={async ({ account: a }) => {
          await openExplorerAddressUrl({
            networkId: network?.id,
            address: a?.address,
          });
        }}
        tokenMap={tokenMap}
        doubleConfirm
      />
    ) : (
      <Button
        size="medium"
        variant="secondary"
        onPress={handleOnPress}
        mt="$6"
        iconAfter={requiresNetworkSelection ? undefined : 'OpenOutline'}
      >
        {intl.formatMessage({ id: ETranslations.global_block_explorer })}
      </Button>
    );
  }, [
    vaultSettings?.hideBlockExplorer,
    vaultSettings?.mergeDeriveAssetsEnabled,
    network?.isAllNetworks,
    network?.id,
    isSingleAccount,
    walletId,
    networkId,
    indexedAccountId,
    account?.indexedAccountId,
    intl,
    tokenMap,
    handleOnPress,
    requiresNetworkSelection,
  ]);

  return (
    <Empty
      h={platformEnv.isNativeAndroid ? 300 : undefined}
      testID="Wallet-No-History-Empty"
      icon="ClockTimeHistoryOutline"
      title={intl.formatMessage({ id: ETranslations.no_transaction_title })}
      description={intl.formatMessage({
        id: ETranslations.no_transaction_desc,
      })}
      button={renderViewInExplorerButton()}
    />
  );
}

export { EmptyHistory };
