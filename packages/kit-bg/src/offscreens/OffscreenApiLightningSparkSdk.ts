import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { INTERNAL_METHOD_PREFIX } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { loadBreezSdk } from '../services/ServiceLightningSpark/sdk/breezSdkWeb';
import { SparkSdkOffscreenHost } from '../services/ServiceLightningSpark/sdk/sparkOffscreenHost';

import type { IBackgroundApiInternalCallMessage } from '../apis/IBackgroundApi';

// Passes an SDK event on to ServiceLightningSpark in the service worker.
function emitSdkEventToBackground(payload: {
  sessionId: string;
  event: unknown;
}) {
  const bridge = appGlobals.extJsBridgeOffscreenToBg;
  if (!bridge) {
    console.error('[lightningSparkSdk] background bridge is unavailable');
    return;
  }
  const message: IBackgroundApiInternalCallMessage = {
    service: 'serviceLightningSpark',
    method: `${INTERNAL_METHOD_PREFIX}receiveOffscreenSdkEvent`,
    params: [payload],
  };
  void Promise.resolve(bridge.request({ data: message })).catch(
    (error: unknown) => {
      console.error('[lightningSparkSdk] failed to pass an event on', error);
    },
  );
}

// The extension's Breez SDK runs in this document; see sparkOffscreenHost.ts.
export default class OffscreenApiLightningSparkSdk extends SparkSdkOffscreenHost {
  constructor() {
    super({
      loadSdk: loadBreezSdk,
      emitEvent: emitSdkEventToBackground,
      createSessionId: () => generateUUID(),
    });
  }
}
