import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { unlockWhiteListUrls } from '../routes/linking.path';

import { useAppSelector } from './useAppSelector';

function isUnlockWhiteListUrl() {
  // only available for web
  // TODO only for dapp mode web, but not wallet mode web
  if (!platformEnv.isWeb) {
    return false;
  }
  return Boolean(
    unlockWhiteListUrls.find((item) =>
      window.location?.pathname?.startsWith(item),
    ),
  );
}

export const useAppLock = () => {
  const isPasswordSet = useAppSelector((s) => s.data.isPasswordSet);
  const isStatusUnlock = useAppSelector((s) => s.status.isUnlock);
  const isDataUnlock = useAppSelector((s) => s.data.isUnlock);
  return {
    isPasswordSet,
    isUnlock: isDataUnlock && isStatusUnlock,
    showUnlockView:
      isPasswordSet &&
      !(isDataUnlock && isStatusUnlock) &&
      !isUnlockWhiteListUrl(),
  };
};
