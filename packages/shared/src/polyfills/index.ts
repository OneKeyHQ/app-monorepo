/* eslint-disable import/order */
import './polyfillsPlatform';

// eslint-disable-next-line import/order
import '../modules3rdParty/cross-crypto/verify';

import { normalizeRequestLibs } from '../request/normalize';
import timerUtils from '../utils/timerUtils';

normalizeRequestLibs();
timerUtils.interceptTimerWithDisable();
