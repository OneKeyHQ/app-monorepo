import { memo, useCallback, useContext, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Stack, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import { useEnabledNetworksCompatibleWithWalletIdInAllNetworks } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { WalletAddressContext } from './WalletAddressContext';

function WalletAddressListHeader() {
  const intl = useIntl();
  const { walletId, indexedAccountId, setAccountsCreated, refreshLocalData } =
    useContext(WalletAddressContext);

  const {
    enabledNetworksCompatibleWithWalletId,
    enabledNetworksWithoutAccount,
    run,
  } = useEnabledNetworksCompatibleWithWalletIdInAllNetworks({
    walletId: walletId ?? '',
    indexedAccountId,
    filterNetworksWithoutAccount: true,
  });

  const { createAddress } = useAccountSelectorCreateAddress();

  const [isCreatingAllAddresses, setIsCreatingAllAddresses] = useState(false);

  const handleCreateAllAddresses = useCallback(async () => {
    setIsCreatingAllAddresses(true);

    const enabledNetworksWithoutAccountTemp: {
      networkId: string;
      deriveType: IAccountDeriveTypes;
    }[] = [];

    for (const network of enabledNetworksWithoutAccount) {
      enabledNetworksWithoutAccountTemp.push({
        networkId: network.id,
        deriveType:
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId: network.id,
          }),
      });
    }

    await createAddress({
      num: 0,
      account: {
        walletId,
        indexedAccountId,
        networkId: getNetworkIdsMap().onekeyall,
        deriveType: 'default',
      },
      customNetworks: enabledNetworksWithoutAccountTemp,
    });

    Toast.success({
      title: intl.formatMessage({
        id: ETranslations.swap_page_toast_address_generated,
      }),
    });
    setAccountsCreated(true);
    void run();
    refreshLocalData();
    setIsCreatingAllAddresses(false);
  }, [
    createAddress,
    enabledNetworksWithoutAccount,
    indexedAccountId,
    intl,
    refreshLocalData,
    run,
    setAccountsCreated,
    walletId,
  ]);

  useEffect(() => {
    const refresh = async () => {
      await run({ alwaysSetState: true });
    };
    appEventBus.on(EAppEventBusNames.EnabledNetworksChanged, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.EnabledNetworksChanged, refresh);
    };
  }, [run]);

  return enabledNetworksWithoutAccount.length > 0 ? (
    <Stack mt="$4" px="$5" pb="$5">
      <Alert
        type="warning"
        title={`You have ${enabledNetworksCompatibleWithWalletId.length} enabled networks, but some don’t have addresses yet`}
        action={{
          primary: intl.formatMessage({
            id: isCreatingAllAddresses
              ? ETranslations.global_creating_address
              : ETranslations.global_create,
          }),
          isPrimaryLoading: isCreatingAllAddresses,
          onPrimaryPress: handleCreateAllAddresses,
        }}
      />
    </Stack>
  ) : null;
}

export default memo(WalletAddressListHeader);
