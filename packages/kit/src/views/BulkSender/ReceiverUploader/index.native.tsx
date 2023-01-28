import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { Platform } from 'react-native';
import RNFetchBlob from 'react-native-blob-util';
import { pickSingle, types } from 'react-native-document-picker';
import { read, utils } from 'xlsx';

import { Center, Icon, Pressable, Text } from '@onekeyhq/components';

import { TokenReceiverEnum } from '../types';

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
      let path = f.fileCopyUri;
      if (!path) return;
      if (Platform.OS === 'ios')
        path = path.replace(
          /^.*\/Documents\//,
          `${RNFetchBlob.fs.dirs.DocumentDir}/`,
        );
      const res = await RNFetchBlob.fs.readFile(path, 'ascii');
      const wb = read(new Uint8Array(res), { raw: true, type: 'buffer' });

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
      <Pressable height="148px" onPress={handleUploadFile}>
        <Center w="full" h="full">
          <Icon name="UploadOutline" size={40} color="icon-subdued" />
        </Center>
      </Pressable>
      <Text fontSize={14} color="text-subdued" mt={4}>
        {intl.formatMessage({ id: 'content__support_csv_txt_or_excel' })}
      </Text>
    </>
  );
}

export { ReceiverUploader };
