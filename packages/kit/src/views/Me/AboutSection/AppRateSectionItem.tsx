import { FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Pressable, Text } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { openAppReview } from '../../../utils/openAppReview';

const ExtRateUrl = {
  'chrome':
    'https://chrome.google.com/webstore/detail/onekey/jnmbobjmhlngoefaiojfljckilhhlhcj',
  'firefox':
    'https://www.figma.com/exit?url=https%3A%2F%2Faddons.mozilla.org%2Fzh-CN%2Ffirefox%2Faddon%2Fonekey%2Freviews%2F',
  'edge':
    'https://microsoftedge.microsoft.com/addons/detail/onekey/obffkkagpmohennipjokmpllocnlndac',
};

const AppRateSectionItem: FC<{ onAfterOnpenReview: () => void }> = ({
  onAfterOnpenReview,
}) => {
  const intl = useIntl();
  const showRate = platformEnv.isExtension || platformEnv.isNative;
  const onPress = useCallback(() => {
    if (platformEnv.isExtension) {
      let url = ExtRateUrl.edge;
      if (platformEnv.isExtChrome) url = ExtRateUrl.chrome;
      if (platformEnv.isExtFirefox) url = ExtRateUrl.firefox;
      window.open(url, intl.formatMessage({ id: 'form__rate_our_app' }));
    }
    if (platformEnv.isNative) {
      openAppReview(true);
      onAfterOnpenReview();
    }
  }, [intl, onAfterOnpenReview]);
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
          <Icon name="ChevronRightSolid" size={20} />
        </Box>
      </Pressable>
    );
  }
  return null;
};

export default AppRateSectionItem;
