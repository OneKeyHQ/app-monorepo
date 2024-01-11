import { EGalleryRoutes } from './pages/routes';

export enum ETabDeveloperRoutes {
  TabDeveloper = 'TabDeveloper',
  ComponentsGallery = EGalleryRoutes.Components,
  DevHome = 'DevHome',
  DevHomeStack1 = 'DevHomeStack1',
  DevHomeStack2 = 'DevHomeStack2',
  Common = 'Common',
}

export type ITabDeveloperParamList = {
  [ETabDeveloperRoutes.TabDeveloper]: undefined;
  [ETabDeveloperRoutes.ComponentsGallery]: undefined;
  [ETabDeveloperRoutes.DevHome]: undefined;
  [ETabDeveloperRoutes.DevHomeStack1]: { a: string; b: string };
  [ETabDeveloperRoutes.DevHomeStack2]: undefined;
  [ETabDeveloperRoutes.Common]: undefined;
};
