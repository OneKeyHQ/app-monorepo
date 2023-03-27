import { useCallback } from 'react';

import type { Account } from '@onekeyhq/engine/src/types/account';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { deviceUtils } from '../../../utils/hardware';

import type { IDerivationOption } from '../../../components/NetworkAccountSelector/hooks/useDerivationPath';

export function useCreateBtcCustomAccount({
  walletId,
  networkId,
}: {
  walletId: string;
  networkId: string;
}) {
  const onCreateAccountByAddressIndex = useCallback(
    async ({
      password,
      derivationOption,
      accountIndex,
      addressIndex,
      account,
      onAddedCustomAddressCallback,
    }: {
      password: string;
      derivationOption?: IDerivationOption;
      addressIndex?: string;
      accountIndex?: string;
      account?: Account | null;
      onAddedCustomAddressCallback?: (accountId: string) => void;
    }) => {
      try {
        let addedAccount = account;
        if (!account && accountIndex) {
          const purpose = parseInt(
            derivationOption?.category?.split("'/")?.[0] ?? '44',
          );
          const accounts =
            await backgroundApiProxy.serviceAccount.addHDAccounts(
              password,
              walletId,
              networkId,
              [Number(accountIndex)],
              undefined,
              purpose,
              true,
              derivationOption?.template,
              true,
            );
          addedAccount = accounts?.[0];
        }
        if (addedAccount) {
          await backgroundApiProxy.serviceDerivationPath.createAccountByCustomAddressIndex(
            {
              accountId: addedAccount.id,
              networkId,
              password,
              addressIndex: addressIndex ?? '',
              account: addedAccount,
              template: derivationOption?.template ?? '',
            },
          );
          onAddedCustomAddressCallback?.(addedAccount.id);
        }
      } catch (e) {
        deviceUtils.showErrorToast(e);
      }
    },
    [walletId, networkId],
  );

  return {
    onCreateAccountByAddressIndex,
  };
}
