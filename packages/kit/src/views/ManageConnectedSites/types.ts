import type { IWalletConnectSession } from '@walletconnect/types';

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
  walletConnectSessions: IWalletConnectSession[];
};

export type AddConnectionSideDialogProps = {
  closeOverlay: () => void;
};
