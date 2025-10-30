import { getCustomerJWT } from './utils';

export const initIntercom = async () => {
  console.log('initIntercom');
};

export const showIntercom = async () => {
  const token = await getCustomerJWT();

  const baseUrl = 'https://onekey.so/?openMessenger';
  const url = token
    ? `${baseUrl}&intercom_user_jwt=${encodeURIComponent(token)}`
    : baseUrl;

  window.open(url);
};

// Empty update function for extension compatibility
// Extension doesn't use the Intercom SDK, so this is a no-op
export const update = () => {
  // No-op for extension
};
