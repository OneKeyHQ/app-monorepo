/* eslint-disable react/no-unstable-nested-components */
import type { FC } from 'react';
import { useEffect, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Platform, Share } from 'react-native';
import { URL } from 'react-native-url-polyfill';

import { Box, Icon, Select, ToastManager } from '@onekeyhq/components';
import NavHeader from '@onekeyhq/components/src/NavHeader/NavHeader';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import type { ModalRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalRoutesParams } from '@onekeyhq/kit/src/routes/types';

import WebView from '../../components/WebView';
import { openUrlExternal } from '../../utils/openUrl';

import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<ModalRoutesParams, ModalRoutes.Webview>;

export const SettingsWebViews: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const { url, title, modalMode } = route.params;
  const [currentUrl, setCurrentUrl] = useState(url);
  const containerRef = useRef<typeof Box>(null);

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      header: () => (
        <Box
          ref={containerRef}
          bg="background-default"
          justifyContent="center"
          borderBottomWidth="2px"
          borderBottomColor="divider"
        >
          <NavHeader
            alwaysShowBackButton
            safeTop={modalMode ? 0 : undefined}
            headerRight={() => (
              <Select
                autoAdjustPosition={false}
                dropdownPosition="right"
                title={intl.formatMessage({ id: 'select__options' })}
                outerContainerRef={containerRef}
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
                    value: () => {
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
                    },
                    iconProps: { name: 'ArrowPathOutline' },
                  },
                  {
                    label: intl.formatMessage({
                      id: 'action__share',
                    }),
                    value: () => {
                      Share.share(
                        Platform.OS === 'ios'
                          ? {
                              url,
                            }
                          : {
                              message: url,
                            },
                      ).catch(() => {});
                    },
                    iconProps: { name: 'ShareOutline' },
                  },
                  {
                    label: intl.formatMessage({
                      id: 'action__copy_url',
                    }),
                    value: () => {
                      copyToClipboard(currentUrl ?? '');
                      ToastManager.show({
                        title: intl.formatMessage({ id: 'msg__copied' }),
                      });
                    },
                    iconProps: { name: 'LinkOutline' },
                  },
                  {
                    label: intl.formatMessage({
                      id: 'action__open_in_browser',
                    }),
                    value: () => {
                      openUrlExternal(currentUrl);
                    },
                    iconProps: { name: 'GlobeAltOutline' },
                  },
                ]}
                renderTrigger={() => (
                  <Box
                    mr={Platform.OS !== 'android' ? 4 : 0}
                    alignItems="flex-end"
                  >
                    <Icon name="DotsHorizontalOutline" />
                  </Box>
                )}
              />
            )}
            title={title}
          />
        </Box>
      ),
    });
  }, [currentUrl, intl, modalMode, navigation, title, url]);

  return <WebView src={currentUrl} />;
};

export default SettingsWebViews;
