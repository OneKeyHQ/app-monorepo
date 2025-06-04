import openUrlUtils from '../../utils/openUrlUtils';

import { getOneKeyIdUserEmail } from './utils';

interface IIntercomSettings {
  app_id?: string;
  user_id?: string;
  email?: string;
  name?: string;
}

export const initIntercom = async (settings?: IIntercomSettings) => {
  console.log('initIntercom on native platform with settings:', settings);
  // Native platform doesn't need initialization for URL-based support
};

export const showIntercom = async () => {
  let supportUrl = 'https://intercom-test-beryl.vercel.app/';

  const userEmail = await getOneKeyIdUserEmail();

  if (userEmail) {
    supportUrl += `?email=${userEmail}`;
  }

  openUrlUtils.openUrlInApp(supportUrl, 'Support');
};
