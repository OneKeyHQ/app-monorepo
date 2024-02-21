import { Mixpanel } from 'mixpanel-react-native';

import { token } from './token';

let mixpanel: Mixpanel | undefined;
export const getMixpanel = async () => {
  if (!mixpanel) {
    mixpanel = new Mixpanel(token, false);
    await mixpanel.init();
  }
  return mixpanel;
};
