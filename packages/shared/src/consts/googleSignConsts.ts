import platformEnv from '../platformEnv';

export const GoogleSignInConfigure = {
  scopes: ['https://www.googleapis.com/auth/drive.file'],
  webClientId: platformEnv.isDev
    ? // DEVELOPER_ERROR: On local development this can happen due to incorrect app signing. Please test with a production-signed build.
      '117481276073-fs7omuqsmvgtg6bci3ja1gvo03g0d984.apps.googleusercontent.com' // Dev
    : '94391474021-ffaspa4ikjqpqvn5ndplqobvuvhnj8v3.apps.googleusercontent.com', // Pro
  offlineAccess: true,
};
