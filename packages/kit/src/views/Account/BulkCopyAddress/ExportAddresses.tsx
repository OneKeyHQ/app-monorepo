import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { cacheDirectory } from 'expo-file-system';
import { useIntl } from 'react-intl';

import { Modal, ToastManager } from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { TextareaWithLineNumber } from '@onekeyhq/kit/src/views/BulkSender/TextareaWithLineNumber';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import type {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '../../../routes';
import type { ModalScreenProps } from '../../../routes/types';
import type { RouteProp } from '@react-navigation/native';

type NavigationProps = ModalScreenProps<CreateAccountRoutesParams>;
type RouteProps = RouteProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.ExportAddresses
>;

type FileType = 'txt' | 'csv';

const getShareModule = async () => {
  if (!platformEnv.isNative) return null;
  return (await import('react-native-share')).default;
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
    return content;
  }, [data]);

  const addressCsvString = useMemo(() => {
    const headerString = 'address\n';
    const csvString = `${headerString}${addressText}`;
    return csvString;
  }, [addressText]);

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
      const filePath = `${cacheDirectory ?? ''}address.${fileType}`;
      const shareFileName = await getFileName(fileType);
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
      const RNFS = await getRNFSModule();
      if (!RNFS) return;
      const path = `${RNFS.CachesDirectoryPath}/address.${fileType}`;
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
    [shareFile, addressText, addressCsvString],
  );

  const onExportFile = useCallback(() => {
    const fileType = 'csv';
    if (platformEnv.isNative) {
      nativeWriteFile(fileType);
    } else {
      downloadFile(fileType);
    }
  }, [nativeWriteFile, downloadFile]);

  const onCopyAddresses = useCallback(() => {
    setTimeout(() => {
      copyToClipboard(addressText);
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__address_copied' }),
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
      <TextareaWithLineNumber
        readonly
        containerStyle={{ height: '100%' }}
        height="100%"
        receiverString={addressText}
        setReceiverString={() => {}}
      />
    </Modal>
  );
};

export default ExportAddresses;
