import openUrlUtils from '../../utils/openUrlUtils';

import { buildSupportUrl } from './utils';

export const initIntercom = async () => {};

export const showIntercom = async () => {
  const supportUrl = await buildSupportUrl();

  openUrlUtils.openUrlInApp(supportUrl, 'Support');
};
