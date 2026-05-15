import type { ETranslations } from '@onekeyhq/shared/src/locale';

export type IWalletActionType =
  | 'send'
  | 'receive'
  | 'swap'
  | 'bridge'
  | 'buy'
  | 'staking'
  | 'perp'
  | 'earn'
  | 'explorer'
  | 'copy'
  | 'addressList'
  | 'coins'
  | 'bulkSend'
  | 'sign'
  | 'reward'
  | 'export'
  | 'vote'
  | 'approvals'
  | 'custom';

export type IMoreActionGroupType = 'trading' | 'tools' | 'developer' | 'others';

export interface IActionCustomization {
  labelId?: ETranslations;
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
