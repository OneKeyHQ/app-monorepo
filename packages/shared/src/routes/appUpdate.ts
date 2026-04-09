export enum EAppUpdateRoutes {
  UpdatePreview = 'UpdatePreview',
  FeaturedChangelog = 'FeaturedChangelog',
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
  [EAppUpdateRoutes.FeaturedChangelog]: {
    isPreInstall?: boolean;
    latestVersion?: string;
    isForceUpdate?: boolean;
  };
  [EAppUpdateRoutes.DownloadVerify]: undefined;
  [EAppUpdateRoutes.WhatsNew]: undefined;
  [EAppUpdateRoutes.ManualInstall]: undefined;
};
