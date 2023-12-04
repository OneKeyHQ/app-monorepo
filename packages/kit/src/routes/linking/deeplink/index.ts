import { isString } from 'lodash';

import type { IDesktopOpenUrlEventData } from '@onekeyhq/desktop/src-electron/app';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { registerHandler } from './handler.desktop';

type IDeepLinkUrlParsedResult = undefined;
export const WalletConnectUniversalLinkPath = 'wc/connect/wc';
export const WalletConnectUniversalLinkPathSchema = `/wc/connect/wc`;
const processDeepLinkUrl = memoizee(
  // parameter should be flatten, as memoizee primitive=true
  (url: string | undefined): IDeepLinkUrlParsedResult => {
    // handle deepLink URL
    console.log(url);
  },
  {
    primitive: true,
    max: 20,
    maxAge: 600,
  },
);

export const handleDeepLinkUrl = (data: IDesktopOpenUrlEventData) => {
  const urls = [data.url, ...(data.argv ?? [])].filter(
    (item) => !!item && isString(item),
  );
  urls.forEach((url) => processDeepLinkUrl(url));
};

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  global.$$handleDeepLinkUrl = handleDeepLinkUrl;
}

export const registerDeepLinking = () => registerHandler(handleDeepLinkUrl);
