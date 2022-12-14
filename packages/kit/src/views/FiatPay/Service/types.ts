import { MOONPAY_API_KEY } from '@onekeyhq/shared/src/config/appConfig';

import store from '../../../store';

type MoonpayModeType = 'live' | 'test';

type MoonpayMaptype = {
  modeCode: string;
  moonpayApiKey: string;
  sellWidgetHostUrl: string;
  buyWidgetHostUrl: string;
};
const MoonpayModeMap: Record<MoonpayModeType, MoonpayMaptype> = {
  'live': {
    modeCode: 'live',
    moonpayApiKey: MOONPAY_API_KEY,
    sellWidgetHostUrl: 'https://sell.moonpay.com',
    buyWidgetHostUrl: 'https://buy.moonpay.com',
  },
  'test': {
    modeCode: 'test',
    moonpayApiKey: 'pk_test_Zi6NCCoN2Bp1DaRUQ4P4pKi9b2VEkTp',
    sellWidgetHostUrl: 'https://sell-sandbox.moonpay.com',
    buyWidgetHostUrl: 'https://buy-sandbox.moonpay.com',
  },
};

export const MoonpayModeData = (): MoonpayMaptype => {
  const { enable } = store.getState().settings.devMode || {};
  const moonpayMode: MoonpayModeType = enable ? 'test' : 'live';
  return MoonpayModeMap[moonpayMode];
};
