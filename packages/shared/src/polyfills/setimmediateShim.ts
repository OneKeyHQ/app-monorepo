/* eslint-disable unicorn/prefer-global-this */
import 'setimmediate';

/*
requestAnimationFrame is missing in mv3 background:
  ReferenceError: requestAnimationFrame is not defined
 */
if (typeof global.requestAnimationFrame === 'undefined') {
  global.requestAnimationFrame = setImmediate;
}
