import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import { Text } from '@onekeyhq/components';
import type { IDecodedTx } from '@onekeyhq/engine/src/vaults/types';

import { getTxStatusInfo } from '../utils/utilsTxDetail';

function TxActionElementStatusText(
  props: ComponentProps<typeof Text> & {
    decodedTx: IDecodedTx;
  },
) {
  const { decodedTx, ...others } = props;
  const intl = useIntl();

  const statusInfo = getTxStatusInfo({ decodedTx });

  return (
    <Text typography="Body2" color={statusInfo.textColor} {...others}>
      {intl.formatMessage({ id: statusInfo.text })}
    </Text>
  );
}

export { TxActionElementStatusText };
