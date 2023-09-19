import { useCallback, useEffect, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { UserInputCategory } from '@onekeyhq/engine/src/types/credential';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { wait } from '../../utils/helper';
import {
  CreateWalletModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../routesEnum';

export const AccountRootLandingPathSchema = '/account/:address/:networkId?';
export function buildAccountLandingLink({
  address,
  networkId,
}: {
  address: string;
  networkId?: string;
}) {
  const url = `/account/${address}/${networkId || ''}`;
  const webOrigin = 'https://app.onekey.so';
  // return `${ONEKEY_APP_DEEP_LINK}${url}`;
  return `${webOrigin}${url}`;
}

/*
$navigationRef.current.navigate('account',{address:'0x'})
*/

function AccountRootLanding() {
  const { serviceAccount } = backgroundApiProxy;
  const route = useRoute();
  const navigation = useAppNavigation();
  const routeParams = route.params as
    | { address: string; networkId?: string }
    | undefined;

  const networkId = useMemo(
    () => routeParams?.networkId || '',
    [routeParams?.networkId],
  );

  const address = useMemo(
    () => routeParams?.address || '',
    [routeParams?.address],
  );

  const canImportAddress = useCallback(async () => {
    const results = await backgroundApiProxy.validator.validateCreateInput({
      input: address,
      onlyFor: UserInputCategory.WATCHING,
    });
    return Boolean(results?.length);
  }, [address]);
  useEffect(() => {
    (async () => {
      // ** redirect to Home is required.
      navigation.navigate(RootRoutes.Main);

      // TODO evm lowercase
      const success = await serviceAccount.changeActiveAccountByAddress({
        address,
        networkId,
      });

      if (!success && (await canImportAddress())) {
        await wait(300);
        // TODO check network exists
        // TODO test App Deeplink, Universal Link
        // TODO if native app, open deeplink
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.CreateWallet,
          params: {
            screen: CreateWalletModalRoutes.AddExistingWalletModal,
            params: { mode: 'watching', presetText: routeParams?.address },
          },
        });
      }
    })();
  }, [
    address,
    canImportAddress,
    navigation,
    networkId,
    routeParams,
    serviceAccount,
  ]);
  return null;
}

export default AccountRootLanding;
