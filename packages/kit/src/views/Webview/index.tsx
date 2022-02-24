import React, { FC, useEffect, useLayoutEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Platform, Share } from 'react-native';

import { Box, Icon, Select } from '@onekeyhq/components';
import useOpenBrowser from '@onekeyhq/kit/src/hooks/useOpenBrowser';
import { useToast } from '@onekeyhq/kit/src/hooks/useToast';
import { HomeRoutes, HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';
import { copyToClipboard } from '@onekeyhq/kit/src/utils/ClipboardUtils';

import WebView from '../../components/WebView';

type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.SettingsWebviewScreen>;

function addParamToUrl(originUrl: string, key: string, val: string) {
  let url = originUrl;
  if (url.indexOf(key) > -1) {
    const re = RegExp(`/(${key}=)([^&]*)/gi`);
    url = url.replace(re, `${key}=${val}`);
  } else {
    const paraStr = `${key}=${val}`;
    const idx = url.indexOf('?');
    if (idx < 0) {
      url += '?';
    } else if (idx >= 0 && idx !== url.length - 1) {
      url += '&';
    }
    url += paraStr;
  }
  return url;
}

export const SettingsWebViews: FC = () => {
  const intl = useIntl();
  const openBrowser = useOpenBrowser();
  const toast = useToast();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const { url, title } = route?.params;
  const [currentUrl, setCurrentUrl] = useState(url);
  const [currentOptionType, setCurrentOptionType] = useState<string | null>(
    null,
  );

  const onShare = () => {
    try {
      Share.share(
        Platform.OS === 'ios'
          ? {
              url,
            }
          : {
              message: url,
            },
      )
        .then((result) => {
          console.log(result);
        })
        .catch((error) => {
          console.error(error);
        });
    } catch (error) {
      console.warn(error);
    }
  };

  useEffect(() => {
    switch (currentOptionType) {
      case 'refresh':
        setCurrentUrl(
          addParamToUrl(
            url,
            'onekey-browser-refresh',
            Math.random().toString(),
          ),
        );
        setCurrentOptionType(null);
        break;
      case 'share':
        onShare();
        setCurrentOptionType(null);
        break;
      case 'copyUrl':
        copyToClipboard(currentUrl ?? '');
        toast.info(intl.formatMessage({ id: 'msg__copied' }));
        setCurrentOptionType(null);
        break;
      case 'openInBrowser':
        openBrowser.openUrlExternal(currentUrl);
        setCurrentOptionType(null);
        break;
      default:
        break;
    }
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
              iconProps: { name: 'RefreshOutline' },
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
    });
  }, [currentOptionType, intl, navigation, title]);

  return (
    <Box flex="1">
      <WebView
        src={currentUrl}
        onSrcChange={(res) => {
          console.log('onSrcChange', res);
        }}
      />
    </Box>
  );
};

export default SettingsWebViews;
