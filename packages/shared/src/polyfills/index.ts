/* eslint-disable import/order */
import './polyfillsPlatform';

// import '../modules3rdParty/cross-crypto/verify';

// import { normalizeRequestLibs } from '../request/normalize';
import timerUtils from '../utils/timerUtils';
// import { interceptConsoleErrorWithExtraInfo } from '../errors/utils/errorUtils';

// normalizeRequestLibs();
timerUtils.interceptTimerWithDisable();
// interceptConsoleErrorWithExtraInfo();
