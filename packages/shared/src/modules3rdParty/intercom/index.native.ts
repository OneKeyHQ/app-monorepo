import openUrlUtils from '../../utils/openUrlUtils';

interface IIntercomSettings {
  app_id?: string;
  user_id?: string;
  email?: string;
  name?: string;
}

export const initIntercom = (settings?: IIntercomSettings) => {
  console.log('initIntercom on native platform with settings:', settings);
  // Native platform doesn't need initialization for URL-based support
};

export const showIntercom = () => {
  const supportUrl = 'https://intercom-test-beryl.vercel.app/';

  openUrlUtils.openUrlInApp(supportUrl, 'Support');
};
