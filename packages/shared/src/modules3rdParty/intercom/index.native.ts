import openUrlUtils from '../../utils/openUrlUtils';

import { getIntercomSupportUrl } from './utils';

export const initIntercom = async () => {
  console.log('initIntercom');
};

export const showIntercom = async (params?: { requestId?: string }) => {
  const url = await getIntercomSupportUrl(params);
  openUrlUtils.openUrlInApp(url, 'Support');
};

// Empty update function for native compatibility
// Native doesn't use the Intercom SDK, so this is a no-op
export const update = () => {
  // No-op for native
};
