export enum EAppUpdateRoutes {
  UpdatePreview = 'UpdatePreview',
  WhatsNew = 'WhatsNew',
}

export type IAppUpdatePagesParamList = {
  [EAppUpdateRoutes.UpdatePreview]: {
    version?: string;
    latestVersion?: string;
    changeLog?: string;
  };
  [EAppUpdateRoutes.WhatsNew]: {
    version?: string;
    changeLog?: string;
  };
};
