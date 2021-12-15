// set default size on ui.shtml
const UI_HTML_DEFAULT_MIN_HEIGHT = 600;
const UI_HTML_DEFAULT_MIN_WIDTH = 375;

// TODO auto fix on window.addEventListener('resize', reportWindowSize);
function popupSizeFix() {
  if (window.innerHeight < UI_HTML_DEFAULT_MIN_HEIGHT) {
    document.documentElement.style.minHeight = '0';
  }
  if (window.innerWidth < UI_HTML_DEFAULT_MIN_WIDTH) {
    document.documentElement.style.minWidth = '0';
  }
}

export default popupSizeFix;
