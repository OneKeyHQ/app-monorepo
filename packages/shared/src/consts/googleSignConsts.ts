import { GOOGLE_OAUTH_CLIENT_IDS } from './authConsts';

export const GoogleSignInConfigure = {
  scopes: [
    'openid',
    'profile',
    'email',
    'https://www.googleapis.com/auth/drive.file',
  ],
  offlineAccess: false,
  webClientId: GOOGLE_OAUTH_CLIENT_IDS.ANDROID,

  // webClientId: platformEnv.isDev
  //   ? // DEVELOPER_ERROR: On local development this can happen due to incorrect app signing. Please test with a production-signed build.

  // oxlint-disable-next-line @cspell/spellchecker
  //     '117481276073-fs7omuqsmvgtg6bci3ja1gvo03g0d984.apps.googleusercontent.com' // Dev

  // oxlint-disable-next-line @cspell/spellchecker
  //   : '94391474021-ffaspa4ikjqpqvn5ndplqobvuvhnj8v3.apps.googleusercontent.com', // Pro
  // offlineAccess: true,
};

export const GoogleSignInConfigureIOS = {
  scopes: ['openid', 'profile', 'email'],
  offlineAccess: false,
  iosClientId: GOOGLE_OAUTH_CLIENT_IDS.IOS,
};
