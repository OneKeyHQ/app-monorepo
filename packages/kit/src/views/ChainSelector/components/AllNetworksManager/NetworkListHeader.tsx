import { memo, useCallback, useContext, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Checkbox, Divider, Stack, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useEnabledNetworksCompatibleWithWalletIdInAllNetworks } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { AllNetworksManagerContext } from './AllNetworksManagerContext';

function NetworkListHeader() {
  const intl = useIntl();
  const {
    walletId,
    indexedAccountId,
    networks,
    enabledNetworks,
    setNetworksState,
    searchKey,
    isCreatingEnabledAddresses,
    isCreatingMissingAddresses,
    setIsCreatingMissingAddresses,
  } = useContext(AllNetworksManagerContext);

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

  const isAllNetworksEnabled = useMemo(() => {
    if (enabledNetworks.length > 0) {
      if (enabledNetworks.length === networks.mainNetworks.length) {
        return true;
      }
      return 'indeterminate';
    }
    return false;
  }, [enabledNetworks, networks.mainNetworks]);

  const toggleAllNetworks = useMemo(() => {
    return Object.fromEntries(
      networks.mainNetworks.map((network) => [network.id, true]),
    );
  }, [networks.mainNetworks]);

  const handleCreateMissingAddresses = useCallback(async () => {
    setIsCreatingMissingAddresses(true);

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

    try {
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
    } catch (error) {
      setIsCreatingMissingAddresses(false);
      return;
    }

    Toast.success({
      title: intl.formatMessage({
        id: ETranslations.swap_page_toast_address_generated,
      }),
    });
    void run();
    appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
    setIsCreatingMissingAddresses(false);
  }, [
    createAddress,
    enabledNetworksWithoutAccount,
    indexedAccountId,
    intl,
    run,
    setIsCreatingMissingAddresses,
    walletId,
  ]);

  return (
    <Stack mt="$4">
      {enabledNetworksWithoutAccount.length > 0 ? (
        <Stack px="$5" pb="$5">
          <Alert
            type="warning"
            title={intl.formatMessage(
              {
                id: ETranslations.network_enabled_but_no_address_notice,
              },
              {
                count: enabledNetworksCompatibleWithWalletId.length,
              },
            )}
            action={{
              primary: intl.formatMessage({
                id: isCreatingMissingAddresses
                  ? ETranslations.global_creating_address
                  : ETranslations.global_create,
              }),
              isPrimaryLoading: isCreatingMissingAddresses,
              isPrimaryDisabled:
                isCreatingMissingAddresses || isCreatingEnabledAddresses,
              onPrimaryPress: handleCreateMissingAddresses,
            }}
          />
        </Stack>
      ) : null}
      {searchKey?.trim() ? null : (
        <>
          <ListItem
            h="$12"
            py="$0"
            title={intl.formatMessage({
              id: ETranslations.global_select_all,
            })}
            onPress={() => {
              if (isAllNetworksEnabled) {
                setNetworksState({
                  enabledNetworks: {},
                  disabledNetworks: toggleAllNetworks,
                });
              } else {
                setNetworksState({
                  enabledNetworks: toggleAllNetworks,
                  disabledNetworks: {},
                });
              }
            }}
          >
            <Checkbox
              value={isAllNetworksEnabled}
              onChange={() => {
                if (isAllNetworksEnabled) {
                  setNetworksState({
                    enabledNetworks: {},
                    disabledNetworks: toggleAllNetworks,
                  });
                } else {
                  setNetworksState({
                    enabledNetworks: toggleAllNetworks,
                    disabledNetworks: {},
                  });
                }
              }}
            />
          </ListItem>
          <Divider m="$5" />
        </>
      )}
    </Stack>
  );
}

export default memo(NetworkListHeader);
