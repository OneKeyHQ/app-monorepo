import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Empty } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EModalWalletAddressRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EWalletAddressActionType } from '@onekeyhq/shared/types/address';

import { useAccountData } from '../../hooks/useAccountData';
import useAppNavigation from '../../hooks/useAppNavigation';
import { openExplorerAddressUrl } from '../../utils/explorerUtils';
import AddressTypeSelector from '../AddressTypeSelector/AddressTypeSelector';

interface IEmptyHistoryProps {
  walletId?: string;
  accountId?: string;
  networkId?: string;
  indexedAccountId?: string;
  showViewInExplorer?: boolean;
  isSingleAccount?: boolean;
}

function EmptyHistory({
  walletId,
  accountId,
  networkId,
  indexedAccountId,
  isSingleAccount,
}: IEmptyHistoryProps) {
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const { account, network, vaultSettings } = useAccountData({
    accountId,
    networkId,
  });

  const handleOnPress = useCallback(async () => {
    if (
      network?.isAllNetworks &&
      !accountUtils.isOthersWallet({ walletId: walletId ?? '' })
    ) {
      appNavigation.pushModal(EModalRoutes.WalletAddress, {
        screen: EModalWalletAddressRoutes.WalletAddress,
        params: {
          title: intl.formatMessage({
            id: ETranslations.global_select_network,
          }),
          accountId,
          walletId: walletId ?? '',
          indexedAccountId: indexedAccountId ?? '',
          actionType: EWalletAddressActionType.ViewInExplorer,
        },
      });
    } else {
      await openExplorerAddressUrl({
        networkId: account?.createAtNetwork ?? network?.id,
        address: account?.address,
      });
    }
  }, [
    network?.isAllNetworks,
    network?.id,
    walletId,
    appNavigation,
    intl,
    accountId,
    indexedAccountId,
    account?.createAtNetwork,
    account?.address,
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
          <Button size="small" variant="secondary" onPress={() => {}} mt="$3">
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
        doubleConfirm
      />
    ) : (
      <Button size="small" variant="secondary" onPress={handleOnPress} mt="$3">
        {intl.formatMessage({ id: ETranslations.global_block_explorer })}
      </Button>
    );
  }, [
    account?.indexedAccountId,
    handleOnPress,
    indexedAccountId,
    intl,
    isSingleAccount,
    network?.id,
    network?.isAllNetworks,
    networkId,
    vaultSettings?.hideBlockExplorer,
    vaultSettings?.mergeDeriveAssetsEnabled,
    walletId,
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
