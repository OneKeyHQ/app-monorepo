import { normalizeRequestLibs } from './request/normalize';
import timerUtils from './utils/timerUtils';

// TODO merge packages/app/shim.js
normalizeRequestLibs();
timerUtils.interceptTimerWithDisable();
