import { EGalleryRoutes } from './Gallery/routes';

export enum ETabDeveloperRoutes {
  TabDeveloper = 'TabDeveloper',
  ComponentsGallery = EGalleryRoutes.Components,
}

export type ITabDeveloperParamList = {
  [ETabDeveloperRoutes.TabDeveloper]: undefined;
  [ETabDeveloperRoutes.ComponentsGallery]: undefined;
};
