import type { FC } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Pressable, Text } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { openAppStoryWriteReview } from '../../../utils/openAppReview';

const ExtRateUrl = {
  'chrome':
    'https://chrome.google.com/webstore/detail/onekey/jnmbobjmhlngoefaiojfljckilhhlhcj',
  'firefox': 'https://addons.mozilla.org/zh-CN/firefox/addon/onekey/reviews/',
  'edge':
    'https://microsoftedge.microsoft.com/addons/detail/onekey/obffkkagpmohennipjokmpllocnlndac',
};

const AppRateSectionItem: FC = () => {
  const intl = useIntl();
  const showRate =
    platformEnv.isExtension ||
    platformEnv.isNativeAndroidGooglePlay ||
    platformEnv.isNativeIOS;
  const onPress = useCallback(() => {
    if (platformEnv.isExtension) {
      let url = ExtRateUrl.edge;
      if (platformEnv.isExtChrome) url = ExtRateUrl.chrome;
      if (platformEnv.isExtFirefox) url = ExtRateUrl.firefox;
      window.open(url, intl.formatMessage({ id: 'form__rate_our_app' }));
    }
    if (platformEnv.isNative) {
      openAppStoryWriteReview();
    }
  }, [intl]);
  if (showRate) {
    return (
      <Pressable
        display="flex"
        flexDirection="row"
        alignItems="center"
        py={4}
        px={{ base: 4, md: 6 }}
        borderBottomWidth="1"
        borderBottomColor="divider"
        onPress={onPress}
      >
        <Icon name="StarOutline" />
        <Text
          typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
          flex={1}
          mx={3}
        >
          {intl.formatMessage({
            id: 'form__rate_our_app',
          })}
        </Text>
        <Box>
          <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
        </Box>
      </Pressable>
    );
  }
  return null;
};

export default AppRateSectionItem;
