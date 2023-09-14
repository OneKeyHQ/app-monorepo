import { useCallback, useState } from 'react';

import BigNumber from 'bignumber.js';
import { EncodingType, readAsStringAsync } from 'expo-file-system';
import { useIntl } from 'react-intl';
import { pickSingle, types } from 'react-native-document-picker';
import { read, utils } from 'xlsx';

import {
  Box,
  Center,
  Icon,
  Pressable,
  Spinner,
  ToastManager,
} from '@onekeyhq/components';
import { ToastManagerType } from '@onekeyhq/components/src/ToastManager';

import { TraderErrors } from '../TraderEditor/TraderErrors';
import { TraderExample } from '../TraderExample';
import { TokenTraderEnum } from '../types';

import type { TokenTrader } from '../types';

const MAX_FILE_SIZE = 1024 * 100;

interface Props {
  setTraderFromOut: React.Dispatch<React.SetStateAction<TokenTrader[]>>;
  setIsUploadMode: React.Dispatch<React.SetStateAction<boolean>>;
  showFileError: boolean;
  setShowFileError: React.Dispatch<React.SetStateAction<boolean>>;
}

function TraderUploader(props: Props) {
  const { setTraderFromOut, setIsUploadMode, showFileError, setShowFileError } =
    props;

  const [isUploading, setIsUploading] = useState(false);
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
      const type = path.split('.').pop();
      if (!['xlsx', 'txt', 'csv', 'xls'].includes(type?.toLowerCase() ?? '')) {
        setShowFileError(true);
        return;
      }
      if (f && f.size && new BigNumber(f.size).gt(MAX_FILE_SIZE)) {
        ToastManager.show(
          {
            title: intl.formatMessage(
              { id: 'msg__please_limit_the_file_size_to_str_or_less' },
              { '0': `${MAX_FILE_SIZE / 1024}KB` },
            ),
          },
          { type: ToastManagerType.error },
        );
        return;
      }
      setIsUploading(true);
      const b64 = await readAsStringAsync(path, {
        encoding: EncodingType.Base64,
      });
      const wb = read(b64, { raw: true, type: 'base64' });

      const data = utils.sheet_to_json<{ Address: string; Amount: string }>(
        wb.Sheets[wb.SheetNames[0]],
        { header: [TokenTraderEnum.Address, TokenTraderEnum.Amount] },
      );
      if (data && data[0] && data[0].Address && data[0].Amount) {
        setTraderFromOut(
          data
            .filter(
              (item) =>
                item.Address !== TokenTraderEnum.Address &&
                item.Amount !== TokenTraderEnum.Amount,
            )
            .map((item) => ({
              address: item.Address,
              amount: item.Amount,
            })),
        );
        setShowFileError(false);
        setIsUploadMode(false);
      } else {
        setShowFileError(true);
      }
      setIsUploading(false);
    } catch {
      setShowFileError(true);
      setIsUploading(false);
    }
  }, [intl, setIsUploadMode, setTraderFromOut, setShowFileError]);

  return (
    <>
      <Pressable
        isDisabled={isUploading}
        height="148px"
        onPress={handleUploadFile}
        borderWidth={1}
        borderColor="border-default"
        borderRadius="12px"
        backgroundColor="surface-default"
      >
        <Center w="full" h="full">
          {isUploading ? (
            <Spinner size="lg" />
          ) : (
            <Icon name="UploadOutline" size={40} color="icon-subdued" />
          )}
        </Center>
      </Pressable>
      <Box mt={3}>
        <TraderErrors traderErrors={[]} showFileError={showFileError} />
      </Box>
      <Box mt={4}>
        <TraderExample />
      </Box>
    </>
  );
}

export { TraderUploader };
