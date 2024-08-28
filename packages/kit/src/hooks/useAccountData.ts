import { useIntl } from 'react-intl';

import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
  IVaultSettings,
} from '@onekeyhq/kit-bg/src/vaults/types';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { usePromiseResult } from './usePromiseResult';

import type { IPromiseResultOptions } from './usePromiseResult';

type IUseAccountDataResult = {
  account: INetworkAccount | undefined;
  network: IServerNetwork | undefined;
  wallet: IDBWallet | undefined;
  vaultSettings: IVaultSettings | undefined;
  deriveType: IAccountDeriveTypes | undefined;
  deriveInfo: IAccountDeriveInfo | undefined;
  addressType: string | undefined;
};

export function useAccountData<T extends IUseAccountDataResult>({
  accountId,
  networkId,
  walletId,
  options,
}: {
  accountId?: string;
  networkId?: string;
  walletId?: string;
  options?: IPromiseResultOptions<T>;
}) {
  const intl = useIntl();
  const { serviceAccount, serviceNetwork } = backgroundApiProxy;
  const { result, isLoading, run } = usePromiseResult<IUseAccountDataResult>(
    async () => {
      let deriveType: IAccountDeriveTypes | undefined;
      let deriveInfo: IAccountDeriveInfo | undefined;
      let addressType: string | undefined;

      const [account, network, wallet, vaultSettings] = await Promise.all([
        accountId && networkId
          ? serviceAccount.getAccount({
              accountId,
              networkId,
            })
          : undefined,
        networkId
          ? serviceNetwork.getNetwork({
              networkId,
            })
          : undefined,
        walletId
          ? serviceAccount.getWallet({
              walletId,
            })
          : undefined,
        networkId ? serviceNetwork.getVaultSettings({ networkId }) : undefined,
      ]);

      if (account && networkId) {
        const [addressTypeResp, deriveResp] = await Promise.all([
          serviceAccount.getAccountAddressType({
            accountId: account.id,
            networkId,
            address: account.address,
          }),
          serviceNetwork.getDeriveTypeByTemplate({
            networkId,
            template: account.template,
          }),
        ]);

        addressType = addressTypeResp.typeKey
          ? intl.formatMessage({ id: addressTypeResp.typeKey })
          : addressTypeResp.type ?? '';

        deriveType = deriveResp.deriveType;
        deriveInfo = deriveResp.deriveInfo;
      }

      const obj: IUseAccountDataResult = {
        account,
        network,
        wallet,
        vaultSettings,
        deriveType,
        deriveInfo,
        addressType,
      };
      return obj;
    },
    [accountId, intl, networkId, serviceAccount, serviceNetwork, walletId],
    {
      initResult: {
        account: undefined,
        network: undefined,
        wallet: undefined,
        vaultSettings: undefined,
        deriveType: undefined,
        deriveInfo: undefined,
        addressType: undefined,
      },
      ...options,
    },
  );

  const {
    account,
    wallet,
    network,
    vaultSettings,
    deriveType,
    deriveInfo,
    addressType,
  } = result;
  return {
    account,
    wallet,
    network,
    vaultSettings,
    deriveType,
    deriveInfo,
    addressType,
    run,
    isLoading,
  };
}
