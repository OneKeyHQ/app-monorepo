/* eslint-disable import/order */
// walletconnect react-native-compat polyfill
import './walletConnectCompact';
import './polyfillsPlatform';

import '../modules3rdParty/cross-crypto/verify';

// import { normalizeRequestLibs } from '../request/normalize';
import timerUtils from '../utils/timerUtils';
// import { interceptConsoleErrorWithExtraInfo } from '../errors/utils/errorUtils';

// normalizeRequestLibs();
timerUtils.interceptTimerWithDisable();
// interceptConsoleErrorWithExtraInfo();
