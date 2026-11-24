export enum EAppUpdateRoutes {
  UpdatePreview = 'UpdatePreview',
  WhatsNew = 'WhatsNew',
  DownloadVerify = 'DownloadVerify',
  ManualInstall = 'ManualInstall',
  FeaturedChangelogPreview = 'FeaturedChangelogPreview',
}

export type IAppUpdatePagesParamList = {
  [EAppUpdateRoutes.UpdatePreview]: {
    latestVersion?: string;
    isForceUpdate?: boolean;
    autoClose?: boolean;
  };
  [EAppUpdateRoutes.DownloadVerify]:
    | { isForceUpdate?: boolean; downloadHandoffId?: string }
    | undefined;
  [EAppUpdateRoutes.WhatsNew]: undefined;
  [EAppUpdateRoutes.ManualInstall]: undefined;
  [EAppUpdateRoutes.FeaturedChangelogPreview]: {
    version?: string;
  };
};
