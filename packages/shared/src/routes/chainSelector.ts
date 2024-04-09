import type {
  IAccountSelectorAvailableNetworks,
  IAccountSelectorRouteParams,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IServerNetwork } from '@onekeyhq/shared/types';

export enum EChainSelectorPages {
  ChainSelector = 'ChainSelector',
  ConfigurableChainSelector = 'ConfigurableChainSelector',
}
export type IChainSelectorRouteParams = IAccountSelectorRouteParams &
  IAccountSelectorAvailableNetworks & {
    immutable?: boolean;
  };

export type IConfigurableChainSelectorParams = {
  defaultNetworkId?: string;
  networkIds?: string[];
  title?: string;
  onSelect?: (network: IServerNetwork) => void;
};

export type IChainSelectorParamList = {
  [EChainSelectorPages.ChainSelector]: IChainSelectorRouteParams;
  [EChainSelectorPages.ConfigurableChainSelector]?: IConfigurableChainSelectorParams;
};
