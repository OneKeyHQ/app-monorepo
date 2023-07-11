import { useEffect, useState } from 'react';

import { Box } from '@onekeyhq/components';

import { useDebounce } from '../../../hooks';
import { TextareaWithLineNumber } from '../TextareaWithLineNumber';
import { decodeTrader, encodeTrader } from '../utils';

import { TraderErrors } from './TraderErrors';

import type { TraderInputParams } from '../types';

type Props = Omit<TraderInputParams, 'isUploadMode' | 'setIsUploadMode'>;

function TraderEditor(props: Props) {
  const { traderFromOut, setTrader, traderErrors, amountType } = props;

  const [traderString, setTraderString] = useState('');

  const receiverStringDebounce = useDebounce(traderString, 500, {
    leading: true,
  });

  useEffect(() => {
    setTrader(decodeTrader(receiverStringDebounce, amountType));
  }, [amountType, receiverStringDebounce, setTrader]);

  useEffect(() => {
    if (traderFromOut.length > 0) {
      setTraderString(encodeTrader(traderFromOut, amountType));
    }
  }, [amountType, traderFromOut]);

  return (
    <Box>
      <TextareaWithLineNumber
        traderString={traderString}
        setTraderString={setTraderString}
      />
      <Box mt={3}>
        <TraderErrors traderErrors={traderErrors} showFileError={false} />
      </Box>
    </Box>
  );
}

export { TraderEditor };
