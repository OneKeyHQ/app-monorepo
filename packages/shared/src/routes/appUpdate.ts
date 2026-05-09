export enum EAppUpdateRoutes {
  UpdatePreview = 'UpdatePreview',
  WhatsNew = 'WhatsNew',
  DownloadVerify = 'DownloadVerify',
  ManualInstall = 'ManualInstall',
}

export type IAppUpdatePagesParamList = {
  [EAppUpdateRoutes.UpdatePreview]: {
    latestVersion?: string;
    isForceUpdate?: boolean;
    autoClose?: boolean;
  };
  [EAppUpdateRoutes.DownloadVerify]: undefined;
  [EAppUpdateRoutes.WhatsNew]: undefined;
  [EAppUpdateRoutes.ManualInstall]: undefined;
};
