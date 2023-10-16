async function clearWebViewData() {
  return new Promise((resolve) => {
    window.desktopApi.clearWebViewData();
    resolve(true);
  });
}

export { clearWebViewData };
