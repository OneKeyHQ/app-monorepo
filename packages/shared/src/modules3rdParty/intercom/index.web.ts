import Intercom, { show } from '@intercom/messenger-js-sdk';

interface IIntercomSettings {
  app_id: string;
  user_id?: string;
  email?: string;
  name?: string;
}

export const initIntercom = (settings?: IIntercomSettings) => {
  const APP_ID = settings?.app_id || process.env.INTERCOM_APP_ID || 'vbbj4ssb';

  Intercom({
    app_id: APP_ID,
    hide_default_launcher: true,
    ...settings,
  });
};

export const showIntercom = () => {
  show();
};
