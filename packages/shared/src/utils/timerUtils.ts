function interceptTimeout(
  method: 'setTimeout' | 'setInterval',
  checkProp: '$$onekeyDisabledSetTimeout' | '$$onekeyDisabledSetInterval',
) {
  const methodOld = global[method];

  // @ts-ignore
  global[method] = function (
    fn: (...args: any[]) => any,
    timeout: number | undefined,
  ) {
    return methodOld(() => {
      if (global[checkProp]) {
        console.error(`${method} is disabled`);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return fn();
    }, timeout);
  };
}

function interceptTimerWithDisable() {
  interceptTimeout('setTimeout', '$$onekeyDisabledSetTimeout');
  interceptTimeout('setInterval', '$$onekeyDisabledSetInterval');
}

function enableSetTimeout() {
  global.$$onekeyDisabledSetTimeout = undefined;
}

function disableSetTimeout() {
  global.$$onekeyDisabledSetTimeout = true;
}

function enableSetInterval() {
  global.$$onekeyDisabledSetInterval = undefined;
}

function disableSetInterval() {
  global.$$onekeyDisabledSetInterval = true;
}

export default {
  interceptTimerWithDisable,
  enableSetTimeout,
  disableSetTimeout,
  enableSetInterval,
  disableSetInterval,
};
