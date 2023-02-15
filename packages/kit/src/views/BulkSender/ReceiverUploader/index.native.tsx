import { useCallback } from 'react';

import * as FileSystem from 'expo-file-system';
import { pickSingle, types } from 'react-native-document-picker';
import { read, utils } from 'xlsx';

import { Box, Center, Icon, Pressable } from '@onekeyhq/components';

import { ReceiverExample } from '../ReceiverExample';
import { TokenReceiverEnum } from '../types';

import type { TokenReceiver } from '../types';

interface Props {
  setReceiverFromOut: React.Dispatch<React.SetStateAction<TokenReceiver[]>>;
  setIsUploadMode: React.Dispatch<React.SetStateAction<boolean>>;
}

function ReceiverUploader(props: Props) {
  const { setReceiverFromOut, setIsUploadMode } = props;

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
      const b64 = await FileSystem.readAsStringAsync(path, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const wb = read(b64, { raw: true, type: 'base64' });

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
      <Box mt={4}>
        <ReceiverExample />
      </Box>
    </>
  );
}

export { ReceiverUploader };
