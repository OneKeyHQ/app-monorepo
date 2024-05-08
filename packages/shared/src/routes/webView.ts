export enum EModalWebViewRoutes {
  WebView = 'WebView',
}

export type IModalWebViewParamList = {
  [EModalWebViewRoutes.WebView]: {
    title: string;
    url: string;
  };
};
