import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';

import type { INetworkAccount } from '../../types/account';

export enum EModalBulkCopyAddressesRoutes {
  BulkCopyAddressesModal = 'BulkCopyAddressesModal',
  ExportAddressesModal = 'ExportAddressesModal',
}

export type IModalBulkCopyAddressesParamList = {
  [EModalBulkCopyAddressesRoutes.BulkCopyAddressesModal]: {
    walletId?: string;
    networkId: string;
  };
  [EModalBulkCopyAddressesRoutes.ExportAddressesModal]: {
    walletId: string;
    networkId: string;
    exportWithoutDevice?: boolean;
    parentWalletName?: string;
    networkAccountsByDeriveType: Record<
      string,
      {
        deriveType: IAccountDeriveTypes;
        deriveInfo: IAccountDeriveInfo;
        account: INetworkAccount & { displayAddress?: string };
      }[]
    >;
  };
};
