// eslint-disable-next-line import/order
import './polyfillsPlatform';

import { normalizeRequestLibs } from '../request/normalize';
import timerUtils from '../utils/timerUtils';

normalizeRequestLibs();
timerUtils.interceptTimerWithDisable();
