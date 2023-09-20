import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
