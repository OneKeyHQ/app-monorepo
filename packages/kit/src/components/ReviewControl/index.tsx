import type { PropsWithChildren } from 'react';

import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  getDevSettingsIgnoreReviewControl,
  useDevSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const useReviewControl = () => {
  const [{ reviewControl }] = useSettingsPersistAtom();
  const [devSettings] = useDevSettingsPersistAtom();
  // Dev override: keep the gated entries rendered regardless of the remote
  // flag so they stay testable on builds where it is off.
  if (getDevSettingsIgnoreReviewControl(devSettings)) {
    return true;
  }
  if (platformEnv.isAppleStoreEnv || platformEnv.isMas) {
    return Boolean(reviewControl);
  }
  return true;
};

export const ReviewControl = ({ children }: PropsWithChildren) => {
  const show = useReviewControl();
  return show ? children : null;
};
