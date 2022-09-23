import { useWebviewRef } from './useWebviewRef';

export const useWebController = () => {
  const {
    canGoBack: webCanGoBack,
    canGoForward: webCanGoForward,
    goBack,
    goForward,
    stopLoading,
    loading: webLoading,
    url: webUrl,
    title: webTitle,
    favicon: webFavicon,
  } = useWebviewRef(webviewRef, navigationStateChangeEvent, (url: string) => {
    //     setCurrentWebSite({ url });
    //     dispatch(
    //       addWebSiteHistory({
    //         keyUrl: undefined,
    //         webSite: { url },
    //       }),
    //     );
  });
};
