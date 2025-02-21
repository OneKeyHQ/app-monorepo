/* eslint-disable import/order */
// import { clearIntervalAsync, setIntervalAsync } from 'set-interval-async';

// walletconnect react-native-compat polyfill
import './reactCreateElementShim';
import './walletConnectCompact';
import './polyfillsPlatform';

import '../modules3rdParty/cross-crypto/verify';

import '../request';

// import { normalizeRequestLibs } from '../request/normalize';
import timerUtils from '../utils/timerUtils';
// @ts-ignore
// globalThis.setInterval = setIntervalAsync;
// // @ts-ignore
// globalThis.clearInterval = clearIntervalAsync;
// import { interceptConsoleErrorWithExtraInfo } from '../errors/utils/errorUtils';

// normalizeRequestLibs();
timerUtils.interceptTimerWithDisable();
// interceptConsoleErrorWithExtraInfo();
