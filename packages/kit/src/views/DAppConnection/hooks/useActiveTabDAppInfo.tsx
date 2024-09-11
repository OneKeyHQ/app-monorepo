import type { IConnectionAccountInfoWithNum } from '@onekeyhq/shared/types/dappConnection';

export interface IExtensionActiveTabDAppInfo {
  url: string;
  origin: string;
  showFloatingPanel: boolean;
  connectedAccountsInfo: IConnectionAccountInfoWithNum[] | null;
  faviconUrl: string | undefined;
  originFaviconUrl: string | undefined;
  connectLabel: string;
  networkIcons: string[];
  addressLabel: string;
}

export interface IExtensionActiveTabDAppInfoResult {
  result: IExtensionActiveTabDAppInfo | null;
  refreshConnectionInfo: () => void;
}

export default function useActiveTabDAppInfo(): IExtensionActiveTabDAppInfoResult {
  return {
    result: null,
    refreshConnectionInfo: () => {},
  };
}
