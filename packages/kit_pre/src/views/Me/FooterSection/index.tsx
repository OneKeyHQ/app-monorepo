import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Pressable,
  Text,
  ToastManager,
  Typography,
  useTheme,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getLogZipPath } from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { HomeRoutes } from '../../../routes/routesEnum';

import type { RootRoutes } from '../../../routes/routesEnum';
import type { HomeRoutesParams, RootRoutesParams } from '../../../routes/types';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = CompositeNavigationProp<
  NativeStackNavigationProp<RootRoutesParams, RootRoutes.Main>,
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.ClearCache>
>;

const getShareModule = async () => {
  if (!platformEnv.isNative) return null;
  return (
    await import('@onekeyhq/shared/src/modules3rdParty/react-native-share')
  ).default;
};

export const FooterAction = () => {
  const intl = useIntl();

  const { themeVariant } = useTheme();
  const navigation = useNavigation<NavigationProps>();

  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  const getLogName = useCallback((ext: string = 'txt') => {
    const str = new Date().toISOString().replace(/[-:.]/g, '');
    return `log-${str}.${ext}`;
  }, []);

  const downloadTxtFile = useCallback(async () => {
    const logName = getLogName();
    const element = document.createElement('a');

    const logger = await backgroundApiProxy.serviceApp.getLoggerInstance();
    const file = new Blob(logger, {
      type: 'text/plain',
      endings: 'native',
    });
    element.href = URL.createObjectURL(file);
    element.download = logName;
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
  }, [getLogName]);

  const shareLogFile = useCallback(async () => {
    const shareFileName = getLogName('zip');
    const logFilePath = await getLogZipPath(shareFileName);
    const Share = await getShareModule();
    if (!Share) return;
    Share.open({
      url: logFilePath,
      title: shareFileName,
      filename: shareFileName,
    }).catch(() => {
      /** ignore */
    });
  }, [getLogName]);

  const handleExportStateLog = useCallback(() => {
    if (platformEnv.isNative) {
      shareLogFile();
    } else {
      downloadTxtFile();
    }
  }, [downloadTxtFile, shareLogFile]);

  const handleCopyEmail = useCallback(() => {
    copyToClipboard('hi@onekey.so');
    ToastManager.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
  }, [intl]);

  return (
    <Box w="full" mb="6">
      <Box
        borderRadius="12"
        bg="surface-default"
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        borderColor="border-subdued"
      >
        <Pressable
          display="flex"
          flexDirection="row"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          onPress={handleExportStateLog}
        >
          <Icon name="DocumentTextOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex={1}
            mx={3}
          >
            {intl.formatMessage({
              id: 'content__state_logs',
            })}
          </Text>
          <Text
            mr="4"
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            color="text-subdued"
          >
            {intl.formatMessage({ id: 'action__export' })}
          </Text>
          <Box>
            <Icon name="ArrowDownTrayOutline" color="icon-subdued" size={20} />
          </Box>
        </Pressable>
      </Box>
      <Pressable onPress={handleCopyEmail}>
        <Typography.Body2 color="text-subdued" mt="2">
          {intl.formatMessage(
            { id: 'content__state_logs_desc' },
            { 0: 'hi@onekey.so' },
          )}
        </Typography.Body2>
      </Pressable>

      <Box
        mt="24px"
        borderRadius="12"
        bg="surface-default"
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        borderColor="border-subdued"
      >
        <Pressable
          display="flex"
          flexDirection="row"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          onPress={() => {
            navigation.navigate(HomeRoutes.ClearCache);
          }}
        >
          <Icon name="FolderMinusOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex={1}
            mx={3}
          >
            {intl.formatMessage({ id: 'action__clear_cache' })}
          </Text>
          <Box>
            <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
          </Box>
        </Pressable>
      </Box>
    </Box>
  );
};
