const theme = localStorage.getItem('ONEKEY_THEME_PRELOAD');
if (theme === 'dark') {
  document.documentElement.style.backgroundColor = 'black';
}
if (theme === 'light' || theme === 'system') {
  document.documentElement.style.backgroundColor = 'white';
}
