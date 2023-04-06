import type { DappSiteConnection } from '../../store/reducers/dapp';

export enum ManageConnectedSitesRoutes {
  ManageConnectedSitesModel = 'ManageConnectedSitesModal',
}

export type ManageConnectedSitesRoutesParams = {
  [ManageConnectedSitesRoutes.ManageConnectedSitesModel]: undefined;
};

export type ConnectedSitesHeaderProps = {
  onDisConnectWalletConnected: (
    dappName: string,
    disconnect: () => Promise<any>,
  ) => void;
  onAddConnectSite: () => void;
  connections: DappSiteConnection[];
};

export type AddConnectionSideDialogProps = {
  onClose?: () => void;
};
