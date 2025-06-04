import Intercom, { show, update } from '@intercom/messenger-js-sdk';

import { getOneKeyIdUserEmail } from './utils';

interface IIntercomSettings {
  app_id: string;
  user_id?: string;
  email?: string;
  name?: string;
}

export const initIntercom = async (settings?: IIntercomSettings) => {
  const APP_ID = settings?.app_id || process.env.INTERCOM_APP_ID || 'vbbj4ssb';

  // Check if user is logged in to OneKey ID and get email
  let userEmail = settings?.email;

  if (!userEmail) {
    userEmail = await getOneKeyIdUserEmail();
  }

  Intercom({
    app_id: APP_ID,
    hide_default_launcher: true,
    ...settings,
    ...(userEmail && { email: userEmail }),
  });
};

export const showIntercom = async () => {
  // Update user info before showing Intercom
  const userEmail = await getOneKeyIdUserEmail();

  if (userEmail) {
    // Update user info in Intercom
    update({
      email: userEmail,
    });
  }

  show();
};
