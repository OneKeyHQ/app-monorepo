import { FC, useLayoutEffect, useRef, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Platform, Share } from 'react-native';
import { URL } from 'react-native-url-polyfill';

import { Box, Icon, Select, ToastManager } from '@onekeyhq/components';
import NavHeader from '@onekeyhq/components/src/NavHeader/NavHeader';
import { SelectItem } from '@onekeyhq/components/src/Select';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { HomeRoutes, HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';

import WebView from '../../components/WebView';
import { openUrlExternal } from '../../utils/openUrl';

type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.SettingsWebviewScreen>;

export const SettingsWebViews: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const { url, title } = route?.params;
  const [currentUrl, setCurrentUrl] = useState(url);
  const isProcessing = useRef(false);
  const containerRef = useRef<typeof Box>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      header: () => (
        <Box
          ref={containerRef}
          bg="background-default"
          justifyContent="center"
          borderBottomWidth="2px"
          borderBottomColor="divider"
        >
          <NavHeader
            safeTop={0}
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
                options={
                  [
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
                  ].map((item) => ({
                    ...item,
                    value: () => {
                      if (isProcessing.current) return;
                      isProcessing.current = true;
                      item.value();
                      isProcessing.current = false;
                    },
                  })) as SelectItem<() => void>[]
                }
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
  }, [currentUrl, intl, navigation, title, url]);

  return <WebView src={currentUrl} />;
};

export default SettingsWebViews;
