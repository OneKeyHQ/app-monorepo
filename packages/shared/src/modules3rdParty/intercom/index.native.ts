import openUrlUtils from '../../utils/openUrlUtils';

import { getCustomerJWT } from './utils';

export const initIntercom = async () => {
  console.log('initIntercom');
};

export const showIntercom = async () => {
  const token = await getCustomerJWT();
  const supportUrl = 'https://intercom.onekey.so/';

  const url = token
    ? `${supportUrl}?intercom_user_jwt=${encodeURIComponent(token)}`
    : supportUrl;

  openUrlUtils.openUrlInApp(url, 'Support');
};
