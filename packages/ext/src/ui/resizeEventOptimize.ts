import platformEnv from '@onekeyhq/shared/src/platformEnv';

function optimize() {
  // TODO HACK: firefox auto resize event performance fix
  //      ( trigger resize per 1s in popup-ui )
  if (
    platformEnv.isFirefox &&
    platformEnv.isExtensionUiPopup &&
    // @ts-ignore
    !window.addEventListenerOrigin
  ) {
    // @ts-ignore
    window.addEventListenerOrigin = window.addEventListener;
    window.addEventListener = (
      type: string,
      listener: any,
      options: any,
      ...others: any
    ) => {
      // disable resize event for firefox popup performance
      if (type === 'resize') {
        return;
      }
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      window.addEventListenerOrigin(type, listener, options, ...others);
    };
  }
}

export default optimize;
