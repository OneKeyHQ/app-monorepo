import { useCallback } from 'react';

import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export function useFalconUSDfRegister() {
  return useCallback(
    async ({
      accountId,
      networkId,
    }: {
      networkId: string;
      accountId: string;
    }) => {
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });
      console.log('register');

      const unsignedMessage =
        'Sign in to Falcon Finance.\nNonce: d89dbc86bb52c6455f89f2c189e31494\nExpires at: 2025-04-16T01:56:03Z';

      const signHash =
        (await backgroundApiProxy.serviceDApp.openSignMessageModal({
          accountId,
          networkId,
          request: { origin: 'https://app.falcon.finance/', scope: 'ethereum' },
          unsignedMessage: {
            type: EMessageTypesEth.PERSONAL_SIGN,
            message: unsignedMessage,
            payload: [account.address, unsignedMessage],
          },
          walletInternalSign: true,
        })) as string;

      console.log('=====>>>>>>: ', signHash);

      return signHash;
    },
    [],
  );
}
