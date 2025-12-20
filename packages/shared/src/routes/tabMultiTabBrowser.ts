export enum EMultiTabBrowserRoutes {
  MultiTabBrowser = 'MultiTabBrowser',
}

export type IMultiTabBrowserParamList = {
  [EMultiTabBrowserRoutes.MultiTabBrowser]: {
    action?: 'create_new_tab';
  };
};
