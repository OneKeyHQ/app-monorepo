/* eslint-disable import/order */
import { setIntervalAsync, clearIntervalAsync } from 'set-interval-async';
// @ts-ignore
globalThis.setInterval = setIntervalAsync;
// @ts-ignore
globalThis.clearInterval = clearIntervalAsync;

// walletconnect react-native-compat polyfill
import './reactCreateElementShim';
import './walletConnectCompact';
import './polyfillsPlatform';

import '../modules3rdParty/cross-crypto/verify';

import '../request';

// import { normalizeRequestLibs } from '../request/normalize';
import timerUtils from '../utils/timerUtils';
// import { interceptConsoleErrorWithExtraInfo } from '../errors/utils/errorUtils';

// normalizeRequestLibs();
timerUtils.interceptTimerWithDisable();
// interceptConsoleErrorWithExtraInfo();
