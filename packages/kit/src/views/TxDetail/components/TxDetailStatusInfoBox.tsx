import { useMemo } from 'react';

import dayjs from 'dayjs';
import { useIntl } from 'react-intl';

import { Box, Button, HStack, Image, Text } from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { IDecodedTxStatus } from '@onekeyhq/engine/src/vaults/types';
import txFailedIcon from '@onekeyhq/kit/assets/transaction/status/tx_failed.png';
import txPendingIcon from '@onekeyhq/kit/assets/transaction/status/tx_pending.png';
import txSuccessedIcon from '@onekeyhq/kit/assets/transaction/status/tx_successed.png';

import BaseMenu from '../../Overlay/BaseMenu';
import { getTxStatusInfo } from '../utils/utilsTxDetail';

import type { IBaseMenuOptions } from '../../Overlay/BaseMenu';
import type { ITxActionListViewProps } from '../types';
import type { ImageURISource } from 'react-native';

type Props = ITxActionListViewProps & {
  tokensInTx: Token[];
};

function TxDetailStatusInfoBox(props: Props) {
  const { decodedTx, isSendConfirm, tokensInTx } = props;

  const intl = useIntl();

  const { text } = getTxStatusInfo({ decodedTx });

  const statusIcon = useMemo(() => {
    if (decodedTx.status === IDecodedTxStatus.Pending) {
      return txPendingIcon as ImageURISource;
    }

    if (decodedTx.status === IDecodedTxStatus.Confirmed) {
      return txSuccessedIcon as ImageURISource;
    }

    return txFailedIcon as ImageURISource;
  }, [decodedTx.status]);

  const swapOptions = useMemo(() => {
    const baseOptions: IBaseMenuOptions = tokensInTx.map((token) => ({
      textValue: token?.symbol ?? '',
      onPress: () => alert('hello'),
    }));
    return baseOptions;
  }, [tokensInTx]);

  if (isSendConfirm) return null;

  return (
    <Box mb={6}>
      <HStack justifyContent="space-between" alignItems="center">
        <HStack space={2} alignItems="center">
          <Image size={10} source={statusIcon} />
          <Box>
            <Text typography="Body1Strong">
              {intl.formatMessage({ id: text })}
            </Text>
            {(decodedTx.createdAt || decodedTx.updatedAt) && (
              <Text typography="Body2" color="text-subdued">
                {dayjs(decodedTx.createdAt || decodedTx.updatedAt).format(
                  'MMM DD YYYY, HH:MM',
                )}
              </Text>
            )}
          </Box>
        </HStack>
        {tokensInTx.length === 1 && (
          <Button size="sm" type="outline">
            {intl.formatMessage({ id: 'title__swap' })}
          </Button>
        )}
        {tokensInTx.length > 1 && (
          <BaseMenu options={swapOptions}>
            <Button size="sm" type="basic">
              {intl.formatMessage({ id: 'title__swap' })}
            </Button>
          </BaseMenu>
        )}
      </HStack>
    </Box>
  );
}

export { TxDetailStatusInfoBox };
