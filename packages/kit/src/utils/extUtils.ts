type OpenUrlRouteInfo = {
  route: string;
  hash?: string;
};

function buildExtRouteUrl(
  htmlFile: string,
  { route, hash = '' }: OpenUrlRouteInfo,
) {
  return chrome.runtime.getURL(`/${htmlFile}?route=${route}#${hash}`);
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
    height: 600 + 50, // height including title bar, so should add 50 more
    width: 375,
    // check useAutoRedirectToRoute()
    url,
  });
}

// TODO open only single approval window
function openApprovalWindow() {
  return openStandaloneWindow({
    route: 'component/approval',
    hash: 'approval-window',
  });
}

export default {
  openUrl,
  openUrlInTab,
  openExpandTab,
  openStandaloneWindow,
  openApprovalWindow,
};
