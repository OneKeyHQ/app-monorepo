// cspell:words mweb

// Layout fixes for dApps that assume an in-app browser draws its toolbar over
// the page. The mobile browser's WebView ends above its own bottom bar, so
// that room is already free and any extra padding is empty space.
//
// - Uniswap (app.uniswap.org): when it detects an in-app browser (Android
//   "; wv)" UA, or a non-Safari iOS WebView) it sets
//   `--mweb-bottom-inset: calc(env(safe-area-inset-bottom) + 144px)` inline on
//   <html> and pads its bottom sheets by it. A stylesheet `!important` rule
//   wins over that inline value whenever it is set.
export const DAPP_LAYOUT_COMPAT_SCRIPT = `(function () {
  try {
    var id = '__onekey-dapp-layout-compat';
    if (document.getElementById(id)) return;
    var style = document.createElement('style');
    style.id = id;
    style.textContent = ':root{--mweb-bottom-inset:0px !important}';
    (document.head || document.documentElement).appendChild(style);
  } catch (e) {}
})();`;
