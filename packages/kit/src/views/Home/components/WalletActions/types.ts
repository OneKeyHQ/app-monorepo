export type IWalletActionType =
  | 'send'
  | 'receive'
  | 'swap'
  | 'bridge'
  | 'buy'
  | 'sell'
  | 'staking'
  | 'perp'
  | 'earn'
  | 'explorer'
  | 'copy'
  | 'sign'
  | 'reward'
  | 'export'
  | 'vote'
  | 'custom';

export type IMoreActionGroupType = 'trading' | 'tools' | 'developer' | 'others';

export interface IActionCustomization {
  label?: string;
  icon?: any;
  disabled?: boolean;
  onPress?: () => void | Promise<void>;
}

export interface IMoreActionGroup {
  type: IMoreActionGroupType;
  actions: IWalletActionType[];
  order: number;
}

export interface INetworkWalletActionsConfig {
  mainActions: IWalletActionType[];
  moreActions: IWalletActionType[];
  moreActionGroups?: IMoreActionGroup[];
  actionCustomization?: Partial<
    Record<IWalletActionType, IActionCustomization>
  >;
}
