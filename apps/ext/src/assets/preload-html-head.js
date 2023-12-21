/*
- packages/shared/src/web/index.html.ejs
- packages/kit/src/store/reducers/settings.ts # setThemePreloadToLocalStorage
- apps/ext/src/assets/preload-html-head.js
 */
(function () {
  // $$onekeyPerfTrace start ----------------------------------------------
  window.$$onekeyPerfTrace = {
    timeline: [],
    log: ({ name, payload }) => {
      const lastStat =
        window.$$onekeyPerfTrace.timeline[
          window.$$onekeyPerfTrace.timeline.length - 1
        ];
      const perfNow = window.performance.now();
      const time = new Date().toLocaleString();
      window.$$onekeyPerfTrace.timeline.push({
        lag: parseInt(String(lastStat ? perfNow - lastStat.elapsed : 0), 10),
        name,
        time,
        elapsed: parseInt(String(perfNow), 10),
        payload,
      });
      // keep limited array length to avoid memory leak
      window.$$onekeyPerfTrace.timeline =
        window.$$onekeyPerfTrace.timeline.slice(-200);
    },
  };
  window.$$onekeyPerfTrace.log({
    name: 'APP_START: preload-html-head.js start',
  });
  // $$onekeyPerfTrace end ----------------------------------------------

  // optimizeResize start ----------------------------------------------
  /* TEST CODE
const handler = ()=>console.log('ffffff');
window.addEventListener('resize', handler);
window.removeEventListener('resize',handler);
   */
  function debounce(func, timeout = 600) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        func.apply(this, args);
      }, timeout);
    };
  }
  function optimizeResize() {
    const resizeEventMap = new Map();
    window.$$onekeyWindowResizeEventMap = resizeEventMap;
    // @ts-ignore
    window.addEventListenerOld = window.addEventListener;
    window.removeEventListenerOld = window.removeEventListener;
    window.addEventListener = (eventName, handler) => {
      if (eventName === 'resize') {
        const debouncedHandler = debounce(handler, 300);
        resizeEventMap.set(handler, debouncedHandler);
        window.addEventListenerOld(eventName, debouncedHandler);
      } else {
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        window.addEventListenerOld(eventName, handler);
      }
    };
    window.removeEventListener = (eventName, handler) => {
      if (eventName === 'resize') {
        const debouncedHandler = resizeEventMap.get(handler);
        if (debouncedHandler) {
          resizeEventMap.delete(handler);
          window.removeEventListenerOld(eventName, debouncedHandler);
        }
      } else {
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        window.removeEventListenerOld(eventName, handler);
      }
    };
  }

  try {
    optimizeResize();
  } catch (error) {
    // const e = error as Error | undefined;
  } finally {
    // noop
  }
  // optimizeResize end ----------------------------------------------
})();
