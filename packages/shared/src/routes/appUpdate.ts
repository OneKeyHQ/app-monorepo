export enum EAppUpdateRoutes {
  UpdatePreview = 'UpdatePreview',
  WhatsNew = 'WhatsNew',
}

export type IAppUpdatePagesParamList = {
  [EAppUpdateRoutes.UpdatePreview]: {
    latestVersion?: string;
    isForceUpdate?: boolean;
    autoClose?: boolean;
  };
  [EAppUpdateRoutes.DownloadVerify]: undefined;
  [EAppUpdateRoutes.WhatsNew]: undefined;
};
