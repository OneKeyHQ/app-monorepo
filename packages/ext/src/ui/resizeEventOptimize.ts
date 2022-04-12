import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Open firefox popup, wait for 5s, do NOT click anything
function checkPerformance() {
  if (platformEnv.isFirefox && platformEnv.isDev) {
    const { addEventListener } = window;
    setTimeout(() => {
      let times = 0;
      const startTime = Date.now();
      let checkEnd = false;
      addEventListener('resize', () => {
        console.log(
          `resize event fired in firefox: >>>>>>  ${new Date().toString()}`,
        );
        if (checkEnd) {
          return;
        }
        times += 1;
        const ms = 1000;
        if (Date.now() > startTime + ms) {
          checkEnd = true;
          console.log(
            `***** Firefox resize event fired ${times} times in ${ms}ms ***** `,
          );
          if (times >= 10) {
            alert(
              'Performance WARNING: Firefox resize event fired in high frequency',
            );
          }
        }
      });
    }, 3000);
  }
}

function optimize() {
  if (process.env.NODE_ENV !== 'production') {
    checkPerformance();
  }
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
