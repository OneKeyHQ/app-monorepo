import type { PropsWithChildren } from 'react';

import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const useReviewControl = () => {
  const [{ reviewControl }] = useSettingsPersistAtom();
  if (platformEnv.isAppleStoreEnv || platformEnv.isMas) {
    return Boolean(reviewControl);
  }
  return true;
};

export const ReviewControl = ({ children }: PropsWithChildren) => {
  const show = useReviewControl();
  return show ? children : null;
};
