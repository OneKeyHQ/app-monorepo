function openUrl(url: string) {
  window.open(url, '_blank');
}

function openStandaloneWindow({
  route,
  hash = '',
}: {
  route: string;
  hash?: string;
}) {
  return chrome.windows.create({
    focused: true,
    type: 'popup',
    // init size same to ext ui-popup.html
    height: 600 + 50, // height including title bar, so should add 50 more
    width: 375,
    // check useAutoRedirectToRoute()
    url: `/ui-standalone-window.html?route=${route}#${hash}`,
  });
}

// TODO open only single approval window
function openApprovalWindow() {
  return openStandaloneWindow({
    route: 'Components/Approval',
    hash: 'approval-window',
  });
}

export default {
  openUrl,
  openStandaloneWindow,
  openApprovalWindow,
};
