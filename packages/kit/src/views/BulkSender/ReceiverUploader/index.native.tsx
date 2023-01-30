import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { pickSingle, types } from 'react-native-document-picker';
import { readFile } from 'react-native-fs';
import { read, utils } from 'xlsx';

import { Center, HStack, Icon, Pressable, Text } from '@onekeyhq/components';

import { TokenReceiverEnum } from '../types';
import { downloadReceiverExample } from '../utils';

import type { TokenReceiver } from '../types';

interface Props {
  setReceiverFromOut: React.Dispatch<React.SetStateAction<TokenReceiver[]>>;
  setIsUploadMode: React.Dispatch<React.SetStateAction<boolean>>;
}

function ReceiverUploader(props: Props) {
  const { setReceiverFromOut, setIsUploadMode } = props;

  const intl = useIntl();

  const handleUploadFile = useCallback(async () => {
    try {
      const f = await pickSingle({
        allowMultiSelection: false,
        copyTo: 'documentDirectory',
        mode: 'open',
        type: [types.plainText, types.csv, types.xls, types.xlsx],
      });
      const path = f.fileCopyUri;
      if (!path) return;
      const bstr = await readFile(path, 'ascii');
      const wb = read(bstr, { raw: true, type: 'binary' });

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
  }, [setIsUploadMode, setReceiverFromOut]);

  return (
    <>
      <Pressable
        height="148px"
        onPress={handleUploadFile}
        borderWidth={1}
        borderColor="border-default"
        borderRadius="12px"
        backgroundColor="surface-default"
      >
        <Center w="full" h="full">
          <Icon name="UploadOutline" size={40} color="icon-subdued" />
        </Center>
      </Pressable>
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
