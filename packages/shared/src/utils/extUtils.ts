import { isNil } from 'lodash';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function openUrl(url: string) {
  window.open(url, '_blank');
}

async function getTabById(tabId: number): Promise<chrome.tabs.Tab> {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, resolve);
  });
}

async function openUrlInTab(
  url: string,
  options: { tabId?: number } = {},
): Promise<chrome.tabs.Tab | undefined> {
  let existingTab: chrome.tabs.Tab | undefined;
  if (!isNil(options.tabId)) {
    existingTab = await getTabById(options.tabId);
  }

  return new Promise((resolve) => {
    if (existingTab && existingTab.id) {
      // TODO close tab or update tab
      chrome.tabs.update(
        existingTab.id,
        {
          url,
          active: true, // focus this tab
        },
        resolve,
      );
      return;
    }

    chrome.tabs.create(
      {
        url,
      },
      resolve,
    );
  });
}

/**
 * ext get html function
 */
export const EXT_HTML_FILES = {
  background: 'background.html',
  uiPopup: 'ui-popup.html',
  uiExpandTab: 'ui-expand-tab.html',
  uiStandAloneWindow: 'ui-standalone-window.html',
};

export function getExtensionIndexHtml() {
  if (platformEnv.isExtensionBackgroundHtml) {
    return EXT_HTML_FILES.background;
  }
  if (platformEnv.isExtensionUiPopup) {
    return EXT_HTML_FILES.uiPopup;
  }
  if (platformEnv.isExtensionUiExpandTab) {
    return EXT_HTML_FILES.uiExpandTab;
  }
  if (platformEnv.isExtensionUiStandaloneWindow) {
    return EXT_HTML_FILES.uiStandAloneWindow;
  }
  return EXT_HTML_FILES.uiExpandTab;
}


export default {
  openUrl,
  openUrlInTab,
};
