/*
- packages/shared/src/web/index.html.ejs
- packages/kit/src/store/reducers/settings.ts # setThemePreloadToLocalStorage
- packages/ext/src/assets/theme-preload.js
 */
(function () {
  const theme = localStorage.getItem('ONEKEY_THEME_PRELOAD');
  if (theme === 'dark') {
    document.documentElement.style.backgroundColor = 'rgb(19, 19, 27)';
  }
  if (theme === 'light' || theme === 'system') {
    document.documentElement.style.backgroundColor = 'white';
  }
})();
