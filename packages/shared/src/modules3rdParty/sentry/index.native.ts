import {
  wrap as NativeWrap,
  init,
  nativeCrash as sentryNativeCrash,
} from '@sentry/react-native';

export * from '@sentry/react-native';

export const initSentry = () => {
  init({
    dsn: 'https://efa7cea7131f10dc294bd2c64bd636bf@o4508208799809536.ingest.de.sentry.io/4508208802627664',
  });
};

export const wrap = NativeWrap;
export const nativeCrash = sentryNativeCrash;
