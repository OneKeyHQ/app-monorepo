import React, { FC, useEffect, useLayoutEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Platform, Share } from 'react-native';
import { URL } from 'react-native-url-polyfill';

import { Box, Icon, IconButton, Select, useToast } from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { HomeRoutes, HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';

import WebView from '../../components/WebView';
import { openUrlExternal } from '../../utils/openUrl';

type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.SettingsWebviewScreen>;

export const SettingsWebViews: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const { url, title } = route?.params;
  const [currentUrl, setCurrentUrl] = useState(url);
  const [currentOptionType, setCurrentOptionType] = useState<string | null>(
    null,
  );

  const onShare = async () => {
    try {
      const result = await Share.share(
        Platform.OS === 'ios'
          ? {
              url,
            }
          : {
              message: url,
            },
      );
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // shared with activity type of result.activityType
        } else {
          // shared
        }
      } else if (result.action === Share.dismissedAction) {
        // dismissed
      }
    } catch (error) {
      console.warn(error);
    }
  };

  const onRefresh = () => {
    try {
      const polyfillUrl = new URL(url);
      polyfillUrl.searchParams.set(
        'onekey-browser-refresh',
        Math.random().toString(),
      );

      setCurrentUrl(polyfillUrl.toString());
    } catch (error) {
      console.warn(error);
    }
  };

  useEffect(() => {
    function main() {
      switch (currentOptionType) {
        case 'refresh':
          onRefresh();
          break;
        case 'share':
          onShare();
          break;
        case 'copyUrl':
          copyToClipboard(currentUrl ?? '');
          toast.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
          break;
        case 'openInBrowser':
          openUrlExternal(currentUrl);
          break;
        default:
          break;
      }
      setCurrentOptionType(null);
    }

    setTimeout(main, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOptionType]);

  useLayoutEffect(() => {
    if (title) {
      navigation.setOptions({ title });
    }
    navigation.setOptions({
      headerRight: () => (
        <Select
          dropdownPosition="right"
          title={intl.formatMessage({ id: 'select__options' })}
          onChange={(v) => {
            if (currentOptionType !== v) setCurrentOptionType(v);
          }}
          footer={null}
          activatable={false}
          triggerProps={{
            width: '40px',
          }}
          dropdownProps={{
            width: 248,
          }}
          options={[
            {
              label: intl.formatMessage({
                id: 'action__refresh',
              }),
              value: 'refresh',
              iconProps: { name: 'ArrowPathOutline' },
            },
            {
              label: intl.formatMessage({
                id: 'action__share',
              }),
              value: 'share',
              iconProps: { name: 'ShareOutline' },
            },
            {
              label: intl.formatMessage({
                id: 'action__copy_url',
              }),
              value: 'copyUrl',
              iconProps: { name: 'LinkOutline' },
            },
            {
              label: intl.formatMessage({
                id: 'action__open_in_browser',
              }),
              value: 'openInBrowser',
              iconProps: { name: 'GlobeAltOutline' },
            },
          ]}
          renderTrigger={() => (
            <Box mr={Platform.OS !== 'android' ? 4 : 0} alignItems="flex-end">
              <Icon name="DotsHorizontalOutline" />
            </Box>
          )}
        />
      ),

      headerLeft: () => (
        <IconButton
          type="plain"
          name="ArrowSmLeftOutline"
          size="lg"
          circle
          onPress={() => navigation.goBack?.()}
        />
      ),
    });
  }, [currentOptionType, intl, navigation, title]);

  return (
    <Box flex="1">
      <WebView src={currentUrl} />
    </Box>
  );
};

export default SettingsWebViews;
