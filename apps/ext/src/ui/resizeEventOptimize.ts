/* eslint-disable @typescript-eslint/no-var-requires,global-require, @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
// @ts-ignore
import Dimensions from 'react-native-web/dist/exports/Dimensions/index.js';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Open firefox popup, wait for 5s, do NOT click anything
function checkPerformance() {
  if (platformEnv.isRuntimeFirefox && platformEnv.isDev) {
    const { addEventListener } = globalThis;
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
    platformEnv.isRuntimeFirefox &&
    platformEnv.isExtensionUiPopup &&
    // @ts-ignore
    !globalThis.addEventListenerOrigin
  ) {
    // remove firefox resize event handlers after popui resize ready (600ms)
    setTimeout(() => {
      window.removeEventListener('resize', Dimensions._update, false);
    }, 600);

    // @ts-ignore
    globalThis.addEventListenerOrigin = window.addEventListener;
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
      globalThis.addEventListenerOrigin(type, listener, options, ...others);
    };
  }
}

export default optimize;
