import { useEffect, useState } from 'react';

import { Box, Input } from '@onekeyhq/components';

import { useDebounce } from '../../../hooks';
import { TextareaWithLineNumber } from '../TextareaWithLineNumber';
import { AmountTypeEnum, type TraderInputParams } from '../types';
import { decodeTrader, encodeTrader } from '../utils';

import { TraderErrors } from './TraderErrors';

import type { TokenTrader } from '../types';

type Props = Omit<TraderInputParams, 'isUploadMode' | 'setIsUploadMode'>;

function TraderEditor(props: Props) {
  const {
    traderFromOut,
    setTrader,
    setTraderFromOut,
    traderErrors,
    amountType,
    isSingleMode,
  } = props;

  const [traderString, setTraderString] = useState('');

  const traderStringDebounce = useDebounce(traderString, 500, {
    leading: true,
  });

  useEffect(() => {
    const trader = decodeTrader<TokenTrader>({
      traderString: traderStringDebounce,
      withAmount: !isSingleMode && amountType === AmountTypeEnum.Custom,
    });
    setTrader(trader);
  }, [
    amountType,
    traderStringDebounce,
    setTrader,
    isSingleMode,
    setTraderFromOut,
  ]);

  useEffect(() => {
    if (traderFromOut.length > 0) {
      setTraderString(
        encodeTrader({
          trader: traderFromOut,
          withAmount: !isSingleMode && amountType === AmountTypeEnum.Custom,
        }),
      );
    }
  }, [amountType, isSingleMode, traderFromOut]);

  return (
    <Box>
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
      <Box mt={3}>
        <TraderErrors traderErrors={traderErrors} showFileError={false} />
      </Box>
    </Box>
  );
}

export { TraderEditor };
