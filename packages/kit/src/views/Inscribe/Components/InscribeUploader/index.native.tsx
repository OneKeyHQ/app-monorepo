import type { FC } from 'react';
import { useCallback, useState } from 'react';

import { EncodingType, readAsStringAsync } from 'expo-file-system';
import { MediaTypeOptions, launchImageLibraryAsync } from 'expo-image-picker';
import * as mime from 'mime';
import { useIntl } from 'react-intl';
import { pickSingle, types } from 'react-native-document-picker';

import type { ICON_NAMES } from '@onekeyhq/components';
import {
  BottomSheetModal,
  Center,
  Icon,
  ListItem,
  Pressable,
  Spinner,
  Text,
  ToastManager,
} from '@onekeyhq/components';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { showOverlay } from '../../../../utils/overlayUtils';
import { checkFileSize } from '../../CreateContent/util';
import { InscribeFilePreview } from '../InscribeFilePreview';

import { getStandardFileBase64 } from './util';

import type { Props } from './type';

type ModalProps = {
  closeOverlay: () => void;
  selectIndex?: (index: number) => void;
};
const Content: FC<ModalProps> = ({ closeOverlay, selectIndex }) => {
  const intl = useIntl();
  const options: { icon: ICON_NAMES; title: string }[] = [
    {
      icon: 'PhotoOutline',
      title: intl.formatMessage({ id: 'action__photo' }),
    },
    {
      icon: 'DocumentTextOutline',
      title: intl.formatMessage({ id: 'action__file' }),
    },
  ];

  return (
    <BottomSheetModal
      title={intl.formatMessage({ id: 'action__upload' })}
      closeOverlay={() => {
        closeOverlay();
      }}
    >
      {options.map((option, index) => (
        <ListItem
          // bgColor="red.100"
          px="16px"
          py="12px"
          key={option.title}
          onPress={() => {
            if (selectIndex) {
              closeOverlay();
              selectIndex(index);
            }
          }}
        >
          <Icon name={option.icon} size={24} />
          <Text typography="Body1Strong">{option.title}</Text>
        </ListItem>
      ))}
    </BottomSheetModal>
  );
};

const showPickFileSheet = (props: Omit<ModalProps, 'closeOverlay'>) =>
  showOverlay((close) => <Content {...props} closeOverlay={close} />);

function InscribeUploader(props: Props) {
  const {
    file: fileFromOut,
    setFileFromOut,
    // setIsUploadMode,
    // showFileError,
    setError,
  } = props;
  const intl = useIntl();
  const [isLoading, setLoading] = useState(false);

  const pickImageAction = useCallback(async () => {
    const results = await launchImageLibraryAsync({
      mediaTypes: MediaTypeOptions.All,
      allowsEditing: false,
      base64: false,
    });

    if (!results.canceled) {
      setFileFromOut(undefined);
      setError('');
      const file = results.assets[0];
      setLoading(true);
      const base64 = await readAsStringAsync(file.uri, {
        encoding: EncodingType.Base64,
      });

      const data = Buffer.from(base64, 'base64');
      let { fileName } = file;
      if (!fileName) {
        fileName = file.uri.split('/').pop();
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const type = mime.getType(fileName as string);
      if (type) {
        if (data.length === 0) {
          ToastManager.show(
            {
              title: intl.formatMessage({
                id: 'msg__text_file_cannot_be_blank',
              }),
            },
            { type: 'error' },
          );
          setLoading(false);
          return;
        }
        if (!checkFileSize(data.length)) {
          setError(
            intl.formatMessage(
              { id: 'msg__file_size_should_less_than_str' },
              { 0: '200KB' },
            ),
          );
          if (file.type !== 'image') {
            setFileFromOut({
              dataForUI: '',
              dataForAPI: '',
              dataLength: data.length,
              name: fileName,
              size: file.fileSize || data.length,
              type,
            });
            setLoading(false);
            return;
          }
        }
        const dataForAPI = bufferUtils.bytesToHex(data);

        const dataForUI = getStandardFileBase64(base64, type);
        if (dataForAPI && dataForUI && fileName) {
          setFileFromOut({
            dataForUI,
            dataForAPI,
            dataLength: data.length,
            name: fileName,
            size: file.fileSize || data.length,
            type,
          });
          setLoading(false);
        } else {
          setLoading(false);
        }
      }
    }
  }, [intl, setError, setFileFromOut]);

  const pickFileAction = useCallback(async () => {
    try {
      const file = await pickSingle({
        allowMultiSelection: false,
        copyTo: 'documentDirectory',
        mode: 'open',
        type: [types.plainText, types.audio, types.video, types.images],
      });
      setFileFromOut(undefined);
      setError('');

      const path = file.fileCopyUri;
      if (!path) return;
      const type = path.split('.').pop();
      if (
        !['json', 'jpg', 'webp', 'png', 'gif', 'txt', 'mp3', 'mp4'].includes(
          type?.toLowerCase() ?? '',
        )
      ) {
        return;
      }

      const base64 = await readAsStringAsync(path, {
        encoding: EncodingType.Base64,
      });

      const data = Buffer.from(base64, 'base64');
      if (file.size && file.type) {
        if (data.length === 0) {
          ToastManager.show(
            {
              title: intl.formatMessage({
                id: 'msg__text_file_cannot_be_blank',
              }),
            },
            { type: 'error' },
          );
          setLoading(false);
          return;
        }
        if (!checkFileSize(data.length)) {
          setError(
            intl.formatMessage(
              { id: 'msg__file_size_should_less_than_str' },
              { 0: '200KB' },
            ),
          );
          if (!file.type.startsWith('image')) {
            setFileFromOut({
              dataForUI: '',
              dataForAPI: '',
              dataLength: data.length,
              name: file.name,
              size: file.size,
              type: file.type,
            });
            setLoading(false);
            return;
          }
        }
        const dataForAPI = bufferUtils.bytesToHex(data);
        const dataForUI = getStandardFileBase64(base64, file.type);
        if (dataForAPI && dataForUI) {
          setFileFromOut({
            dataForUI,
            dataForAPI,
            dataLength: data.length,
            name: file.name,
            size: file.size,
            type: file.type,
          });
          setLoading(false);
        } else {
          setLoading(false);
        }
      }
    } catch {
      setLoading(false);
    }
  }, [intl, setError, setFileFromOut]);

  const handleUploadFile = useCallback(() => {
    showPickFileSheet({
      selectIndex: (index) => {
        if (index === 0) {
          pickImageAction();
        } else {
          pickFileAction();
        }
      },
    });
  }, [pickFileAction, pickImageAction]);

  return (
    <Pressable
      height="148px"
      onPress={handleUploadFile}
      borderWidth={1}
      borderColor="border-default"
      borderRadius="12px"
      backgroundColor="surface-default"
    >
      {!fileFromOut ? (
        <Center w="full" h="full">
          {isLoading ? (
            <Spinner size="lg" />
          ) : (
            <>
              <Icon name="ArrowUpTrayOutline" size={36} />
              <Text fontSize={14} mt="20px">
                {intl.formatMessage({
                  id: 'form__drag_or_drop_file_to_import',
                })}
              </Text>
            </>
          )}
        </Center>
      ) : (
        <InscribeFilePreview file={fileFromOut} />
      )}
    </Pressable>
  );
}

export { InscribeUploader };
