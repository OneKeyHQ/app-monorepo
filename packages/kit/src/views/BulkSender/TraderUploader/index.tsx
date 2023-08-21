import { useDropzone } from 'react-dropzone';
import { useIntl } from 'react-intl';
import { read, utils } from 'xlsx';

import { Box, Center, Icon, Text, useThemeValue } from '@onekeyhq/components';

import { TraderErrors } from '../TraderEditor/TraderErrors';
import { TraderExample } from '../TraderExample';
import { TokenTraderEnum } from '../types';

import type { TokenTrader } from '../types';

interface Props {
  setTraderFromOut: React.Dispatch<React.SetStateAction<TokenTrader[]>>;
  setIsUploadMode: React.Dispatch<React.SetStateAction<boolean>>;
  showFileError: boolean;
  setShowFileError: React.Dispatch<React.SetStateAction<boolean>>;
}

function TraderUploader(props: Props) {
  const { setTraderFromOut, setIsUploadMode, showFileError, setShowFileError } =
    props;
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
      } catch {
        setShowFileError(true);
      }
    },
    onDropRejected() {
      setShowFileError(true);
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
