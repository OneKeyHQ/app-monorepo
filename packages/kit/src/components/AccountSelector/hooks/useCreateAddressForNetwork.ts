import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { useAccountSelectorCreateAddress } from './useAccountSelectorCreateAddress';

// The "create address for a network, enable it under All Networks, tell the
// user" flow shared by the network pickers (Receive network list, aggregate
// token network selector). Returns the new account id, or undefined when the
// user cancelled on the device.
export function useCreateAddressForNetwork() {
  const intl = useIntl();
  const { createAddress } = useAccountSelectorCreateAddress();

  const enableNetwork = useCallback(async (networkId: string) => {
    await backgroundApiProxy.serviceAllNetwork.updateAllNetworksState({
      enabledNetworks: { [networkId]: true },
    });
    appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
  }, []);

  const createAddressForNetwork = useCallback(
    async ({
      walletId,
      indexedAccountId,
      networkId,
      isNetworkEnabled,
    }: {
      walletId: string | undefined;
      indexedAccountId: string | undefined;
      networkId: string;
      isNetworkEnabled: boolean;
    }): Promise<string | undefined> => {
      const deriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId,
        });
      const result = await createAddress({
        num: 0,
        selectAfterCreate: false,
        account: { walletId, networkId, indexedAccountId, deriveType },
      });
      const accountId = result?.accounts[0]?.id;
      if (!accountId) {
        return undefined;
      }
      if (!isNetworkEnabled) {
        await enableNetwork(networkId);
      }
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.swap_page_toast_address_generated,
        }),
        message: isNetworkEnabled
          ? ''
          : intl.formatMessage({ id: ETranslations.network_also_enabled }),
      });
      appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
      return accountId;
    },
    [createAddress, enableNetwork, intl],
  );

  return { createAddressForNetwork, enableNetwork };
}
