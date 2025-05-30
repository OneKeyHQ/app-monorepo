interface IIntercomSettings {
  app_id: string;
  user_id?: string;
  email?: string;
  name?: string;
  [key: string]: any;
}

export const initIntercom = (settings?: IIntercomSettings) => {
  const APP_ID = settings?.app_id || process.env.INTERCOM_APP_ID || 'vbbj4ssb';

  import('@intercom/messenger-js-sdk')
    .then(({ default: Intercom }) => {
      Intercom({
        app_id: APP_ID,
        ...settings,
      });
      console.log('Intercom initialized successfully');
    })
    .catch((error) => {
      console.error('Failed to initialize Intercom:', error);
    });
};
