import { getIntercomSupportUrl } from './utils';

export const initIntercom = async () => {
  console.log('initIntercom');
};

export const showIntercom = async (params?: { requestId?: string }) => {
  const url = await getIntercomSupportUrl(params);
  window.open(url);
};

// Empty update function for extension compatibility
// Extension doesn't use the Intercom SDK, so this is a no-op
export const update = () => {
  // No-op for extension
};
