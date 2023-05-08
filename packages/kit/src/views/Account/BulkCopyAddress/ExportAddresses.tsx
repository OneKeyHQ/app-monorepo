import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { cacheDirectory } from 'expo-file-system';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Modal,
  ScrollView,
  Text,
  ToastManager,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import showFileFormatBottomSheetModal from './SelectFileFormatBottomSheetModal';

import type { CreateAccountRoutesParams } from '../../../routes';
import type { CreateAccountModalRoutes } from '../../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.ExportAddresses
>;

type FileType = 'txt' | 'csv';

const getShareModule = async () => {
  if (!platformEnv.isNative) return null;
  return (
    await import('@onekeyhq/shared/src/modules3rdParty/react-native-share')
  ).default;
};

const getRNFSModule = async () => {
  if (!platformEnv.isNative) return null;
  return (await import('react-native-fs')) as typeof import('react-native-fs');
};

const ExportAddresses: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { data, walletId, networkId } = route.params;

  const addressText = useMemo(() => {
    let content = '';
    let index = 0;
    for (const item of data) {
      if (data.length > 1) {
        if (index > 0) {
          content += '\n';
        }
        content += `// ${item.name}\n`;
      }
      // eslint-disable-next-line no-loop-func, @typescript-eslint/no-loop-func
      item.data.forEach((account) => {
        content += `${account.address}\n`;
      });
      index += 1;
    }
    // slice the last \n
    return content.replace(/\n$/, '');
  }, [data]);

  const addressCsvString = useMemo(() => {
    const headerString = `${intl.formatMessage({ id: 'form__address' })}\n`;
    const csvString = `${headerString}${addressText}`;
    return csvString;
  }, [addressText, intl]);

  const getFileName = useCallback(
    async (fileType: FileType) => {
      const [wallet, network] = await Promise.all([
        backgroundApiProxy.engine.getWallet(walletId),
        backgroundApiProxy.engine.getNetwork(networkId),
      ]);
      return `${wallet.name}-${network.impl}-addresses.${fileType}`;
    },
    [walletId, networkId],
  );

  const downloadFile = useCallback(
    async (fileType: FileType) => {
      const fileName = await getFileName(fileType);
      const element = document.createElement('a');
      const content = fileType === 'txt' ? addressText : addressCsvString;
      const file = new Blob(
        content.split('\n').map((s) => `${s}\n`),
        {
          type: 'text/plain',
          endings: 'native',
        },
      );
      element.href = URL.createObjectURL(file);
      element.download = fileName;
      document.body.appendChild(element);
      element.click();
    },
    [addressCsvString, getFileName, addressText],
  );

  const shareFile = useCallback(
    async (fileType: FileType) => {
      const shareFileName = await getFileName(fileType);
      const filePath = `${cacheDirectory ?? ''}${shareFileName}`;
      const Share = await getShareModule();
      if (!Share) return;
      Share.open({
        url: filePath,
        title: shareFileName,
        filename: shareFileName,
      }).catch(() => {
        /** ignore */
      });
    },
    [getFileName],
  );

  const nativeWriteFile = useCallback(
    async (fileType: FileType) => {
      const fileName = await getFileName(fileType);
      const RNFS = await getRNFSModule();
      if (!RNFS) return;
      const path = `${RNFS.CachesDirectoryPath}/${fileName}`;
      const content = fileType === 'txt' ? addressText : addressCsvString;
      RNFS.writeFile(path, content, 'utf8')
        .then((res) => {
          console.log('FILE WRITTEN!', res);
          shareFile(fileType);
        })
        .catch((err) => {
          console.log('ERROR WRITING FILE!', err);
        });
    },
    [shareFile, addressText, addressCsvString, getFileName],
  );

  const onExportFile = useCallback(() => {
    showFileFormatBottomSheetModal({
      onSelect: (fileType: FileType) => {
        if (platformEnv.isNative) {
          nativeWriteFile(fileType);
        } else {
          downloadFile(fileType);
        }
      },
    });
  }, [nativeWriteFile, downloadFile]);

  const onCopyAddresses = useCallback(() => {
    setTimeout(() => {
      copyToClipboard(addressText);
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__copied' }),
      });
    }, 200);
  }, [addressText, intl]);

  return (
    <Modal
      height="460px"
      header={intl.formatMessage({ id: 'action__export_addresses' })}
      primaryActionTranslationId="action__export_file"
      primaryActionProps={{
        type: 'basic',
      }}
      onPrimaryActionPress={onExportFile}
      secondaryActionTranslationId="action__copy"
      secondaryActionProps={{
        type: 'basic',
      }}
      onSecondaryActionPress={onCopyAddresses}
    >
      <Box
        w="full"
        h="full"
        bg="action-secondary-default"
        borderRadius="lg"
        borderColor="border-default"
        borderWidth={StyleSheet.hairlineWidth}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          style={{ width: '100%' }}
        >
          <Box px={3} py={2} w="full">
            {addressText.split('\n').map((text, i) => (
              <Box alignItems="flex-start" flexDirection="row" key={i}>
                <Text
                  typography={{ sm: 'Body2', md: 'Body2' }}
                  color="text-disabled"
                  fontWeight={500}
                  fontSize={14}
                  lineHeight="20px"
                  fontFamily="monospace"
                  textAlign="left"
                  width="29px"
                >
                  {i + 1}
                </Text>
                <Text
                  ml={1}
                  flex={1}
                  fontSize={14}
                  lineHeight="20px"
                  fontWeight={500}
                  fontFamily="monospace"
                  color={
                    text.startsWith('//') ? 'text-disabled' : 'text-default'
                  }
                  overflow="hidden"
                >
                  {text}
                </Text>
              </Box>
            ))}
          </Box>
        </ScrollView>
      </Box>
    </Modal>
  );
};

export default ExportAddresses;
