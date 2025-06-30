import { getCustomerJWT } from './utils';

export const initIntercom = async () => {
  console.log('initIntercom');
};

export const showIntercom = async () => {
  const token = await getCustomerJWT();

  const baseUrl = 'https://onekey.so/?openMessenger';
  const url = token ? `${baseUrl}&intercom_user_jwt=${token}` : baseUrl;

  window.open(url);
};
