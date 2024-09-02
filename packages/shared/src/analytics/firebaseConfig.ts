import config from './firebase.web.json';

type IConfig =
  | typeof config
  | {
      measurementId: string;
      apiSecret: string;
    };
export const firebaseConfig = config as IConfig;
