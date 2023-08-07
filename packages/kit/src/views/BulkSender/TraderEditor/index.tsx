import { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Center, Icon, Input, Text } from '@onekeyhq/components';

import { useDebounce } from '../../../hooks';
import { useDropUpload } from '../hooks';
import { TextareaWithLineNumber } from '../TextareaWithLineNumber';
import { AmountTypeEnum, TokenTraderEnum } from '../types';
import { decodeTrader, encodeTrader } from '../utils';

import { TraderErrors } from './TraderErrors';

import type { TokenTrader, TraderInputParams } from '../types';

type Props = Omit<
  TraderInputParams,
  'isUploadMode' | 'setIsUploadMode' | 'token' | 'header'
> & {
  showFileError: boolean;
  setShowFileError: React.Dispatch<React.SetStateAction<boolean>>;
};

function TraderEditor(props: Props) {
  const {
    traderFromOut,
    setTraderFromOut,
    setTrader,
    traderErrors,
    showFileError,
    setShowFileError,
    amountType,
    isSingleMode,
    withAmount,
  } = props;

  const intl = useIntl();

  const [traderString, setTraderString] = useState('');
  const { isDragAccept, data, getRootProps } = useDropUpload<TokenTrader>({
    header:
      amountType === AmountTypeEnum.Custom
        ? [TokenTraderEnum.Address, TokenTraderEnum.Amount]
        : [TokenTraderEnum.Address],
    noClick: true,
    onDrop(acceptedFiles, fileRejections) {
      if (fileRejections.length > 0) {
        setShowFileError(true);
      }
    },
  });

  const traderStringDebounce = useDebounce(traderString, 500, {
    leading: true,
  });

  useEffect(() => {
    const trader = decodeTrader<TokenTrader>({
      traderString: traderStringDebounce,
      withAmount: !!(
        !isSingleMode &&
        amountType === AmountTypeEnum.Custom &&
        withAmount
      ),
    });

    setTrader(trader);
  }, [
    amountType,
    traderStringDebounce,
    setTrader,
    setTraderFromOut,
    isSingleMode,
    withAmount,
  ]);

  useEffect(() => {
    if (traderFromOut.length > 0) {
      setTraderString(
        encodeTrader({
          trader: traderFromOut,
          withAmount: !!(
            !isSingleMode &&
            amountType === AmountTypeEnum.Custom &&
            withAmount
          ),
        }),
      );
    }
  }, [amountType, isSingleMode, traderFromOut, withAmount]);

  useEffect(() => {
    if (data && data[0] && data[0].Address && data[0].Amount) {
      setShowFileError(false);
      setTraderFromOut(
        data.filter(
          (item) =>
            item.Address !== TokenTraderEnum.Address &&
            item.Amount !== TokenTraderEnum.Amount,
        ),
      );
    } else if (data && data[0]) {
      setShowFileError(true);
    }
  }, [data, intl, setTraderFromOut, setShowFileError]);

  return (
    <Box>
      <div
        style={{ width: '100%', height: '100%', position: 'relative' }}
        {...getRootProps()}
      >
        {isSingleMode ? (
          <Input
            w="100%"
            value={traderString}
            onChangeText={(text) => setTraderString(text)}
          />
        ) : (
          <TextareaWithLineNumber
            traderString={traderString}
            setTraderString={setTraderString}
          />
        )}
        {isDragAccept && (
          <Center
            flex="1"
            bg="backdrop"
            zIndex={999}
            position="absolute"
            left="0"
            right="0"
            top="0"
            bottom="0"
            borderRadius={12}
          >
            <Box
              bg="surface-default"
              borderWidth={1}
              borderColor="interactive-default"
              w="358px"
              borderRadius={12}
              h="148px"
            >
              <Center h="full">
                <Icon name="DocumentArrowUpOutline" size={38} />
                <Text mt={5}>
                  {intl.formatMessage({ id: 'form__drag_file_here' })}
                </Text>
              </Center>
            </Box>
          </Center>
        )}
      </div>
      <Box mt={3}>
        <TraderErrors
          traderErrors={traderErrors}
          showFileError={showFileError}
        />
      </Box>
    </Box>
  );
}

export { TraderEditor };
