import openUrlUtils from '../../utils/openUrlUtils';

import { getOneKeyIdUserEmail } from './utils';

export const initIntercom = async () => {};

export const showIntercom = async () => {
  let supportUrl = 'https://intercom-test-beryl.vercel.app/';

  const userEmail = await getOneKeyIdUserEmail();

  if (userEmail) {
    supportUrl += `?email=${userEmail}`;
  }

  openUrlUtils.openUrlInApp(supportUrl, 'Support');
};
