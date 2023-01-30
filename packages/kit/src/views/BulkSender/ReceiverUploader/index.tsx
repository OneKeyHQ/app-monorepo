import { useDropzone } from 'react-dropzone';
import { useIntl } from 'react-intl';
import { read, utils } from 'xlsx';

import {
  Center,
  HStack,
  Icon,
  Pressable,
  Text,
  useThemeValue,
} from '@onekeyhq/components';

import { TokenReceiverEnum } from '../types';
import { downloadReceiverExample } from '../utils';

import type { TokenReceiver } from '../types';

interface Props {
  setReceiverFromOut: React.Dispatch<React.SetStateAction<TokenReceiver[]>>;
  setIsUploadMode: React.Dispatch<React.SetStateAction<boolean>>;
}

function ReceiverUploader(props: Props) {
  const { setReceiverFromOut, setIsUploadMode } = props;
  const [uploaderBg, uploaderBorderColor, uploaderActiveBorderColor] =
    useThemeValue(['surface-default', 'border-default', 'interactive-default']);

  const intl = useIntl();
  const { isDragAccept, getRootProps, getInputProps } = useDropzone({
    multiple: false,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
      ],
    },
    onDropAccepted: async (files) => {
      try {
        const file = await files[0].arrayBuffer();
        const wb = read(file, { raw: true });
        const data = utils.sheet_to_json<TokenReceiver>(
          wb.Sheets[wb.SheetNames[0]],
          { header: [TokenReceiverEnum.Address, TokenReceiverEnum.Amount] },
        );
        if (data && data[0] && data[0].Address && data[0].Amount) {
          setReceiverFromOut(
            data.filter(
              (item) =>
                item.Address !== TokenReceiverEnum.Address &&
                item.Amount !== TokenReceiverEnum.Amount,
            ),
          );
          setIsUploadMode(false);
        }
      } catch {
        // pass
      }
    },
  });

  return (
    <>
      <div
        {...getRootProps()}
        style={{
          cursor: 'pointer',
          background: uploaderBg,
          borderWidth: 1,
          borderStyle: 'solid',
          borderRadius: '12px',
          height: '148px',
          borderColor: isDragAccept
            ? uploaderActiveBorderColor
            : uploaderBorderColor,
        }}
      >
        <input {...getInputProps()} />
        <Center w="full" h="full">
          <Icon name="UploadOutline" size={40} color="icon-subdued" />
          <Text fontSize={14} mt="20px">
            {intl.formatMessage({ id: 'form__drag_or_drop_file_to_import' })}
          </Text>
        </Center>
      </div>
      <HStack mt={4} space="10px">
        <Text fontSize={14} color="text-subdued">
          {intl.formatMessage({ id: 'content__support_csv_txt_or_excel' })}
        </Text>
        <Pressable onPress={downloadReceiverExample}>
          <Text
            fontSize={14}
            color="text-subdued"
            textDecorationLine="underline"
          >
            {intl.formatMessage({ id: 'action__download_example' })}
          </Text>
        </Pressable>
      </HStack>
    </>
  );
}

export { ReceiverUploader };
