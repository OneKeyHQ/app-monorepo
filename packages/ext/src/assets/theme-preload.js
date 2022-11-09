const theme = localStorage.getItem('ONEKEY_THEME_PRELOAD');
if (theme === 'dark') {
  document.documentElement.style.backgroundColor = 'rgb(19, 19, 27)';
}
if (theme === 'light' || theme === 'system') {
  document.documentElement.style.backgroundColor = 'white';
}
