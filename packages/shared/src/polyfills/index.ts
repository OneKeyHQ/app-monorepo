import './polyfillsPlatform';

const { normalizeRequestLibs } = require('../request/normalize');
const timerUtils = require('../utils/timerUtils').default;

normalizeRequestLibs();
timerUtils.interceptTimerWithDisable();
