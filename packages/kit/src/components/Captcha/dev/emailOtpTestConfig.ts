import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const EMAIL_OTP_CAPTCHA_PAGE_URLS = {
  local: 'http://localhost:8800/captcha',
  test: 'https://login.onekeytest.com/captcha',
  production: 'https://login.onekey.so/captcha',
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
    projectUrl: 'https://zvxscjkvkjepbrjncvzt.supabase.co',
    publicKey: 'sb_publishable_ryfw0-h47JC2lHFRB2yrjw_iS_1KPgW',
  },
] as const;

export const EMAIL_OTP_TEST_CONFIG: {
  projectUrl: string;
  publicKey: string;
  pageUrl: string;
} = {
  projectUrl: EMAIL_OTP_TEST_PROJECTS[0].projectUrl,
  publicKey: EMAIL_OTP_TEST_PROJECTS[0].publicKey,
  pageUrl: platformEnv.isWeb
    ? EMAIL_OTP_CAPTCHA_PAGE_URLS.local
    : 'http://127.0.0.1:8799/captcha.html',
};
