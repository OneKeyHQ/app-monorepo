import Intercom, { show, update } from '@intercom/messenger-js-sdk';

import { getCustomerJWT } from './utils';

import type { InitType } from '@intercom/messenger-js-sdk/dist/types';

export const initIntercom = async (settings?: InitType) => {
  const APP_ID = settings?.app_id || process.env.INTERCOM_APP_ID || 'vbbj4ssb';

  Intercom({
    app_id: APP_ID,
    hide_default_launcher: true,
    ...settings,
  });
};

export const showIntercom = async () => {
  const customerJWT = await getCustomerJWT();

  if (customerJWT) {
    update({
      intercom_user_jwt: customerJWT,
    });
  }

  show();
};
