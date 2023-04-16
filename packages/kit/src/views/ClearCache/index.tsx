import type { FC } from 'react';
import { useCallback, useLayoutEffect } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Pressable,
  Text,
  ToastManager,
  VStack,
} from '@onekeyhq/components';
import { clearWebViewData } from '@onekeyhq/shared/src/cacheManager';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useNavigation } from '../../hooks';
import {
  ClearCacheModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../routes/routesEnum';

import { browserSettingUrl } from './CopyBrowserUrlModal';

type OptionsProps = {
  title?: string;
  desc?: string;
  onPress?: () => void;
};

const Options: FC<OptionsProps> = ({ title, onPress, desc }) => (
  <Pressable
    flexDirection="column"
    onPress={onPress}
    borderBottomColor="divider"
  >
    <Text typography="Body1Strong" numberOfLines={1}>
      {title}
    </Text>
    <Text mt="12px" typography="Body1" color="text-subdued">
      {desc}
    </Text>
  </Pressable>
);

const ClearCache = () => {
  const intl = useIntl();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    const title = intl.formatMessage({
      id: 'action__clear_cache',
    });
    navigation.setOptions({
      title,
    });
  }, [navigation, intl]);

  const clearAction = useCallback(() => {
    if (platformEnv.isExtension && browserSettingUrl()) {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.ClearCache,
        params: {
          screen: ClearCacheModalRoutes.CopyBrowserUrlModal,
          params: undefined,
        },
      });
    } else {
      clearWebViewData().then(() => {
        ToastManager.show({
          title: intl.formatMessage({
            id: 'msg__cleared',
          }),
        });
      });
    }
  }, [intl, navigation]);

  return (
    <Box
      mt={{ base: 0, md: 4 }}
      w="full"
      h="full"
      bg="background-default"
      p="4"
      maxW={768}
      mx="auto"
    >
      <Box>
        <VStack w="full" space="32px">
          <Options
            onPress={() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.ClearCache,
                params: {
                  screen: ClearCacheModalRoutes.ClearCacheModal,
                  params: undefined,
                },
              });
            }}
            title={intl.formatMessage({
              id: 'action__clear_all_cache_on_app',
            })}
            desc={intl.formatMessage({
              id: 'action__clear_all_cache_on_app_desc',
            })}
          />
          <Options
            onPress={clearAction}
            title={intl.formatMessage({
              id: 'action__clear_cache_of_web_browser',
            })}
            desc={intl.formatMessage({
              id: 'action__clear_cache_of_web_browser_desc',
            })}
          />
        </VStack>
      </Box>
    </Box>
  );
};

export default ClearCache;
