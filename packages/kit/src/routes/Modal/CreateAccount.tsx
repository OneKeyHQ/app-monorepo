import { useIsVerticalLayout } from '@onekeyhq/components';
import type {
  Account,
  ImportableHDAccount,
} from '@onekeyhq/engine/src/types/account';
import AddNewAccountModal from '@onekeyhq/kit/src/views/Account/AddNewAccount';
import CreateAccountAuthenticationModal from '@onekeyhq/kit/src/views/Account/AddNewAccount/Authentication';
import RecoverAccounts from '@onekeyhq/kit/src/views/Account/AddNewAccount/RecoverAccounts';
import RecoverAccountsAdvanced from '@onekeyhq/kit/src/views/Account/AddNewAccount/RecoverAccountsAdvanced';
import RecoverConfirm from '@onekeyhq/kit/src/views/Account/AddNewAccount/RecoverConfirm';
import SelectChain from '@onekeyhq/kit/src/views/Account/AddNewAccount/SelectChain';
import type {
  IFetchAddressByRange,
  IFetchAddressByWallet,
} from '@onekeyhq/kit/src/views/Account/BulkCopyAddress';
import BulkCopyAddresses from '@onekeyhq/kit/src/views/Account/BulkCopyAddress';
import FetchAddressModal from '@onekeyhq/kit/src/views/Account/BulkCopyAddress/FetchAddressModal';

import { CreateAccountModalRoutes } from '../routesEnum';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

export { CreateAccountModalRoutes };

type RecoverAccountsAdvancedParams = {
  fromIndex: number;
  generateCount?: number;
  networkId?: string;
};

export type CreateAccountRoutesParams = {
  [CreateAccountModalRoutes.CreateAccountForm]: {
    walletId: string;
    selectedNetworkId?: string;
  };
  [CreateAccountModalRoutes.CreateAccountAuthentication]: {
    onDone: (password: string) => void;
    walletId: string;
  };
  [CreateAccountModalRoutes.RecoverySelectChainList]: {
    walletId: string;
  };
  [CreateAccountModalRoutes.RecoverAccountsList]: {
    walletId: string;
    network: string;
    password: string;
    purpose: number;
    template: string;
  };
  [CreateAccountModalRoutes.RecoverAccountsAdvanced]: RecoverAccountsAdvancedParams & {
    onApply: (options: RecoverAccountsAdvancedParams) => void;
  };
  [CreateAccountModalRoutes.RecoverAccountsConfirm]: {
    accounts: (ImportableHDAccount & {
      selected: boolean;
      isDisabled: boolean;
    })[];
    walletId: string;
    network: string;
    purpose: number;
    template: string;
    existingAccounts: Account[];
    config: RecoverAccountsAdvancedParams;
  };
  [CreateAccountModalRoutes.RecoverAccountsConfirmAuthentication]: {
    walletId: string;
    onDone: (password: string) => void;
  };
  [CreateAccountModalRoutes.BulkCopyAddresses]: {
    networkId: string;
    walletId: string;
    password: string;
  };
  [CreateAccountModalRoutes.FetchAddressModal]: {
    networkId: string;
    walletId: string;
    password: string;
    data: IFetchAddressByRange | IFetchAddressByWallet;
  };
};

const CreateAccountNavigator =
  createStackNavigator<CreateAccountRoutesParams>();

const modalRoutes = [
  {
    name: CreateAccountModalRoutes.CreateAccountForm,
    component: AddNewAccountModal,
  },
  {
    name: CreateAccountModalRoutes.CreateAccountAuthentication,
    component: CreateAccountAuthenticationModal,
  },
  {
    name: CreateAccountModalRoutes.RecoverAccountsList,
    component: RecoverAccounts,
  },
  {
    name: CreateAccountModalRoutes.RecoverAccountsAdvanced,
    component: RecoverAccountsAdvanced,
  },
  {
    name: CreateAccountModalRoutes.RecoverAccountsConfirm,
    component: RecoverConfirm,
  },
  {
    name: CreateAccountModalRoutes.RecoverAccountsConfirmAuthentication,
    component: CreateAccountAuthenticationModal,
  },
  {
    name: CreateAccountModalRoutes.RecoverySelectChainList,
    component: SelectChain,
  },
  {
    name: CreateAccountModalRoutes.BulkCopyAddresses,
    component: BulkCopyAddresses,
  },
  {
    name: CreateAccountModalRoutes.FetchAddressModal,
    component: FetchAddressModal,
  },
];

const CreateAccountModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <CreateAccountNavigator.Navigator
      screenOptions={(navInfo) => ({
        ...buildModalStackNavigatorOptions({ isVerticalLayout, navInfo }),
      })}
    >
      {modalRoutes.map((route) => (
        <CreateAccountNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </CreateAccountNavigator.Navigator>
  );
};

export default CreateAccountModalStack;
