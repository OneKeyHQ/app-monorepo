import type { IServerNetwork } from '@onekeyhq/shared/types';

import type { IServerNetworkMatch } from '../../types';

export type IEditableChainSelectorContext = {
  frequentlyUsedItemsIds: Set<string>;
  frequentlyUsedItems: IServerNetwork[];
  setFrequentlyUsedItems?: (networks: IServerNetwork[]) => void;

  isEditMode?: boolean;
  walletId: string;
  indexedAccountId?: string;
  networkId?: string;
  searchText?: string;
  onPressItem?: (item: IServerNetwork) => void;
  onEditCustomNetwork?: (item: IServerNetwork) => void;

  allNetworkItem?: IServerNetwork;
  setRecentNetworksHeight?: (height: number) => void;
  accountNetworkValues: Record<string, string>;
  accountNetworkValueCurrency?: string;
  accountDeFiOverview: Record<
    string,
    {
      netWorth: number;
    }
  >;
};

export type IEditableChainSelectorSection = {
  title?: string;
  data: IServerNetworkMatch[];
  unavailable?: boolean;
  draggable?: boolean;
  editable?: boolean;
  isCustomNetworkEditable?: boolean;
};

export const CELL_HEIGHT = 48;

export const ALL_NETWORK_HEADER_HEIGHT = 32;
