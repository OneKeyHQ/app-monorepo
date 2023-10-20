
import { openURL as LinkingOpenURL } from 'expo-linking';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

function getOriginFromUrl({ url }: { url: string }): string {
  try {
    const urlInfo = new URL(url);
    const { origin } = urlInfo;
    return origin || '';
  } catch (error) {
    console.error(error);
  }
  return '';
}

export function checkOneKeyCardGoogleOauthUrl({
  url,
}: {
  url: string;
}): boolean {
  const origin = getOriginFromUrl({ url });
  return [
    'https://card.onekey.so',
    'https://card.onekeytest.com',
    'https://precard-762def0c-eacd-49b3-ad89-0bf807b37f57.onekeycn.com',
    'https://accounts.google.com',
  ].includes(origin);
}

export const openUrlExternal = (url: string) => {
  if (platformEnv.isNative) {
    // open by OS default browser
    LinkingOpenURL(url);
  } else {
    window.open(url, '_blank');
  }
};
