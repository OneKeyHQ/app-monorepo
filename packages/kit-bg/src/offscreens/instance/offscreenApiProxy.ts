/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, max-classes-per-file */

import { OffscreenApiProxyBase } from '../OffscreenApiProxyBase';

import type { IOffscreenApi } from './IOffscreenApi';
import type OffscreenApiAdaSdk from '../OffscreenApiAdaSdk';
import type OffscreenApiXmrSdk from '../OffscreenApiXmrSdk';
import type { LowLevelCoreApi } from '@onekeyfe/hd-core';

class OffscreenApiProxy extends OffscreenApiProxyBase implements IOffscreenApi {
  hardwareSDKLowLevel: LowLevelCoreApi = this._createProxyModule(
    'hardwareSDKLowLevel',
    {
      on(...args: any[]) {
        console.error('hardwareSDK.on() is NOT allowed to proxy', ...args);
      },
    },
    {
      // make this module can be used as async way
      //    Error: offscreen module method not found: hardwareSDK.then()
      asyncThenSupport: true,
    },
  );

  adaSdk: OffscreenApiAdaSdk = this._createProxyModule('adaSdk');

  xmrSdk: OffscreenApiXmrSdk = this._createProxyModule('xmrSdk');
}

export default new OffscreenApiProxy();
