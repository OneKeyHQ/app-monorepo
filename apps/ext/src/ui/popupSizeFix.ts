// set default size on ui.shtml
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Chrome extension popups can have a maximum height of 600px and maximum width of 800px
export const UI_HTML_DEFAULT_MIN_WIDTH = 375;
export const UI_HTML_DEFAULT_MIN_HEIGHT = 600;

// TODO auto fix on window.addEventListener('resize', reportWindowSize);
function popupSizeFix() {
  // only set size if in popup
  if (!platformEnv.isExtensionUiPopup) {
    return;
  }

  // TODO set initial value in html, and remove it from js (not popup.html env)
  document.documentElement.style.minHeight = `${UI_HTML_DEFAULT_MIN_HEIGHT}px`;
  document.documentElement.style.minWidth = `${UI_HTML_DEFAULT_MIN_WIDTH}px`;

  // firefox should set to body element, chrome should set to html element
  if (platformEnv.isRuntimeFirefox) {
    document.body.style.minHeight = `${UI_HTML_DEFAULT_MIN_HEIGHT}px`;
    document.body.style.minWidth = `${UI_HTML_DEFAULT_MIN_WIDTH}px`;
  }
  // console
}

export default popupSizeFix;
