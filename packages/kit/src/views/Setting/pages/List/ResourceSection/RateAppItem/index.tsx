import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  APP_STORE_LINK,
  EXT_RATE_URL,
  PLAY_STORE_LINK,
} from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

const show =
  platformEnv.isExtension ||
  platformEnv.isNativeAndroidGooglePlay ||
  platformEnv.isNativeIOS;

export const RateAppItem = () => {
  const intl = useIntl();
  const onPress = useCallback(() => {
    if (platformEnv.isExtension) {
      let url = EXT_RATE_URL.chrome;
      if (platformEnv.isExtFirefox) url = EXT_RATE_URL.firefox;
      window.open(url, intl.formatMessage({ id: 'form__rate_our_app' }));
    } else if (platformEnv.isNativeAndroidGooglePlay) {
      openUrlExternal(PLAY_STORE_LINK);
    } else if (platformEnv.isNativeIOS) {
      openUrlExternal(APP_STORE_LINK);
    }
  }, [intl]);
  return show ? (
    <ListItem
      onPress={onPress}
      icon="StarOutline"
      title={intl.formatMessage({ id: 'form__rate_our_app' })}
      drillIn
    />
  ) : null;
};
