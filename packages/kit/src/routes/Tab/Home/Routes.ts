export enum ETabHomeRoutes {
  TabHome = 'TabHome',
  TabHomeStack1 = 'TabHomeStack1',
  TabHomeStack2 = 'TabHomeStack2',
}

export type ITabHomeParamList = {
  [ETabHomeRoutes.TabHome]: undefined;
  [ETabHomeRoutes.TabHomeStack1]: { a: string; b: string };
  [ETabHomeRoutes.TabHomeStack2]: undefined;
};
