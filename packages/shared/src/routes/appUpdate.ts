export enum EAppUpdateRoutes {
  UpdatePreview = 'UpdatePreview',
}

export type IAppUpdatePagesParamList = {
  [EAppUpdateRoutes.UpdatePreview]: {
    version?: string;
    latestVersion?: string;
    changeLog?: string;
  };
};
