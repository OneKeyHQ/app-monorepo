import platformEnv from '../../platformEnv';

import { token } from './token';

let mixpanel: typeof import('mixpanel-browser') | undefined;
export const getMixpanel = async () => {
  if (!mixpanel) {
    mixpanel = require('mixpanel-browser');
    // eslint-disable-next-line @typescript-eslint/await-thenable
    await mixpanel.init(token, {
      ignore_dnt: true,
      debug: platformEnv.isDev,
      track_pageview: false,
      persistence: 'localStorage',
    });
  }
  return mixpanel;
};
