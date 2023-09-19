import { useIsVerticalLayout } from '@onekeyhq/components';
import type {
  Account,
  ImportableHDAccount,
} from '@onekeyhq/engine/src/types/account';

import AddNewAccountModal from '../../../views/Account/AddNewAccount';
import CreateAccountAuthenticationModal from '../../../views/Account/AddNewAccount/Authentication';
import BitcoinUsedAddress from '../../../views/Account/AddNewAccount/BitcoinUsedAddress';
import RecoverAccounts from '../../../views/Account/AddNewAccount/RecoverAccounts';
import RecoverAccountsAdvanced from '../../../views/Account/AddNewAccount/RecoverAccountsAdvanced';
import RecoverConfirm from '../../../views/Account/AddNewAccount/RecoverConfirm';
import SelectChain from '../../../views/Account/AddNewAccount/SelectChain';
import BulkCopyAddresses from '../../../views/Account/BulkCopyAddress';
import ExportAddresses from '../../../views/Account/BulkCopyAddress/ExportAddresses';
import FetchAddressModal from '../../../views/Account/BulkCopyAddress/FetchAddressModal';
import { CreateAccountModalRoutes } from '../../routesEnum';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

import type {
  IFetchAddressByRange,
  IFetchAddressByWallet,
} from '../../../views/Account/BulkCopyAddress';
import type { IExportAddressData } from '../../../views/Account/BulkCopyAddress/FetchAddressModal';

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
    entry: 'accountSelector' | 'manageAccount';
    template?: string;
  };
  [CreateAccountModalRoutes.FetchAddressModal]: {
    networkId: string;
    walletId: string;
    password: string;
    data: IFetchAddressByRange | IFetchAddressByWallet;
  };
  [CreateAccountModalRoutes.ExportAddresses]: {
    networkId: string;
    walletId: string;
    data: IExportAddressData[];
  };
  [CreateAccountModalRoutes.BitcoinUsedAddress]: {
    walletId: string;
    accountId: string;
    networkId: string;
    entry: 'usedAddress' | 'manageAccount';
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
  {
    name: CreateAccountModalRoutes.ExportAddresses,
    component: ExportAddresses,
  },
  {
    name: CreateAccountModalRoutes.BitcoinUsedAddress,
    component: BitcoinUsedAddress,
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
