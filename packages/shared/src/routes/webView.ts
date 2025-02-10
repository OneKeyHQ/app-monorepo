import type { EWebEmbedRoutePath } from '../consts/webEmbedConsts';

export enum EModalWebViewRoutes {
  WebView = 'WebView',
}

export type IModalWebViewParamList = {
  [EModalWebViewRoutes.WebView]: {
    title: string;
    url: string;
    isWebEmbed?: boolean;
    hashRoutePath?: EWebEmbedRoutePath;
    hashRouteQueryParams?: Record<string, string>;
  };
};
