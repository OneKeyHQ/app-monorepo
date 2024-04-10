import type {
  IAccountSelectorAvailableNetworks,
  IAccountSelectorRouteParams,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IServerNetwork } from '@onekeyhq/shared/types';

export enum EChainSelectorPages {
  AccountChainSelector = 'AccountChainSelector',
  ChainSelector = 'ChainSelector',
}
export type IAccountChainSelectorRouteParams = IAccountSelectorRouteParams &
  IAccountSelectorAvailableNetworks & {
    editable?: boolean;
  };

export type IChainSelectorParams = {
  defaultNetworkId?: string;
  networkIds?: string[];
  title?: string;
  onSelect?: (network: IServerNetwork) => void;
};

export type IChainSelectorParamList = {
  [EChainSelectorPages.AccountChainSelector]: IAccountChainSelectorRouteParams;
  [EChainSelectorPages.ChainSelector]?: IChainSelectorParams;
};
