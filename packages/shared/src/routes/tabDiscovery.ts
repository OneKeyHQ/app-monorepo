import type { ETranslations } from '../locale';

export enum ETabDiscoveryRoutes {
  TabDiscovery = 'TabDiscovery',
}

export type ITabDiscoveryParamList = {
  [ETabDiscoveryRoutes.TabDiscovery]: {
    defaultTab?: ETranslations;
    earnTab?: 'assets' | 'portfolio' | 'faqs';
  };
};
