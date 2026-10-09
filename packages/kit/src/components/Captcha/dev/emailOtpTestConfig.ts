import { ONEKEY_ID_AUTH_CONFIG } from '@onekeyhq/shared/src/consts/authConsts';

export const EMAIL_OTP_CAPTCHA_PAGE_URLS = {
  test: ONEKEY_ID_AUTH_CONFIG.test.captcha.pageUrl,
  production: ONEKEY_ID_AUTH_CONFIG.prod.captcha.pageUrl,
};

export const EMAIL_OTP_TEST_PROJECTS = [
  {
    id: 'test',
    label: 'Test1',
    projectUrl: 'https://oblqilruyecfnplpkwlp.supabase.co',
    publicKey: 'sb_publishable_7xO3fWGllmaJf74c9DW2oA_sy2rDJfv',
  },
  {
    id: 'test-2',
    label: 'Test2',
    projectUrl: ONEKEY_ID_AUTH_CONFIG.test.projectUrl,
    publicKey: ONEKEY_ID_AUTH_CONFIG.test.publicKey,
  },
  {
    id: 'test-3',
    label: 'Test3',
    projectUrl: 'https://zvxscjkvkjepbrjncvzt.supabase.co',
    publicKey: 'sb_publishable_ryfw0-h47JC2lHFRB2yrjw_iS_1KPgW',
  },
] as const;

export const EMAIL_OTP_TEST_CONFIG: {
  projectUrl: string;
  publicKey: string;
  pageUrl: string;
} = {
  projectUrl: ONEKEY_ID_AUTH_CONFIG.test.projectUrl,
  publicKey: ONEKEY_ID_AUTH_CONFIG.test.publicKey,
  pageUrl: EMAIL_OTP_CAPTCHA_PAGE_URLS.test,
};
