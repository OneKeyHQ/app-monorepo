import {
  UI_HTML_DEFAULT_MIN_HEIGHT,
  UI_HTML_DEFAULT_MIN_WIDTH,
} from '../../../ext/src/ui/popupSizeFix';

type OpenUrlRouteInfo = {
  routes: string | string[];
  params?: any;
};

function buildExtRouteUrl(
  htmlFile: string,
  { routes, params = {} }: OpenUrlRouteInfo,
) {
  /*
  http://localhost:3001/#/modal/DappConnectionModal/ConnectionModal?id=0&origin=https%3A%2F%2Fmetamask.github.io&scope=ethereum&data=%7B%22method%22%3A%22eth_requestAccounts%22%2C%22jsonrpc%22%3A%222.0%22%7D
   */
  // eslint-disable-next-line no-param-reassign
  routes = ([] as string[]).concat(routes).join('/');
  const paramsStr = new URLSearchParams(params).toString();
  return chrome.runtime.getURL(`/${htmlFile}#/${routes}?${paramsStr}`);
}

function openUrl(url: string) {
  window.open(url, '_blank');
}

function openUrlInTab(url: string) {
  return chrome.tabs.create({
    url,
  });
}

function openExpandTab(routeInfo: OpenUrlRouteInfo) {
  const url = buildExtRouteUrl('ui-expand-tab.html', routeInfo);
  return openUrlInTab(url);
}

function openStandaloneWindow(routeInfo: OpenUrlRouteInfo) {
  const url = buildExtRouteUrl('ui-standalone-window.html', routeInfo);
  return chrome.windows.create({
    focused: true,
    type: 'popup',
    // init size same to ext ui-popup.html
    height: UI_HTML_DEFAULT_MIN_HEIGHT + 50, // height including title bar, so should add 50px more
    width: UI_HTML_DEFAULT_MIN_WIDTH,
    // check useAutoRedirectToRoute()
    url,
  });
}

export default {
  openUrl,
  openUrlInTab,
  openExpandTab,
  openStandaloneWindow,
};
