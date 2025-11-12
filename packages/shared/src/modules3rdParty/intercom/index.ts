import Intercom, {
  onShow,
  show,
  trackEvent,
  update,
} from '@intercom/messenger-js-sdk';

import platformEnv from '../../platformEnv';

import { getCustomerJWT, getInstanceId } from './utils';

import type { InitType } from '@intercom/messenger-js-sdk/dist/types';

export const initIntercom = async (settings?: Partial<InitType>) => {
  const APP_ID = settings?.app_id || process.env.INTERCOM_APP_ID || 'vbbj4ssb';

  Intercom({
    app_id: APP_ID,
    hide_default_launcher: !platformEnv.isWebDappMode,
    alignment: 'right',
    horizontal_padding: 10,
    vertical_padding: 55,
    ...settings,
  });

  onShow(async () => {
    const instanceIdValue = await getInstanceId();

    trackEvent('client info', {
      instanceId: instanceIdValue,
    });

    const customerJWT = await getCustomerJWT();

    if (customerJWT) {
      update({
        intercom_user_jwt: customerJWT,
      });
    }
  });
};

export const showIntercom = async (params?: { requestId?: string }) => {
  const instanceIdValue = await getInstanceId();

  trackEvent('client info', {
    instanceId: instanceIdValue,
    requestId: params?.requestId,
  });

  show();
};

// Export update for dynamic launcher visibility control
export { update };
